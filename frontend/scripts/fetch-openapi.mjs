// Downloads the backend's OpenAPI document into openapi.json, the committed
// snapshot Orval generates from. Requires a running backend; override the
// source with OPENAPI_URL.
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.OPENAPI_URL ?? 'http://localhost:3000/api/docs-json';
const target = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../openapi.json',
);

const response = await fetch(url).catch((error) => {
  throw new Error(`Could not reach ${url}. Is the backend running?`, {
    cause: error,
  });
});
if (!response.ok) {
  throw new Error(`${url} responded with ${response.status}`);
}

const spec = await response.json();
await writeFile(target, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Saved ${url} to ${target}`);
