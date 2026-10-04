import { pool } from '../db/pool.js';

export async function save(seekerId, jobId) {
  await pool.query('INSERT INTO saved_jobs (seeker_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [seekerId, jobId]);
}

export async function remove(seekerId, jobId) {
  await pool.query('DELETE FROM saved_jobs WHERE seeker_id = $1 AND job_id = $2', [seekerId, jobId]);
}

export async function isSaved(seekerId, jobId) {
  const { rowCount } = await pool.query('SELECT 1 FROM saved_jobs WHERE seeker_id = $1 AND job_id = $2', [seekerId, jobId]);
  return rowCount > 0;
}
