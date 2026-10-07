import pg from 'pg';
import { env } from '../config/env.js';

// Serverless databases (e.g. Neon) suspend when idle and close their connections. So: keep few connections,
// drop idle ones quickly, allow time for a cold start, and never let a dropped idle connection crash the process.
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 20_000,
  keepAlive: true,
});

pool.on('error', (err) => {
  // Emitted when an idle client's connection is dropped by the server. The pool discards it and opens a new one.
  console.error('Idle database connection lost (it will be replaced):', err.message);
});

export const query = (text, params) => pool.query(text, params);
