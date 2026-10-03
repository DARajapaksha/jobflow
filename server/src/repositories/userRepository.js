import { pool } from '../db/pool.js';

// Every function accepts an optional client so callers can run inside a transaction.
const db = (client) => client ?? pool;

export const toUser = (row) =>
  row && { id: row.id, email: row.email, fullName: row.full_name, role: row.role, createdAt: row.created_at };

export async function findByEmail(email, client) {
  const { rows } = await db(client).query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  return rows[0] ?? null; // includes password_hash: only for the auth service
}

export async function findById(id, client) {
  const { rows } = await db(client).query('SELECT * FROM users WHERE id = $1', [id]);
  return toUser(rows[0] ?? null);
}

export async function create({ email, passwordHash, fullName, role }, client) {
  const { rows } = await db(client).query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [email, passwordHash, fullName, role],
  );
  return toUser(rows[0]);
}
