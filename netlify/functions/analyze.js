const { ServerStockfishEngine } = require('./_lib/stockfish-engine');
const { loadAnalyzer, loadChess } = require('./_lib/analysis-loader');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
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
	    return json(413, { error: 'Server review is capped at 120 plies. Use browser review for longer games.' });
	  }
	  if (positions.length > 32) {
	    return json(413, { error: 'Server eval chunks are capped at 32 positions.' });
	  }
	
	  const Chess = loadChess();
		  const { MoveAnalyzer } = loadAnalyzer();
		  const analyzer = new MoveAnalyzer();
		  const profile = payload.profile || {};
		  const workSize = positions.length || moves.length;
		  const maxDepth = workSize > 80 ? 6 : workSize > 50 ? 8 : positions.length ? 8 : 14;
		  const maxTimeout = workSize > 80 ? 450 : workSize > 50 ? 700 : positions.length ? 900 : 9000;
		  analyzer.setReviewProfile({
		    depth: Math.max(6, Math.min(Number(profile.depth) || maxDepth, maxDepth)),
		    multiPv: Math.max(1, Math.min(Number(profile.multiPv) || 2, 3)),
		    timeoutMs: Math.max(180, Math.min(Number(profile.timeoutMs) || maxTimeout, maxTimeout)),
		  });

  const initialFen = payload.initialFen || payload.headers?.FEN || undefined;
  if (initialFen) {
    const validation = new Chess();
    if (!validation.load(initialFen)) {
      return json(400, { error: 'Invalid initial FEN.' });
    }
  }

	  const engine = new ServerStockfishEngine();
	  try {
	    await engine.init();
	    if (positions.length > 0) {
	      const evals = await analyzer.evaluatePositions(positions, engine, null);
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
	    const results = await analyzer.analyzeGame(moves, engine, null, { initialFen, headers: payload.headers || {} });
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
    });
  } catch (err) {
    console.error('Server analysis failed:', err);
    return json(500, { error: err.message || 'Server analysis failed.' });
  } finally {
    engine.destroy();
  }
};
