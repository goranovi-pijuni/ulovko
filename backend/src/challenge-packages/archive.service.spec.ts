import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yazl from 'yazl';
import { ArchiveService } from './archive.service.js';

const config = `services:\n  web1:\n    type: http\n    path: web1\n    port: 8080\n`;
const testRoots: string[] = [];
async function fixture(entries: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ulovko-test-'));
  testRoots.push(root);
  const file = join(root, 'upload.zip');
  const zip = new yazl.ZipFile();
  for (const [name, content] of Object.entries(entries)) {
    zip.addBuffer(Buffer.from(content), name);
  }
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(file));
  return file;
}

afterEach(async () => {
  await Promise.all(
    testRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('Challenge archive validation', () => {
  const archive = new ArchiveService();
  it('accepts deploy + config and preserves deploy/ paths for Runner', async () => {
    const file = await fixture({
      'config.yaml': config,
      'deploy/web1/Dockerfile': 'FROM python:3.13-alpine\n',
      'deploy/web1/server.py': 'print("hello")\n',
      'public/README.md': 'Public instructions',
    });
    const result = await archive.prepare(file);
    try {
      expect(result).toMatchObject({
        hasConfig: true,
        hasDeploy: true,
        hasPublic: true,
      });
      expect(
        (await readFile(result.deployZip!)).includes(
          Buffer.from('deploy/web1/Dockerfile'),
        ),
      ).toBe(true);
      expect(
        (await readFile(result.publicZip!)).includes(
          Buffer.from('public/README.md'),
        ),
      ).toBe(true);
    } finally {
      await result.cleanup();
    }
  });
  it('allows public-only static tasks', async () => {
    const file = await fixture({
      'public/README.md': 'Only a PDF or description',
    });
    const result = await archive.prepare(file);
    try {
      expect(result).toMatchObject({
        hasConfig: false,
        hasDeploy: false,
        hasPublic: true,
      });
    } finally {
      await result.cleanup();
    }
  });
  it('rejects a service missing its Dockerfile', async () => {
    const file = await fixture({
      'config.yaml': config,
      'deploy/web1/main.py': 'hi',
    });
    await expect(archive.prepare(file)).rejects.toThrow(/Dockerfile/);
  });
  it('rejects invalid YAML', async () => {
    const file = await fixture({
      'config.yaml': 'services: [',
      'deploy/web1/Dockerfile': 'FROM scratch',
    });
    await expect(archive.prepare(file)).rejects.toThrow(/config.yaml/);
  });
  it('rejects an archive with an unrelated top-level file', async () => {
    const file = await fixture({
      'public/README.md': 'hi',
      'secret.txt': 'no',
    });
    await expect(archive.prepare(file)).rejects.toThrow(/nedopuštena/);
  });
  it('rejects ZIP path traversal before extraction', async () => {
    const file = await fixture({ 'public/xx.txt': 'x' });
    const bytes = await readFile(file);
    const from = Buffer.from('public/xx.txt');
    const to = Buffer.from('../etc/passwd');
    expect(from.length).toBe(to.length);
    let offset = 0;
    while ((offset = bytes.indexOf(from, offset)) !== -1) {
      to.copy(bytes, offset);
      offset += to.length;
    }
    await writeFile(file, bytes);
    await expect(archive.prepare(file)).rejects.toThrow(/ZIP|putanja|arhiva/);
  });
  it('rejects a service path outside deploy', async () => {
    const file = await fixture({
      'config.yaml': `services:\n  web1:\n    type: http\n    path: ../escape\n    port: 80\n`,
      'deploy/web1/Dockerfile': 'FROM scratch',
    });
    await expect(archive.prepare(file)).rejects.toThrow(/putanja/);
  });
  it('rejects deploy without config', async () => {
    const file = await fixture({ 'deploy/web1/Dockerfile': 'FROM scratch' });
    await expect(archive.prepare(file)).rejects.toThrow(/config.yaml/);
  });
  it('rejects a corrupt ZIP', async () => {
    const file = await fixture({ 'public/README.md': 'ok' });
    await writeFile(file, 'not a ZIP');
    await expect(archive.prepare(file)).rejects.toThrow(/ZIP/);
  });
});
