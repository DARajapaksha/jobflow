import { pool } from '../db/pool.js';

const OPEN_JOBS = `(SELECT count(*)::int FROM jobs j WHERE j.company_id = c.id AND j.status = 'open'
                    AND (j.expires_at IS NULL OR j.expires_at > now()))`;

const toCompany = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  website: r.website,
  location: r.location,
  logoUrl: r.logo_url,
  openJobCount: r.open_jobs,
});

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

// Companies that currently have at least one open listing, busiest first.
export async function list({ q, page, limit }) {
  const params = [];
  const where = [`${OPEN_JOBS} > 0`];
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where.push(`c.name ILIKE $${params.length}`);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = (await pool.query(`SELECT count(*)::int AS total FROM companies c ${whereSql}`, params)).rows[0].total;

  params.push(limit, (page - 1) * limit);
  const { rows } = await pool.query(
    `SELECT c.*, ${OPEN_JOBS} AS open_jobs FROM companies c ${whereSql}
     ORDER BY open_jobs DESC, c.name, c.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { data: rows.map(toCompany), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function findById(id) {
  const { rows } = await pool.query(`SELECT c.*, ${OPEN_JOBS} AS open_jobs FROM companies c WHERE c.id = $1`, [id]);
  return rows[0] ? toCompany(rows[0]) : null;
}
