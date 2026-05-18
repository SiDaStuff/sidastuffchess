const {
  getPublicStats,
  incrementPublicStats,
  claimUniqueBrilliantMoves,
  tryClaimRateLimit,
} = require('./_lib/firebase-stats');

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': statusCode === 200 ? 'public, max-age=20' : 'no-store',
  },
  body: JSON.stringify(body),
});

function clientIp(event) {
  return String(
    event.headers['x-nf-client-connection-ip']
    || event.headers['client-ip']
    || event.headers['x-forwarded-for']
    || ''
  ).split(',')[0].trim() || 'unknown';
}

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
      const ip = clientIp(event);
      if (eventName === 'coach_game_started') {
        const allowed = await tryClaimRateLimit('coach_game_started', ip);
        const stats = allowed
          ? await incrementPublicStats({ coachGamesPlayed: 1 })
          : await getPublicStats();
        return json(200, { stats, counted: allowed });
      }

      if (eventName === 'puzzle_solved') {
        const allowed = await tryClaimRateLimit('puzzle_solved', ip, 30 * 1000);
        const stats = allowed
          ? await incrementPublicStats({ puzzlesSolved: 1 })
          : await getPublicStats();
        return json(200, { stats, counted: allowed });
      }

      if (eventName === 'brilliant_move') {
        const allowed = await tryClaimRateLimit('brilliant_move', ip);
        let stats = await getPublicStats();
        if (allowed) {
          const claimed = await claimUniqueBrilliantMoves([payload.brilliantMoveKey || payload.brilliantMove || '']);
          stats = claimed
            ? await incrementPublicStats({ brilliantMoves: claimed })
            : await getPublicStats();
        }
        return json(200, { stats, counted: allowed });
      }

      return json(400, { error: 'Unknown stats event.' });
    }

    return json(405, { error: 'Use GET or POST.' });
  } catch (err) {
    console.error('Public stats failed:', err);
    return json(500, { error: 'Stats are unavailable.' });
  }
};
