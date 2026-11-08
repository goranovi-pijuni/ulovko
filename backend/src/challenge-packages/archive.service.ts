import { BadRequestException, Injectable } from '@nestjs/common';
import { crc32 } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { parse } from 'yaml';
import yauzl from 'yauzl';
import yazl from 'yazl';

export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 256 * 1024 * 1024;
const MAX_MEMBERS = 5000;
const MAX_CONFIG_BYTES = 1024 * 1024;
const MAX_ENTRY_BYTES = 128 * 1024 * 1024;
const SERVICE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface PreparedPackage {
  root: string;
  configPath?: string;
  publicZip?: string;
  deployZip?: string;
  hasConfig: boolean;
  hasPublic: boolean;
  hasDeploy: boolean;
  cleanup(): Promise<void>;
}

function reject(message: string): never {
  throw new BadRequestException(`Neispravna arhiva: ${message}`);
}

function validatePath(name: string, directory: boolean): string {
  if (
    name.length > 1024 ||
    !name ||
    /[\\\x00-\x1f\x7f]/.test(name) ||
    name.startsWith('/')
  ) {
    reject(`nesigurna putanja ${JSON.stringify(name)}`);
  }
  const canonical = directory ? name.slice(0, -1) : name;
  const parts = canonical.split('/');
  if (
    parts.some(
      (part) => !part || part === '.' || part === '..' || part.includes(':'),
    )
  ) {
    reject(`nesigurna putanja ${JSON.stringify(name)}`);
  }
  if (!(
    canonical === 'config.yaml' ||
    canonical === 'public' ||
    canonical === 'deploy' ||
    canonical.startsWith('public/') ||
    canonical.startsWith('deploy/')
  )) {
    reject(`nedopuštena datoteka ${JSON.stringify(name)}`);
  }
  if ((canonical === 'public' || canonical === 'deploy') && !directory) {
    reject('public/ i deploy/ moraju biti direktoriji');
  }
  if (canonical === 'config.yaml' && directory)
    reject('config.yaml mora biti datoteka');
  return canonical;
}

function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, rejectPromise) => {
    yauzl.open(
      path,
      { lazyEntries: true, validateEntrySizes: true, decodeStrings: true },
      (error, zip) =>
        error || !zip
          ? rejectPromise(new BadRequestException('Neispravna ZIP arhiva'))
          : resolve(zip),
    );
  });
}

function readEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolve, rejectPromise) => {
    zip.openReadStream(entry, (error, stream) =>
      error || !stream
        ? rejectPromise(error ?? Error('Unable to read entry'))
        : resolve(stream),
    );
  });
}

async function extractArchive(
  zipPath: string,
  root: string,
): Promise<Set<string>> {
  const zip = await openZip(zipPath);
  const seen = new Set<string>();
  let entries = 0;
  let totalBytes = 0;
  return new Promise<Set<string>>((resolve, rejectPromise) => {
    let finished = false;
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      zip.close();
      rejectPromise(
        error instanceof BadRequestException
          ? error
          : new BadRequestException('Neispravna ili oštećena ZIP arhiva'),
      );
    };
    zip.on('error', fail);
    zip.on('end', () => {
      if (!finished) {
        finished = true;
        resolve(seen);
      }
    });
    zip.on('entry', (entry) => {
      void (async () => {
        if (++entries > MAX_MEMBERS) reject('previše ZIP zapisa');
        const isDirectory = entry.fileName.endsWith('/');
        const name = validatePath(entry.fileName, isDirectory);
        if (seen.has(name)) reject(`dvostruka putanja ${name}`);
        seen.add(name);
        const unixMode =
          entry.versionMadeBy >> 8 === 3
            ? entry.externalFileAttributes >>> 16
            : 0;
        const kind = unixMode & 0xf000;
        if (![0, isDirectory ? 0x4000 : 0x8000].includes(kind))
          reject('simboličke poveznice i posebne datoteke nisu dopuštene');
        if (isDirectory) {
          await mkdir(join(root, name), { recursive: true });
          zip.readEntry();
          return;
        }
        if (
          entry.uncompressedSize > MAX_ENTRY_BYTES ||
          (name === 'config.yaml' && entry.uncompressedSize > MAX_CONFIG_BYTES)
        ) {
          reject('prevelika datoteka');
        }
        totalBytes += entry.uncompressedSize;
        if (totalBytes > MAX_UNPACKED_BYTES)
          reject('raspakirani sadržaj prelazi ograničenje');
        const destination = join(root, ...name.split('/'));
        await mkdir(dirname(destination), { recursive: true });
        const input = await readEntry(zip, entry);
        let bytes = 0;
        let checksum = 0;
        const limiter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length;
            if (bytes > entry.uncompressedSize || bytes > MAX_ENTRY_BYTES) {
              callback(new Error('Uncompressed file too large'));
              return;
            }
            checksum = crc32(chunk, checksum);
            callback(null, chunk);
          },
        });
        await pipeline(
          input,
          limiter,
          createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
        );
        if (bytes !== entry.uncompressedSize || checksum !== entry.crc32)
          reject(`oštećen zapis ${name}`);
        zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
}

async function validateConfig(
  raw: string,
  files: Set<string>,
  root: string,
): Promise<void> {
  let config: unknown;
  try {
    config = parse(raw, { uniqueKeys: true, maxAliasCount: 10 });
  } catch {
    reject('config.yaml nije valjani YAML');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config))
    reject('config.yaml mora sadržavati objekt');
  const obj = config as Record<string, unknown>;
  if (
    Object.keys(obj).some((key) => key !== 'services') ||
    !obj.services ||
    typeof obj.services !== 'object' ||
    Array.isArray(obj.services)
  ) {
    reject('config.yaml mora sadržavati samo mapu services');
  }
  const services = Object.entries(obj.services as Record<string, unknown>);
  if (!services.length || services.length > 32)
    reject('services mora imati 1-32 servisa');
  for (const [name, value] of services) {
    if (name.length > 63 || !SERVICE_NAME.test(name))
      reject(`neispravno ime servisa ${name}`);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      reject(`neispravan servis ${name}`);
    const service = value as Record<string, unknown>;
    if (
      Object.keys(service).some(
        (key) => !['type', 'path', 'port', 'public'].includes(key),
      )
    )
      reject(`nepoznata postavka u servisu ${name}`);
    if (
      !['http', 'tcp'].includes(service.type as string) ||
      !Number.isInteger(service.port) ||
      (service.port as number) < 1 ||
      (service.port as number) > 65535 ||
      (service.public !== undefined && typeof service.public !== 'boolean')
    ) {
      reject(`neispravna konfiguracija servisa ${name}`);
    }
    const path = service.path;
    if (
      typeof path !== 'string' ||
      !path ||
      path.startsWith('/') ||
      path.includes('\\') ||
      path
        .split('/')
        .some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      reject(`neispravna putanja servisa ${name}`);
    }
    const context = `deploy/${path}`;
    if (![...files].some((file) => file.startsWith(`${context}/`)))
      reject(`nedostaje direktorij ${context}`);
    const dockerfile = await stat(join(root, context, 'Dockerfile')).catch(
      () => undefined,
    );
    if (!files.has(`${context}/Dockerfile`) || !dockerfile?.isFile())
      reject(`nedostaje ${context}/Dockerfile`);
  }
}

async function addFiles(
  zip: yazl.ZipFile,
  root: string,
  path: string,
): Promise<void> {
  for (const item of await readdir(join(root, path), { withFileTypes: true })) {
    const child = `${path}/${item.name}`;
    if (item.isDirectory()) await addFiles(zip, root, child);
    else if (item.isFile())
      zip.addFile(join(root, child), child, {
        mtime: new Date('1980-01-01T00:00:00Z'),
      });
  }
}

async function repack(
  root: string,
  directory: 'public' | 'deploy',
): Promise<string> {
  const file = join(root, `${directory}.zip`);
  const zip = new yazl.ZipFile();
  zip.addEmptyDirectory(directory, { mtime: new Date('1980-01-01T00:00:00Z') });
  await addFiles(zip, root, directory);
  zip.end();
  await pipeline(
    zip.outputStream,
    createWriteStream(file, { flags: 'wx', mode: 0o600 }),
  );
  return file;
}

@Injectable()
export class ArchiveService {
  async prepare(uploadPath: string): Promise<PreparedPackage> {
    const root = await mkdtemp(join(tmpdir(), 'ulovko-package-'));
    try {
      if ((await stat(uploadPath)).size > MAX_UPLOAD_BYTES)
        reject('ZIP je prevelik');
      const names = await extractArchive(uploadPath, root);
      const hasConfig = names.has('config.yaml');
      const hasPublic = [...names].some(
        (name) => name === 'public' || name.startsWith('public/'),
      );
      const hasDeploy = [...names].some(
        (name) => name === 'deploy' || name.startsWith('deploy/'),
      );
      if (!hasPublic && !hasDeploy) reject('nedostaje public/ ili deploy/');
      if (hasConfig !== hasDeploy)
        reject('za izvođenje su potrebni i config.yaml i deploy/');
      if (hasConfig)
        await validateConfig(
          await readFile(join(root, 'config.yaml'), 'utf8'),
          names,
          root,
        );
      const publicZip = hasPublic ? await repack(root, 'public') : undefined;
      const deployZip = hasDeploy ? await repack(root, 'deploy') : undefined;
      return {
        root,
        configPath: hasConfig ? join(root, 'config.yaml') : undefined,
        publicZip,
        deployZip,
        hasConfig,
        hasPublic,
        hasDeploy,
        cleanup: () => rm(root, { recursive: true, force: true }),
      };
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  }
}
