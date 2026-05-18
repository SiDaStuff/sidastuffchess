// Record puzzle attempt and update rating in real-time database
let admin;
try {
  admin = require('firebase-admin');
} catch (err) {
  console.error('Firebase Admin SDK not available');
}

let db = null;

// Initialize Firebase Admin SDK if available and not already initialized
function initializeFirebase() {
    if (db) return db;
    if (!admin) return null;
    if (admin.apps?.length) {
      db = admin.database();
      return db;
    }
  
  try {
    const serviceAccount = process.env.SERVICE_ACCOUNT 
      ? JSON.parse(process.env.SERVICE_ACCOUNT)
      : null;
    
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.REALTIME_DATABASE_URL,
      });
      db = admin.database();
    }
  } catch (err) {
    console.error('Failed to initialize Firebase:', err.message);
  }
  return db;
}

// Minimal REST helper for Realtime Database to avoid firebase-admin dependency at runtime
const https = require('https');
function restRequest(method, url, data) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const options = {
        method,
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ''),
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsedBody = body ? JSON.parse(body) : null;
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsedBody);
            else reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => reject(err));
      if (data !== undefined) req.write(JSON.stringify(data));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function restWrite(path, value) {
  const base = process.env.REALTIME_DATABASE_URL;
  const secret = process.env.REALTIME_DATABASE_SECRET;
  if (!base) throw new Error('REALTIME_DATABASE_URL not configured');
  const url = `${base.replace(/\/$/, '')}/${path}.json${secret ? `?auth=${encodeURIComponent(secret)}` : ''}`;
  return restRequest('PUT', url, value);
}

/**
 * Calculate rating change based on puzzle rating and result
 */
function calculateRatingDelta(puzzleRating, userRating, won) {
  const expectedScore = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
  const delta = Math.round(24 * ((won ? 1 : 0) - expectedScore));
  return delta;
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Initialize Firebase (admin) if available; otherwise we'll try REST fallback.
    const database = initializeFirebase();
    const useRest = !database && !!process.env.REALTIME_DATABASE_URL;
    if (!database && !useRest) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Database service unavailable' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { userId, puzzleRating, userRating, won, puzzleId } = body;

    if (!userId || puzzleRating === undefined || userRating === undefined || won === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: userId, puzzleRating, userRating, won' }),
      };
    }

    // Simple flow: compute delta using provided userRating, set profile.puzzleRating, and append a history entry.
    const currentRating = Math.max(100, Number(userRating) || 1500);
    const delta = calculateRatingDelta(Number(puzzleRating), currentRating, Boolean(won));
    const newRating = Math.max(100, currentRating + delta);

    if (!useRest) {
      // Admin SDK path: minimal updates
      const profileRef = database.ref(`users/${userId}/profile`);
      await profileRef.update({ puzzleRating: newRating, updatedAt: admin.database.ServerValue.TIMESTAMP });
      if (puzzleId) {
        const historyRef = database.ref(`users/${userId}/puzzleHistory/${Date.now()}`);
        await historyRef.set({ puzzleId, puzzleRating, won, delta, ratingAfter: newRating, timestamp: admin.database.ServerValue.TIMESTAMP });
      }
    } else {
      // REST fallback: PATCH profile and PUT history
      await restRequest('PATCH', `${process.env.REALTIME_DATABASE_URL.replace(/\/$/, '')}/users/${encodeURIComponent(userId)}/profile.json${process.env.REALTIME_DATABASE_SECRET ? `?auth=${encodeURIComponent(process.env.REALTIME_DATABASE_SECRET)}` : ''}`, { puzzleRating: newRating, updatedAt: Date.now() });
      if (puzzleId) {
        const entry = { puzzleId, puzzleRating, won, delta, ratingAfter: newRating, timestamp: Date.now() };
        await restRequest('PUT', `${process.env.REALTIME_DATABASE_URL.replace(/\/$/, '')}/users/${encodeURIComponent(userId)}/puzzleHistory/${Date.now()}.json${process.env.REALTIME_DATABASE_SECRET ? `?auth=${encodeURIComponent(process.env.REALTIME_DATABASE_SECRET)}` : ''}`, entry);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        delta,
        ratingAfter: newRating,
      }),
    };
  } catch (err) {
    console.error('Error recording puzzle attempt:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Server error' }),
    };
  }
};
