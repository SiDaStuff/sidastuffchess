const fs = require('fs');
const path = require('path');
const initStockfish = require('stockfish');

function stockfishEnginePath() {
  let packageRoot = '';
  try {
    packageRoot = path.dirname(require.resolve('stockfish/package.json'));
  } catch (_err) {
    packageRoot = path.resolve(process.cwd(), 'node_modules/stockfish');
  }
  const preferFullEngine = String(process.env.SERVER_STOCKFISH_ENGINE || '').toLowerCase() === 'full';
  const engineFiles = preferFullEngine
    ? ['stockfish-18-single.js', 'stockfish-18-lite-single.js']
    : ['stockfish-18-lite-single.js', 'stockfish-18-single.js'];
  // Look in a few extra locations: vendored copies under server/vendor,
  // public/vendor (copied by the build script), and several node_modules roots.
  const roots = [
    packageRoot ? path.join(packageRoot, 'bin') : '',
    path.resolve(__dirname, '../vendor/stockfish'), // server/vendor/stockfish
    path.resolve(__dirname, '../../public/vendor/stockfish'), // project public/vendor/stockfish
    path.resolve(__dirname, '../../node_modules/stockfish/bin'),
    path.resolve(__dirname, '../../../node_modules/stockfish/bin'),
    path.resolve(process.cwd(), 'node_modules/stockfish/bin'),
    path.resolve(process.cwd(), 'public/vendor/stockfish'),
  ].filter(Boolean);
  const candidates = roots.flatMap((root) => engineFiles.map((file) => path.join(root, file)));
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Cannot find a server Stockfish engine. Checked: ${candidates.join(', ')}`);
  }
  return found;
}

class ServerStockfishEngine {
  constructor() {
    this.engine = null;
    this.ready = false;
      this.handlers = [];
      this.history = [];
      this.activeSearch = null;
      this.currentMultiPv = 1;
  }

    async init() {
      const enginePath = stockfishEnginePath();
      delete require.cache[require.resolve(enginePath)];
      this.engine = await initStockfish(enginePath);
    this.engine.listener = (line) => this._handleLine(line);
    await this._uci();
    await this.configure();
    this.ready = true;
  }

  _send(command) {
    this.engine.sendCommand(command);
  }

  _handleLine(payload) {
    for (const raw of String(payload || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      this.history.push(line);
      if (this.history.length > 80) this.history.shift();
      for (const handler of [...this.handlers]) handler(line);
    }
  }

  _waitFor(token, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const handler = (line) => {
        if (!line.includes(token)) return;
        clearTimeout(timer);
        this._removeHandler(handler);
        resolve(line);
      };

      timer = setTimeout(() => {
        this._removeHandler(handler);
        reject(new Error(`Timed out waiting for ${token}`));
      }, timeoutMs);

      this._addHandler(handler);
    });
  }

  _addHandler(handler) {
    this.handlers.push(handler);
  }

  _removeHandler(handler) {
    this.handlers = this.handlers.filter((entry) => entry !== handler);
  }

  async _uci() {
    const wait = this._waitFor('uciok', 20000);
    this._send('uci');
    await wait;
  }

  async configure() {
    this._cancelActiveSearch();
    this._send('stop');
      this._send('setoption name Hash value 16');
      this._send('setoption name Threads value 1');
      this._send('setoption name MultiPV value 1');
      this.currentMultiPv = 1;
    const wait = this._waitFor('readyok', 12000);
    this._send('isready');
    await wait;
  }

  async newGame() {
    this._cancelActiveSearch();
    this._send('stop');
    this._send('ucinewgame');
    const wait = this._waitFor('readyok', 12000);
    this._send('isready');
    await wait;
  }

    async _ensureMultiPv(numPV = 1) {
      const next = Math.max(1, Math.floor(Number(numPV) || 1));
      if (this.currentMultiPv === next) return;
      this._send(`setoption name MultiPV value ${next}`);
      this.currentMultiPv = next;
      const wait = this._waitFor('readyok', 3000);
      this._send('isready');
      await wait;
    }

    async evaluate(fen, depth = 14, timeoutMs = 6000) {
      if (!this.ready) throw new Error('Engine not ready');
      this._cancelActiveSearch();
      this._send('stop');
      await this._ensureMultiPv(1);

    return new Promise((resolve, reject) => {
      let bestInfo = null;
      let timer = null;
      let hardTimer = null;
      let settled = false;

      const finish = (bestMove = '') => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (hardTimer) clearTimeout(hardTimer);
        this._removeHandler(handler);
        if (this.activeSearch?.handler === handler) this.activeSearch = null;
        resolve({
          score: bestInfo ? bestInfo.score : 0,
          scoreType: bestInfo ? bestInfo.scoreType : 'cp',
          bestMove,
          pv: bestInfo ? bestInfo.pv : '',
          depth: bestInfo ? bestInfo.depth : 0,
          timedOut: !bestMove,
        });
      };

      const handler = (line) => {
        if (line.startsWith('info') && line.includes('depth')) {
          const info = this._parseInfo(line);
          if (info.depth) bestInfo = info;
        }

        if (line.startsWith('bestmove')) {
          finish(line.split(' ')[1] || '');
        }
      };

      timer = setTimeout(() => {
        this._send('stop');
        hardTimer = setTimeout(() => finish(bestInfo?.pv?.split(/\s+/).filter(Boolean)[0] || ''), 900);
        if (this.activeSearch?.handler === handler) this.activeSearch.hardTimer = hardTimer;
      }, timeoutMs);
      this._addHandler(handler);
      this.activeSearch = { handler, timer, hardTimer, reject };
      this._send(`position fen ${fen}`);
      this._send(`go depth ${depth}`);
    });
  }

    async evaluateMultiPV(fen, depth = 14, numPV = 3, timeoutMs = 6000) {
      if (!this.ready) throw new Error('Engine not ready');
      this._cancelActiveSearch();
      this._send('stop');
      await this._ensureMultiPv(numPV);

    return new Promise((resolve, reject) => {
      const pvResults = {};
      let timer = null;
      let hardTimer = null;
      let settled = false;

      const finish = (bestMove = '') => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (hardTimer) clearTimeout(hardTimer);
        this._removeHandler(handler);
        if (this.activeSearch?.handler === handler) this.activeSearch = null;
        const lines = [];
        for (let i = 1; i <= numPV; i += 1) {
          if (pvResults[i]) lines.push(pvResults[i]);
        }
        resolve({
          lines,
          bestMove: bestMove || lines[0]?.pv?.split(/\s+/).filter(Boolean)[0] || '',
          timedOut: !bestMove,
        });
      };

      const handler = (line) => {
        if (line.startsWith('info') && line.includes('depth') && line.includes(' pv ')) {
          const info = this._parseInfo(line);
          if (info.multipv) {
            const existing = pvResults[info.multipv];
            if (!existing || (info.depth || 0) >= (existing.depth || 0)) {
              pvResults[info.multipv] = info;
            }
          }
        }

        if (line.startsWith('bestmove')) {
          finish(line.split(' ')[1] || '');
        }
      };

      timer = setTimeout(() => {
        this._send('stop');
        hardTimer = setTimeout(() => finish(), 900);
        if (this.activeSearch?.handler === handler) this.activeSearch.hardTimer = hardTimer;
      }, timeoutMs);
      this._addHandler(handler);
      this.activeSearch = { handler, timer, hardTimer, reject };
      this._send(`position fen ${fen}`);
      this._send(`go depth ${depth}`);
    });
  }

  _cancelActiveSearch() {
    if (!this.activeSearch) return;
    const { handler, timer, hardTimer, reject } = this.activeSearch;
    if (timer) clearTimeout(timer);
    if (hardTimer) clearTimeout(hardTimer);
    this._removeHandler(handler);
    this.activeSearch = null;
    if (reject) reject(new Error('Search cancelled'));
  }

  _parseInfo(line) {
    const result = {};
    const depthMatch = line.match(/\bdepth (\d+)/);
    if (depthMatch) result.depth = parseInt(depthMatch[1], 10);
    const multipvMatch = line.match(/\bmultipv (\d+)/);
    if (multipvMatch) result.multipv = parseInt(multipvMatch[1], 10);
    const cpMatch = line.match(/\bscore cp (-?\d+)/);
    const mateMatch = line.match(/\bscore mate (-?\d+)/);
    if (cpMatch) {
      result.score = parseInt(cpMatch[1], 10);
      result.scoreType = 'cp';
    } else if (mateMatch) {
      result.score = parseInt(mateMatch[1], 10);
      result.scoreType = 'mate';
    }
    const pvMatch = line.match(/\bpv (.+)$/);
    if (pvMatch) result.pv = pvMatch[1].trim();
    return result;
  }

  destroy() {
    this._cancelActiveSearch();
    if (this.engine) {
      try {
        this._send('quit');
      } catch (_err) {
        // Ignore shutdown failures in serverless teardown.
      }
    }
    this.ready = false;
  }
}

module.exports = { ServerStockfishEngine };
