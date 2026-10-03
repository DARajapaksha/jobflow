import { pool } from '../db/pool.js';

const SELECT = `
  SELECT a.id, a.status, a.cover_letter, a.resume_key, a.resume_filename, a.applied_at, a.seeker_id,
         j.id AS job_id, j.title AS job_title, j.location AS job_location, j.status AS job_status,
         c.id AS company_id, c.name AS company_name, c.owner_id,
         u.full_name, u.email, sp.headline, sp.skills, sp.location AS applicant_location
  FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN companies c ON c.id = j.company_id
  JOIN users u ON u.id = a.seeker_id
  LEFT JOIN seeker_profiles sp ON sp.user_id = a.seeker_id`;

// resumeKey, seekerId and ownerId are internal: the service strips them before responding.
const toApplication = (r) => ({
  id: r.id,
  status: r.status,
  appliedAt: r.applied_at,
  coverLetter: r.cover_letter,
  resume: { filename: r.resume_filename },
  job: {
    id: r.job_id,
    title: r.job_title,
    location: r.job_location,
    status: r.job_status,
    company: { id: r.company_id, name: r.company_name },
  },
  applicant: { id: r.seeker_id, fullName: r.full_name, email: r.email, headline: r.headline, skills: r.skills ?? [], location: r.applicant_location },
  resumeKey: r.resume_key,
  seekerId: r.seeker_id,
  ownerId: r.owner_id,
});

export async function findById(id) {
  const { rows } = await pool.query(`${SELECT} WHERE a.id = $1`, [id]);
  return rows[0] ? toApplication(rows[0]) : null;
}

export async function findByJobAndSeeker(jobId, seekerId) {
  const { rows } = await pool.query('SELECT id, status FROM applications WHERE job_id = $1 AND seeker_id = $2', [jobId, seekerId]);
  return rows[0] ?? null;
}

export async function create({ jobId, seekerId, coverLetter, resumeKey, resumeFilename }) {
  const { rows } = await pool.query(
    `INSERT INTO applications (job_id, seeker_id, cover_letter, resume_key, resume_filename)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [jobId, seekerId, coverLetter, resumeKey, resumeFilename],
  );
  return rows[0].id;
}

export async function listBySeeker(seekerId, status) {
  const params = [seekerId];
  let statusSql = '';
  if (status) {
    params.push(status);
    statusSql = 'AND a.status = $2';
  }
  const { rows } = await pool.query(`${SELECT} WHERE a.seeker_id = $1 ${statusSql} ORDER BY a.applied_at DESC LIMIT 200`, params);
  return rows.map(toApplication);
}

export async function listByJob(jobId, { status, page, limit }) {
  const params = [jobId];
  let statusSql = '';
  if (status) {
    params.push(status);
    statusSql = 'AND a.status = $2';
  }
  const where = `WHERE a.job_id = $1 ${statusSql}`;
  const { rows: countRows } = await pool.query(`SELECT count(*)::int AS total FROM applications a ${where}`, params);
  const total = countRows[0].total;

  params.push(limit, (page - 1) * limit);
  const { rows } = await pool.query(
    `${SELECT} ${where} ORDER BY a.applied_at DESC, a.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { data: rows.map(toApplication), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// Compare-and-set: only succeeds if the status is still what the caller saw.
export async function updateStatus(id, from, to) {
  const { rowCount } = await pool.query('UPDATE applications SET status = $3 WHERE id = $1 AND status = $2', [id, from, to]);
  return rowCount > 0;
}

export async function isResumeKeyReferenced(key) {
  const { rowCount } = await pool.query('SELECT 1 FROM applications WHERE resume_key = $1 LIMIT 1', [key]);
  return rowCount > 0;
}
