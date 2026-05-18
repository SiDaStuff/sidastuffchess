// Get puzzle from Lichess
/**
 * Fetch a puzzle from Lichess API
 */
async function fetchFromLichess(path, params = {}) {
  const url = new URL(`https://lichess.org${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Lichess returned ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get daily puzzle
 */
async function getDailyPuzzle(headers) {
  try {
    const data = await fetchFromLichess('/api/puzzle/daily');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data, source: 'Daily Lichess puzzle' }),
    };
  } catch (err) {
    console.error('Daily puzzle fetch error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Failed to fetch daily puzzle' }),
    };
  }
}

/**
 * Get next puzzle with difficulty
 */
async function getNextPuzzle(theme = 'mix', difficulty = 'normal', target = 1500, headers, exclude = '') {
  try {
    let puzzles = [];
    try {
      const batch = await fetchFromLichess(`/api/puzzle/batch/${encodeURIComponent(theme || 'mix')}`, {
        difficulty,
        nb: 10,
      });
      puzzles = Array.isArray(batch?.puzzles) ? batch.puzzles : [];
    } catch (_err) {
      puzzles = [];
    }
    
    let data;
    if (puzzles.length) {
      // Find a near-target puzzle, excluding the puzzle already on the board.
      const candidates = puzzles
        .filter((entry) => entry?.puzzle?.id !== exclude)
        .sort((a, b) =>
            Math.abs((a?.puzzle?.rating || 1500) - target) - 
            Math.abs((b?.puzzle?.rating || 1500) - target)
          );
      data = candidates.length
        ? candidates[Math.floor(Math.random() * Math.min(candidates.length, 3))]
        : await fetchFromLichess('/api/puzzle/next', {
          angle: theme,
          difficulty,
        });
    } else {
      data = await fetchFromLichess('/api/puzzle/next', { 
        angle: theme, 
        difficulty 
      });
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data,
        source: `Lichess ${theme === 'mix' ? 'mixed' : theme.replace(/([a-z])([A-Z])/g, '$1 $2')} puzzle`,
      }),
    };
  } catch (err) {
    console.error('Next puzzle fetch error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Failed to fetch next puzzle' }),
    };
  }
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
      const { type, theme, difficulty, target, exclude } = event.queryStringParameters || {};

    // GET /api/puzzle/daily - get daily puzzle
    if (event.httpMethod === 'GET' && type === 'daily') {
      return await getDailyPuzzle(headers);
    }

    // GET /api/puzzle/next - get next puzzle by difficulty
    if (event.httpMethod === 'GET' && type === 'next') {
      const result = await getNextPuzzle(
            theme || 'mix',
            difficulty || 'normal',
            target ? Number(target) : 1500,
            headers,
            exclude || ''
          );
      return result;
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Server error' }),
    };
  }
};
