const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/puzzles.db');
let db = null;
let dbError = null;
let sqlInitPromise = null;

async function initSql() {
  if (!sqlInitPromise) {
    sqlInitPromise = (async () => {
      const initSqlJs = require('sql.js');
      return initSqlJs({
        locateFile: (file) => path.join(__dirname, '../../../node_modules/sql.js/dist', file),
      });
    })();
  }
  return sqlInitPromise;
}

async function getDb() {
  if (dbError) return null;
  if (db) return db;
  if (!fs.existsSync(DB_PATH)) {
    dbError = new Error(`Puzzle database missing. Run npm run build to download ${path.basename(DB_PATH)}.`);
    return null;
  }
  try {
    const SQL = await initSql();
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    return db;
  } catch (err) {
    dbError = err;
    return null;
  }
}

function isReady() {
  return fs.existsSync(DB_PATH);
}

function ratingWindow(target, difficulty = 'normal') {
  const t = Number(target) || 1500;
  const windows = {
    easiest: [t - 500, t - 250],
    easier: [t - 320, t - 120],
    normal: [t - 150, t + 150],
    harder: [t + 120, t + 320],
    hardest: [t + 250, t + 550],
  };
  const [min, max] = windows[difficulty] || windows.normal;
  return { min: Math.max(400, min), max: Math.min(3200, max) };
}

function themeClause(theme) {
  const key = String(theme || 'mix').trim();
  if (!key || key === 'mix') return { sql: '', params: [] };
  const camel = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\s+/g, '');
  const tokens = [...new Set([key, camel, key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')].map((t) => t.toLowerCase()))];
  const parts = tokens.map(() => `themes LIKE ?`);
  return { sql: ` AND (${parts.join(' OR ')})`, params: tokens.map((token) => `%${token}%`) };
}

function rowsFromExec(database, sql, params = []) {
  const statement = database.prepare(sql);
  if (params.length) statement.bind(params);
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

function pickRandom(rows) {
  if (!rows.length) return null;
  return rows[Math.floor(Math.random() * rows.length)];
}

function rowToPayload(row) {
  if (!row) return null;
  const solution = JSON.parse(row.solution || '[]');
  return {
    puzzle: {
      id: row.id,
      fen: row.setup_fen,
      solution,
      rating: row.rating,
      themes: String(row.themes || '').split(/\s+/).filter(Boolean),
      popularity: row.popularity,
      plays: row.nb_plays,
      gameUrl: row.game_url,
    },
    game: {
      pgn: '',
      players: [
        { color: 'white', name: 'White', rating: null },
        { color: 'black', name: 'Black', rating: null },
      ],
    },
  };
}

async function getNextPuzzle({ theme = 'mix', difficulty = 'normal', target = 1500, exclude = '', attemptedIds = new Set() }) {
  const database = await getDb();
  if (!database) throw dbError || new Error('Puzzle database is not available.');

  const { min, max } = ratingWindow(target, difficulty);
  const themeFilter = themeClause(theme);
  const excludeId = String(exclude || '').trim();
  const attempted = [...attemptedIds].filter(Boolean);
  const attemptedSql = attempted.length ? ` AND id NOT IN (${attempted.map(() => '?').join(', ')})` : '';
  const whereParams = [min, max];
  if (excludeId) whereParams.push(excludeId);
  whereParams.push(...attempted);
  whereParams.push(...themeFilter.params);
  const ratingTarget = Number(target) || 1500;

  const baseWhere = `
    rating BETWEEN ? AND ?
    ${excludeId ? ' AND id != ?' : ''}
    ${attemptedSql}
    ${themeFilter.sql}
  `;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const offset = Math.floor(Math.random() * 5000);
    const params = [...whereParams, ratingTarget, offset];
    const rows = rowsFromExec(database, `
      SELECT * FROM puzzles
      WHERE ${baseWhere}
      ORDER BY ABS(rating - ?) ASC, popularity DESC
      LIMIT 24 OFFSET ?
    `, params);

    const picked = pickRandom(rows);
    if (picked) return rowToPayload(picked);
  }

  const fallback = rowsFromExec(database, `
    SELECT * FROM puzzles
    WHERE ${baseWhere}
    ORDER BY ABS(rating - ?) ASC
    LIMIT 40
  `, [...whereParams, ratingTarget]);

  return rowToPayload(pickRandom(fallback));
}

async function getDailyPuzzle({ attemptedIds = new Set(), date = new Date() }) {
  const database = await getDb();
  if (!database) throw dbError || new Error('Puzzle database is not available.');

  const dayKey = date.toISOString().slice(0, 10);
  const hash = [...dayKey].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const target = 1200 + (hash % 1400);
  const min = target - 80;
  const max = target + 80;
  const attempted = [...attemptedIds].filter(Boolean);
  const attemptedSql = attempted.length ? ` AND id NOT IN (${attempted.map(() => '?').join(', ')})` : '';
  const params = [min, max, ...attempted];

  const rows = rowsFromExec(database, `
    SELECT * FROM puzzles
    WHERE rating BETWEEN ? AND ?
    ${attemptedSql}
    ORDER BY (popularity * 7 + nb_plays) DESC
    LIMIT 80
  `, params);

  const index = hash % Math.max(1, rows.length);
  return rowToPayload(rows[index] || rows[0]);
}

module.exports = {
  DB_PATH,
  getDb,
  isReady,
  getNextPuzzle,
  getDailyPuzzle,
  rowToPayload,
};
