const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

const ENGINE_DIR = path.join(__dirname, 'engine');
const STOCKFISH_EXE = path.join(ENGINE_DIR, 'stockfish.exe');
const STOCKFISH_ZIP_URL = 'https://github.com/official-stockfish/Stockfish/releases/download/sf_17.1/stockfish-windows-x86-64.zip';
const STOCKFISH_ZIP = path.join(ENGINE_DIR, 'stockfish.zip');

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          fs.unlink(dest, () => {});
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(resolve); });
      }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    };
    request(url);
  });
}

async function ensureStockfish() {
  if (fs.existsSync(STOCKFISH_EXE)) {
    console.log('Stockfish binary found.');
    return;
  }
  fs.mkdirSync(ENGINE_DIR, { recursive: true });
  console.log('Downloading Stockfish...');
  await download(STOCKFISH_ZIP_URL, STOCKFISH_ZIP);
  console.log('Extracting Stockfish...');

  // Use PowerShell to extract zip
  const { execSync } = require('child_process');
  execSync(`powershell -Command "Expand-Archive -Path '${STOCKFISH_ZIP}' -DestinationPath '${ENGINE_DIR}' -Force"`, { stdio: 'inherit' });

  // Find the exe inside the extracted folder
  const found = findFile(ENGINE_DIR, 'stockfish-windows-x86-64.exe') || findFile(ENGINE_DIR, 'stockfish.exe');
  if (found && found !== STOCKFISH_EXE) {
    fs.copyFileSync(found, STOCKFISH_EXE);
  }
  // Cleanup zip
  fs.unlinkSync(STOCKFISH_ZIP);
  if (!fs.existsSync(STOCKFISH_EXE)) {
    throw new Error('Could not find stockfish exe after extraction');
  }
  console.log('Stockfish ready.');
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name.toLowerCase() === name.toLowerCase()) {
      return full;
    }
  }
  return null;
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/stockfish', express.static(path.join(__dirname, 'public', 'vendor', 'stockfish')));
app.use('/vendor/stockfish', express.static(path.join(__dirname, 'node_modules', 'stockfish', 'bin')));

function spawnStockfish() {
  const proc = spawn(STOCKFISH_EXE, { stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stderr.on('data', (d) => console.error('SF stderr:', d.toString()));
  return proc;
}

async function startServer() {
  await ensureStockfish();

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/engine' });

  wss.on('connection', (ws) => {
    const sf = spawnStockfish();
    let alive = true;

    sf.stdout.on('data', (data) => {
      if (!alive) return;
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          ws.send(trimmed);
        }
      }
    });

    sf.on('close', () => {
      alive = false;
      if (ws.readyState === ws.OPEN) ws.close();
    });

    sf.on('error', (err) => {
      console.error('Stockfish process error:', err);
      alive = false;
      if (ws.readyState === ws.OPEN) ws.close();
    });

    ws.on('message', (msg) => {
      if (!alive) return;
      const cmd = msg.toString().trim();
      sf.stdin.write(cmd + '\n');
    });

    ws.on('close', () => {
      alive = false;
      sf.stdin.end();
      sf.kill();
    });
  });

  server.listen(PORT, () => {
    console.log(`Chess Review running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
