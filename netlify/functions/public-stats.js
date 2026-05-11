const { getPublicStats } = require('./_lib/firebase-stats');

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

    return json(405, { error: 'Use GET.' });
  } catch (err) {
    console.error('Public stats failed:', err);
    return json(500, { error: 'Stats are unavailable.' });
  }
};
