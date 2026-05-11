const { getPublicStats, incrementPublicStats } = require('./_lib/firebase-stats');

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': statusCode === 200 ? 'public, max-age=20' : 'no-store',
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const stats = await getPublicStats();
      return json(200, { stats });
    }

    if (event.httpMethod === 'POST') {
      let payload = {};
      try {
        payload = JSON.parse(event.body || '{}');
      } catch (_err) {
        return json(400, { error: 'Invalid JSON body.' });
      }

      const eventName = String(payload.event || '');
      const delta = {};
      if (eventName === 'coach_game_started') {
        delta.coachGamesPlayed = 1;
      } else if (eventName === 'game_reviewed') {
        delta.gamesAnalyzed = 1;
        delta.brilliantMoves = Math.max(0, Math.min(30, Number(payload.brilliantMoves) || 0));
      } else {
        return json(400, { error: 'Unknown stats event.' });
      }

      const stats = await incrementPublicStats(delta);
      return json(200, { stats });
    }

    return json(405, { error: 'Use GET or POST.' });
  } catch (err) {
    console.error('Public stats failed:', err);
    return json(500, { error: 'Stats are unavailable.' });
  }
};
