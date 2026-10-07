import { pool } from '../db/pool.js';
import { buildSet } from '../utils/sql.js';
import { avatarUrl, logoUrl } from '../utils/assets.js';

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
      resumeFilename: r.resume_filename, // the storage keys stay server-side
      avatarUrl: avatarUrl(userId, r.avatar_key),
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
  return r && { id: r.id, name: r.name, description: r.description, website: r.website, location: r.location, logoUrl: logoUrl(r.id, r.logo_key) };
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

const SEEKER_COLUMNS = { headline: 'headline', bio: 'bio', skills: 'skills', location: 'location' };
const COMPANY_COLUMNS = { name: 'name', description: 'description', website: 'website', location: 'location' };

export async function updateSeekerProfile(userId, fields, client) {
  const { sets, params } = buildSet(fields, SEEKER_COLUMNS, 2);
  if (!sets.length) return;
  await db(client).query(`UPDATE seeker_profiles SET ${sets.join(', ')} WHERE user_id = $1`, [userId, ...params]);
}

export async function updateCompany(companyId, fields, client) {
  const { sets, params } = buildSet(fields, COMPANY_COLUMNS, 2);
  if (!sets.length) return;
  await db(client).query(`UPDATE companies SET ${sets.join(', ')} WHERE id = $1`, [companyId, ...params]);
}

export async function getAvatarKey(userId) {
  const { rows } = await pool.query('SELECT avatar_key FROM seeker_profiles WHERE user_id = $1', [userId]);
  return rows[0]?.avatar_key ?? null;
}

export async function setAvatarKey(userId, key) {
  await pool.query(
    `INSERT INTO seeker_profiles (user_id, avatar_key) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET avatar_key = EXCLUDED.avatar_key`,
    [userId, key],
  );
}

export async function clearAvatarKey(userId) {
  await pool.query('UPDATE seeker_profiles SET avatar_key = NULL WHERE user_id = $1', [userId]);
}
