import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(backendDir, '../db/schema.ts');
const target = resolve(backendDir, 'src/database/schema.ts');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
