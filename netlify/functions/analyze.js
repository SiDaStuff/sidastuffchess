const { ServerStockfishEngine } = require('./_lib/stockfish-engine');
const { loadAnalyzer, loadChess } = require('./_lib/analysis-loader');
const { incrementPublicStats, claimUniqueBrilliantMoves } = require('./_lib/firebase-stats');

const SERVER_REVIEW_PROFILE = {
  depth: 14,
  multiPv: 2,
  timeoutMs: 5000,
};

let cachedEngine = null;
let cachedEngineInit = null;
let engineBusy = false;

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
	  if (positions.length > 1) {
	    return retryable('Server eval chunks are capped at 1 position.');
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

  const initialFen = payload.initialFen || payload.headers?.FEN || undefined;
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
	    if (positions.length > 0) {
	      const evals = await withEngineQueue(() => analyzer.evaluatePositions(positions, engine, null));
	      return json(200, {
	        evals,
	        depth: analyzer.analysisDepth,
	        multiPv: analyzer.multiPvCount,
	        source: 'netlify',
	      });
	    }

	    if (moves.length > 50) {
	      analyzer._mateThreat = () => null;
	    }
	    const results = await withEngineQueue(() => analyzer.analyzeGame(moves, engine, null, { initialFen, headers: payload.headers || {} }));
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
