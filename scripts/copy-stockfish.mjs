import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'node_modules', 'stockfish', 'bin');
const targetDir = path.join(rootDir, 'public', 'vendor', 'stockfish');

if (!existsSync(sourceDir)) {
  if (existsSync(targetDir)) {
    console.warn(`Stockfish package assets not found at ${sourceDir}. Keeping existing ${path.relative(rootDir, targetDir)} assets.`);
    process.exit(0);
  }
  throw new Error(`Stockfish assets not found at ${sourceDir}. Run npm install first.`);
}

mkdirSync(targetDir, { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true, errorOnExist: false });

console.log(`Copied Stockfish browser assets to ${path.relative(rootDir, targetDir)}`);
