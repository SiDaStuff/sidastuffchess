const ENGINE_CATALOG = Object.freeze({
  browser: {
    label: 'Browser',
	    modules: [
	      {
	        key: 'lite-single',
	        label: 'Stockfish 18 Lite',
	        engineLabel: 'Stockfish 18 Lite',
	        jsPath: './vendor/stockfish/stockfish-18-lite-single.js',
	        wasmPath: './vendor/stockfish/stockfish-18-lite-single.wasm',
	        hash: 32,
	        threads: 1,
	        supportsThreads: false,
	        downloadLabel: '7mb download',
	      },
	      {
	        key: 'full-single',
	        label: 'Stockfish 18',
	        engineLabel: 'Stockfish 18',
	        jsPath: './vendor/stockfish/stockfish-18-single.js',
	        wasmPath: './vendor/stockfish/stockfish-18-single.wasm',
	        hash: 64,
	        threads: 1,
	        supportsThreads: false,
	        downloadLabel: '108mb download',
	      },
	    ],
	  },
});

const REVIEW_PROFILES = Object.freeze({
  depth10: { key: 'depth10', label: 'Depth 10', depth: 10, multiPv: 2, timeoutMs: 8000, battleDepth: 8 },
  depth14: { key: 'depth14', label: 'Depth 14', depth: 14, multiPv: 3, timeoutMs: 12000, battleDepth: 10 },
  depth18: { key: 'depth18', label: 'Depth 18', depth: 18, multiPv: 3, timeoutMs: 15000, battleDepth: 12 },
  depth22: { key: 'depth22', label: 'Depth 22', depth: 22, multiPv: 4, timeoutMs: 18000, battleDepth: 14 },
  depth26: { key: 'depth26', label: 'Depth 26', depth: 26, multiPv: 5, timeoutMs: 22000, battleDepth: 16 },
});

function getEngineModules(source) {
  return ENGINE_CATALOG[source]?.modules || ENGINE_CATALOG.browser.modules;
}

function getEngineModuleConfig(source, moduleKey) {
  const modules = getEngineModules(source);
  return modules.find((entry) => entry.key === moduleKey) || modules[0];
}

function getReviewProfileConfig(profileKey) {
  return REVIEW_PROFILES[profileKey] || REVIEW_PROFILES.depth14;
}

class UciEngine {
  constructor(moduleConfig) {
    this.moduleConfig = moduleConfig;
    this.ready = false;
    this.messageQueue = [];
    this.messageHistory = [];
    this.activeSearch = null;
    this.operationChain = Promise.resolve();
  }

  get displayName() {
    return this.moduleConfig.engineLabel;
  }

  _send(_cmd) {
    throw new Error('_send must be implemented by subclasses');
  }

  _failActiveSearch(error) {
    if (!this.activeSearch) return;
    const { handler, timer, hardTimer, reject } = this.activeSearch;
    if (timer) clearTimeout(timer);
    if (hardTimer) clearTimeout(hardTimer);
    this._removeMessageHandler(handler);
    this.activeSearch = null;
    if (reject) reject(error);
  }

  _handleTransportMessage(payload) {
    const lines = String(payload || '').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        this.messageHistory.push(trimmed);
        if (this.messageHistory.length > 50) {
          this.messageHistory.shift();
        }
        this._handleMessage(trimmed);
      }
    }
  }

  _waitFor(keyword, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const handler = (msg) => {
        if (msg && msg.includes(keyword)) {
          if (timer) clearTimeout(timer);
          this._removeMessageHandler(handler);
          resolve(msg);
        }
      };

      timer = setTimeout(() => {
        this._removeMessageHandler(handler);
        reject(new Error(`Timed out waiting for ${keyword}`));
      }, timeoutMs);

      this._addMessageHandler(handler);
    });
  }

  _addMessageHandler(fn) {
    this.messageQueue.push(fn);
  }

  _removeMessageHandler(fn) {
    this.messageQueue = this.messageQueue.filter((handler) => handler !== fn);
  }

  _handleMessage(msg) {
    [...this.messageQueue].forEach((handler) => handler(msg));
  }

  async _initializeUci() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const waitForUciOk = this._waitFor('uciok', 30000);
      this._send('uci');
      try {
        await waitForUciOk;
        this.ready = true;
        await this.configure();
        return;
      } catch (err) {
        if (attempt === 1) throw err;
      }
    }
  }

  async configure() {
    if (!this.ready) return;

    this._cancelActiveSearch();
    this._send('stop');
    this._send('setoption name MultiPV value 1');
    this._send(`setoption name Hash value ${this.moduleConfig.hash || 32}`);

    if (this.moduleConfig.supportsThreads) {
      this._send(`setoption name Threads value ${this.moduleConfig.threads || 1}`);
    }

    const waitForReady = this._waitFor('readyok');
    this._send('isready');
    await waitForReady;
  }

  async newGame() {
    this._cancelActiveSearch();
    this._send('stop');
    this._send('ucinewgame');
    const waitForReady = this._waitFor('readyok');
    this._send('isready');
    await waitForReady;
  }

  async evaluate(fen, depth = 18, timeoutMs = 30000) {
    return this._runExclusive(() => this._evaluate(fen, depth, timeoutMs));
  }

  async _evaluate(fen, depth = 18, timeoutMs = 30000) {
    if (!this.ready) throw new Error('Engine not ready');

    this._cancelActiveSearch();
    this._safeStop();
    const waitForReady = this._waitFor('readyok', Math.min(3000, timeoutMs));
    this._send('isready');
    await waitForReady;

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
        this._removeMessageHandler(handler);
        if (this.activeSearch?.handler === handler) {
          this.activeSearch = null;
        }
        resolve({
          score: bestInfo ? bestInfo.score : 0,
          scoreType: bestInfo ? bestInfo.scoreType : 'cp',
          bestMove,
          pv: bestInfo ? bestInfo.pv : '',
          depth: bestInfo ? bestInfo.depth : 0,
          timedOut: !bestMove,
        });
      };

      const handler = (msg) => {
        if (msg.startsWith('info') && msg.includes('depth')) {
          const info = this._parseInfo(msg);
          if (info && info.depth) {
            bestInfo = info;
          }
        }

        if (msg.startsWith('bestmove')) {
          finish(msg.split(' ')[1] || '');
        }
      };

      timer = setTimeout(() => {
        this._safeStop();
        hardTimer = setTimeout(() => finish(bestInfo?.pv?.split(/\s+/).filter(Boolean)[0] || ''), 900);
        if (this.activeSearch?.handler === handler) this.activeSearch.hardTimer = hardTimer;
      }, timeoutMs);

      this._addMessageHandler(handler);
      this.activeSearch = { handler, timer, hardTimer, reject };
      this._send(`position fen ${fen}`);
      this._send(`go depth ${depth}`);
    });
  }

  async evaluateMultiPV(fen, depth = 18, numPV = 3, timeoutMs = 20000) {
    return this._runExclusive(() => this._evaluateMultiPV(fen, depth, numPV, timeoutMs));
  }

  async _evaluateMultiPV(fen, depth = 18, numPV = 3, timeoutMs = 20000) {
    if (!this.ready) throw new Error('Engine not ready');

    this._cancelActiveSearch();
    this._safeStop();
    this._send(`setoption name MultiPV value ${numPV}`);
    const waitForReady = this._waitFor('readyok', 3000);
    this._send('isready');
    await waitForReady;

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
        this._removeMessageHandler(handler);
        if (this.activeSearch?.handler === handler) {
          this.activeSearch = null;
        }
        this._send('setoption name MultiPV value 1');

        const results = [];
        for (let i = 1; i <= numPV; i += 1) {
          if (pvResults[i]) {
            results.push(pvResults[i]);
          }
        }

        resolve({
          lines: results,
          bestMove: bestMove || results[0]?.pv?.split(/\s+/).filter(Boolean)[0] || '',
          timedOut: !bestMove,
        });
      };

      const handler = (msg) => {
        if (msg.startsWith('info') && msg.includes('depth') && msg.includes(' pv ')) {
          const info = this._parseInfo(msg);
          if (info && info.multipv) {
            const existing = pvResults[info.multipv];
            if (!existing || (info.depth || 0) >= (existing.depth || 0)) {
              pvResults[info.multipv] = info;
            }
          }
        }

        if (msg.startsWith('bestmove')) {
          finish(msg.split(' ')[1] || '');
        }
      };

      timer = setTimeout(() => {
        this._safeStop();
        hardTimer = setTimeout(() => finish(), 900);
        if (this.activeSearch?.handler === handler) this.activeSearch.hardTimer = hardTimer;
      }, timeoutMs);

      this._addMessageHandler(handler);
      this.activeSearch = { handler, timer, hardTimer, reject };
      this._send(`position fen ${fen}`);
      this._send(`go depth ${depth}`);
    });
  }

  _runExclusive(task) {
    const run = this.operationChain.catch(() => {}).then(task);
    this.operationChain = run.catch(() => {});
    return run;
  }

  _safeStop() {
    try {
      this._send('stop');
    } catch (error) {
      this._failActiveSearch(error);
    }
  }

  interrupt() {
    this._cancelActiveSearch();
    this._safeStop();
  }

  _cancelActiveSearch() {
    if (!this.activeSearch) return;
    const { handler, timer, hardTimer, reject } = this.activeSearch;
    if (timer) clearTimeout(timer);
    if (hardTimer) clearTimeout(hardTimer);
    this._removeMessageHandler(handler);
    this.activeSearch = null;
    if (reject) reject(new Error('Search cancelled'));
  }

  _parseInfo(line) {
    const result = {};

    const depthMatch = line.match(/\bdepth (\d+)/);
    if (depthMatch) result.depth = parseInt(depthMatch[1], 10);

    const seldepthMatch = line.match(/\bseldepth (\d+)/);
    if (seldepthMatch) result.seldepth = parseInt(seldepthMatch[1], 10);

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

    const nodesMatch = line.match(/\bnodes (\d+)/);
    if (nodesMatch) result.nodes = parseInt(nodesMatch[1], 10);

    const npsMatch = line.match(/\bnps (\d+)/);
    if (npsMatch) result.nps = parseInt(npsMatch[1], 10);

    return result;
  }

  stop() {
    this._safeStop();
  }
}

class BrowserStockfishEngine extends UciEngine {
  constructor(moduleConfig) {
    super(moduleConfig);
    this.worker = null;
    this.crashedError = null;
  }

  _workerUrl() {
    // Stockfish.js resolves the wasm beside the worker script when no custom
    // locateFile hash is provided, which is the most reliable browser setup.
    return new URL(this.moduleConfig.jsPath, window.location.href).href;
  }

  async init() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let initTimer = null;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        if (initTimer) clearTimeout(initTimer);
        reject(error);
      };

      if (this.moduleConfig.requiresIsolation && !window.crossOriginIsolated) {
        fail(new Error('This browser engine type requires cross-origin isolation.'));
        return;
      }

      try {
        this.worker = new Worker(this._workerUrl());
      } catch (error) {
        fail(error);
        return;
      }

      this.worker.onmessage = (event) => {
        this._handleTransportMessage(event.data);
      };

      this.worker.onerror = (event) => {
        const error = new Error(event?.message || 'Browser Stockfish crashed');
        this.crashedError = error;
        this.ready = false;
        this._failActiveSearch(error);
        fail(error);
      };

      this.worker.onmessageerror = () => {
        const error = new Error('Browser Stockfish sent an unreadable message');
        this.crashedError = error;
        this.ready = false;
        this._failActiveSearch(error);
        fail(error);
      };

      this._initializeUci().then(() => {
        if (initTimer) clearTimeout(initTimer);
        settled = true;
        resolve();
      }).catch(fail);

      initTimer = setTimeout(() => fail(new Error('Browser engine timed out during init')), 120000);
    });
  }

  _send(cmd) {
    if (this.crashedError) {
      throw this.crashedError;
    }
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  destroy() {
    this._cancelActiveSearch();
    this.ready = false;
    if (this.worker) {
      try {
        this.worker.postMessage('quit');
      } catch (_error) {
        // Ignore shutdown errors on browser workers.
      }
      this.worker.terminate();
      this.worker = null;
    }
  }
}

function createEngineController({ source, module }) {
  const moduleConfig = getEngineModuleConfig(source, module);
  return new BrowserStockfishEngine(moduleConfig);
}
