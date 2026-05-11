const { ServerStockfishEngine } = require('./_lib/stockfish-engine');
const { loadAnalyzer, loadChess } = require('./_lib/analysis-loader');
const {
  getPublicStats,
  incrementPublicStats,
  claimUniqueBrilliantMoves,
  tryClaimReviewStats,
  putServerReviewChunk,
  getServerReviewChunks,
  clearServerReviewSession,
} = require('./_lib/firebase-stats');

const SERVER_REVIEW_PROFILE = {
  depth: 14,
  multiPv: 2,
  timeoutMs: 6000,
};
const SERVER_POSITION_BATCH_LIMIT = 8;

let cachedEngine = null;
let cachedEngineInit = null;
let engineBusy = false;
const evalCache = new Map();
const EVAL_CACHE_LIMIT = 800;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cacheGet(key) {
  if (!evalCache.has(key)) return null;
  const value = evalCache.get(key);
  evalCache.delete(key);
  evalCache.set(key, value);
  return cloneJson(value);
}

function cacheSet(key, value) {
  evalCache.set(key, cloneJson(value));
  while (evalCache.size > EVAL_CACHE_LIMIT) {
    evalCache.delete(evalCache.keys().next().value);
  }
}

function cachedEngineAdapter(engine) {
  return {
    get ready() {
      return engine.ready;
    },
    newGame: () => engine.newGame(),
    evaluate: async (fen, depth, timeoutMs) => {
      const key = `eval|${depth}|${fen}`;
      const cached = cacheGet(key);
      if (cached) return cached;
      const result = await engine.evaluate(fen, depth, timeoutMs);
      cacheSet(key, result);
      return result;
    },
    evaluateMultiPV: async (fen, depth, numPV, timeoutMs) => {
      const key = `multipv|${depth}|${numPV}|${fen}`;
      const cached = cacheGet(key);
      if (cached) return cached;
      const result = await engine.evaluateMultiPV(fen, depth, numPV, timeoutMs);
      cacheSet(key, result);
      return result;
    },
  };
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function getServerEngine() {
  if (cachedEngine?.ready) return cachedEngine;
  if (!cachedEngineInit) {
    cachedEngine = new ServerStockfishEngine();
    cachedEngineInit = cachedEngine.init().catch((err) => {
      try {
        cachedEngine?.destroy();
      } catch (_destroyErr) {
        // Ignore teardown failures after a failed init.
      }
      cachedEngine = null;
      cachedEngineInit = null;
      throw err;
    });
  }
  await cachedEngineInit;
  return cachedEngine;
}

function withEngineQueue(work) {
  if (engineBusy) {
    throw new Error('Server engine is busy. Retrying shortly.');
  }
  engineBusy = true;
  return Promise.resolve()
    .then(work)
    .finally(() => {
      engineBusy = false;
    });
}

function brilliantMoveKey(entry) {
  if (!entry || entry.classificationKey !== 'BRILLIANT' || !entry.fen || !entry.moveUci) return '';
  const positionKey = String(entry.fen).split(/\s+/).slice(0, 4).join(' ');
  return `${positionKey}|${entry.moveUci}`;
}

function reviewStatsKey(statsReview = {}) {
  const moves = Array.isArray(statsReview.moves) ? statsReview.moves.join(' ') : '';
  const initialFen = statsReview.initialFen || '';
  const reviewId = statsReview.reviewId || '';
  return `${reviewId}|${initialFen}|${moves}`;
}

function collectStoredEvals(chunks = {}, totalPositions = 0) {
  const evals = new Array(totalPositions);
  for (const chunk of Object.values(chunks || {})) {
    const start = Math.max(0, Math.floor(Number(chunk?.start) || 0));
    const chunkEvals = Array.isArray(chunk?.evals) ? chunk.evals : [];
    chunkEvals.forEach((entry, offset) => {
      if (start + offset < evals.length) evals[start + offset] = entry;
    });
  }
  return evals;
}

async function recordChunkedReviewStats({ statsReview, chunkStart, evals, analyzer, initialFen }) {
  if (!statsReview || !Array.isArray(statsReview.moves) || statsReview.moves.length === 0) return null;
  const totalPositions = Math.max(0, Math.floor(Number(statsReview.totalPositions) || 0));
  if (!totalPositions) return null;

  const key = reviewStatsKey(statsReview);
  await putServerReviewChunk(key, {
    start: chunkStart,
    evals,
  });

  const chunks = await getServerReviewChunks(key);
  const allEvals = collectStoredEvals(chunks, totalPositions);
  if (allEvals.some((entry) => !entry)) return null;

  const moves = statsReview.moves;
  const positions = analyzer._positionsForMoves(moves, initialFen);
  if (positions.length !== allEvals.length) return getPublicStats();

  const claimed = await tryClaimReviewStats(key);
  if (!claimed) {
    return getPublicStats();
  }

  const opening = analyzer.detectOpening(moves);
  const results = analyzer.resultsFromEvals(
    moves,
    positions,
    allEvals,
    opening,
    { initialFen, headers: statsReview.headers || {}, skipMateThreat: true }
  );
  const brilliantMoveKeys = results.map(brilliantMoveKey).filter(Boolean);
  const brilliantMoves = await claimUniqueBrilliantMoves(brilliantMoveKeys);
  const publicStats = await incrementPublicStats({ movesAnalyzed: moves.length, brilliantMoves });
  clearServerReviewSession(key).catch((err) => {
    console.warn('Could not clear server review session:', err.message);
  });
  return publicStats;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

function retryable(message) {
  return json(200, { error: message, retryable: true });
}

exports.handler = async (event, context = {}) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Use POST.' });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_err) {
    return json(400, { error: 'Invalid JSON body.' });
  }

	  const moves = Array.isArray(payload.moves) ? payload.moves : [];
	  const positions = Array.isArray(payload.positions) ? payload.positions : [];
	  if (moves.length === 0 && positions.length === 0) {
	    return json(400, { error: 'No moves were provided.' });
	  }
	  if (moves.length > 120) {
	    return retryable('Server review is capped at 120 plies.');
	  }
	  if (moves.length > 3) {
	    return retryable('Server full-game review is capped at 3 plies. Use server eval chunks for longer games.');
	  }
	  if (positions.length > SERVER_POSITION_BATCH_LIMIT) {
	    return retryable(`Server eval chunks are capped at ${SERVER_POSITION_BATCH_LIMIT} positions.`);
	  }
	
	  const Chess = loadChess();
		  const { MoveAnalyzer } = loadAnalyzer();
		  const analyzer = new MoveAnalyzer();
		  const profile = payload.profile || {};
		  analyzer.setReviewProfile({
		    depth: SERVER_REVIEW_PROFILE.depth,
		    multiPv: positions.length
		      ? Math.max(1, Math.min(Number(profile.multiPv) || 1, 2))
		      : SERVER_REVIEW_PROFILE.multiPv,
		    timeoutMs: SERVER_REVIEW_PROFILE.timeoutMs,
		  });

  const initialFen = payload.initialFen || payload.headers?.FEN || payload.statsReview?.initialFen || undefined;
  if (initialFen) {
    const validation = new Chess();
    if (!validation.load(initialFen)) {
      return json(400, { error: 'Invalid initial FEN.' });
    }
  }

	  try {
		    const engine = await withTimeout(
		      getServerEngine(),
		      8000,
		      'Server engine is still warming up.'
		    );
		    const reviewEngine = cachedEngineAdapter(engine);
	    if (positions.length > 0) {
	      const evals = await withEngineQueue(() => analyzer.evaluatePositions(positions, reviewEngine, null));
	      let publicStats = null;
	      try {
	        publicStats = await recordChunkedReviewStats({
	          statsReview: payload.statsReview,
	          chunkStart: Math.max(0, Math.floor(Number(payload.chunkStart) || 0)),
	          evals,
	          analyzer,
	          initialFen,
	        });
	      } catch (err) {
	        console.warn('Could not update chunked review stats:', err.message);
	      }
	      return json(200, {
	        evals,
	        depth: analyzer.analysisDepth,
	        multiPv: analyzer.multiPvCount,
	        source: 'netlify',
	        publicStats,
	      });
	    }

	    if (moves.length > 50) {
	      analyzer._mateThreat = () => null;
	    }
	    const results = await withEngineQueue(() => analyzer.analyzeGame(moves, reviewEngine, null, { initialFen, headers: payload.headers || {} }));
	    const brilliantMoveKeys = results.map(brilliantMoveKey).filter(Boolean);
	    let publicStats = null;
	    try {
	      const brilliantMoves = await claimUniqueBrilliantMoves(brilliantMoveKeys);
	      publicStats = await incrementPublicStats({ movesAnalyzed: moves.length, brilliantMoves });
	    } catch (err) {
	      console.warn('Could not update public stats:', err.message);
	    }
    const plainResults = results.map((entry) => ({
      ...entry,
      classification: undefined,
      classificationKey: entry.classificationKey,
    }));
    const criticalMoments = (results.criticalMoments || []).map((entry) => ({
      ...entry,
      classification: undefined,
      classificationKey: entry.classificationKey,
    }));

    return json(200, {
	      results: plainResults,
	      opening: results.opening,
	      openingDrift: results.openingDrift,
	      trainingQueue: results.trainingQueue,
	      patternStats: results.patternStats,
	      reviewNarrative: results.reviewNarrative,
	      criticalMoments,
      whiteAccuracy: results.whiteAccuracy,
      blackAccuracy: results.blackAccuracy,
      whiteAcpl: results.whiteAcpl,
      blackAcpl: results.blackAcpl,
      whiteCaps: results.whiteCaps,
      blackCaps: results.blackCaps,
      phaseSummary: results.phaseSummary,
      depth: analyzer.analysisDepth,
      multiPv: analyzer.multiPvCount,
      source: 'netlify',
      publicStats,
    });
  } catch (err) {
    console.error('Server analysis failed:', err);
    if (/cancelled|not ready|timed out waiting|out of memory|abort/i.test(String(err?.message || err))) {
      try {
        cachedEngine?.destroy();
      } catch (_destroyErr) {
        // Ignore teardown failures while recovering the cached engine.
      }
      cachedEngine = null;
      cachedEngineInit = null;
    }
    return retryable(err.message || 'Server analysis failed.');
  }
};
