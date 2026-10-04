import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(serverRoot, 'dist');

// 1. Clean previous server/dist completely
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

// 2. Run TypeScript compiler
execSync('npx tsc', { cwd: serverRoot, stdio: 'inherit' });

// 3. Run tsc-alias with full path resolution (.js extensions & @shared alias)
execSync('npx tsc-alias -p tsconfig.json --resolve-full-paths', { cwd: serverRoot, stdio: 'inherit' });

// 4. Generate clean authoritative entrypoint at dist/index.js
const entrypointContent = "import './server/src/index.js';\n";
fs.writeFileSync(path.resolve(distDir, 'index.js'), entrypointContent, 'utf8');

console.log('[Build] Compiled JavaScript server build complete.');
console.log('[Build] Authoritative production entrypoint: dist/index.js');
