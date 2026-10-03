import { pool } from '../db/pool.js';

const db = (client) => client ?? pool;

export async function createSeekerProfile(userId, client) {
  await db(client).query('INSERT INTO seeker_profiles (user_id) VALUES ($1)', [userId]);
}

export async function findSeekerProfile(userId) {
  const { rows } = await pool.query('SELECT * FROM seeker_profiles WHERE user_id = $1', [userId]);
  const r = rows[0];
  return (
    r && {
      headline: r.headline,
      bio: r.bio,
      skills: r.skills,
      location: r.location,
      resumeFilename: r.resume_filename, // the storage key stays server-side
    }
  );
}

export async function createCompany(ownerId, name, client) {
  const { rows } = await db(client).query(
    'INSERT INTO companies (owner_id, name) VALUES ($1, $2) RETURNING *',
    [ownerId, name],
  );
  return rows[0];
}

export async function findCompanyByOwner(ownerId) {
  const { rows } = await pool.query('SELECT * FROM companies WHERE owner_id = $1 ORDER BY name LIMIT 1', [ownerId]);
  const r = rows[0];
  return r && { id: r.id, name: r.name, description: r.description, website: r.website, location: r.location, logoUrl: r.logo_url };
}

export async function getResume(userId) {
  const { rows } = await pool.query('SELECT resume_key, resume_filename FROM seeker_profiles WHERE user_id = $1', [userId]);
  const r = rows[0];
  return r?.resume_key ? { key: r.resume_key, filename: r.resume_filename } : null;
}

export async function setResume(userId, key, filename) {
  await pool.query(
    `INSERT INTO seeker_profiles (user_id, resume_key, resume_filename) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET resume_key = EXCLUDED.resume_key, resume_filename = EXCLUDED.resume_filename`,
    [userId, key, filename],
  );
}

export async function clearResume(userId) {
  await pool.query('UPDATE seeker_profiles SET resume_key = NULL, resume_filename = NULL WHERE user_id = $1', [userId]);
}
