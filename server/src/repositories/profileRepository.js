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
