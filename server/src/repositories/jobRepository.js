import { pool } from '../db/pool.js';

const SUMMARY_COLUMNS = `
  j.id, j.title, j.location, j.job_type, j.work_mode, j.salary_min, j.salary_max, j.status, j.created_at,
  cat.id AS category_id, cat.name AS category_name,
  c.id AS company_id, c.name AS company_name, c.logo_url AS company_logo_url`;

const FROM = `
  FROM jobs j
  JOIN companies c ON c.id = j.company_id
  LEFT JOIN categories cat ON cat.id = j.category_id`;

const toSummary = (r) => ({
  id: r.id,
  title: r.title,
  location: r.location,
  jobType: r.job_type,
  workMode: r.work_mode,
  salaryMin: r.salary_min,
  salaryMax: r.salary_max,
  status: r.status,
  createdAt: r.created_at,
  category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
  company: { id: r.company_id, name: r.company_name, logoUrl: r.company_logo_url },
});

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

const SORTS = {
  newest: 'j.created_at DESC',
  salary_desc: 'j.salary_max DESC NULLS LAST, j.created_at DESC',
};

export async function search({ q, category, location, type, mode, salaryMin, sort, page, limit }) {
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const where = ["j.status = 'open'", '(j.expires_at IS NULL OR j.expires_at > now())'];
  let rank = null;

  if (q) {
    const text = add(q);
    const like = add(`%${escapeLike(q)}%`);
    // Full-text match (stemming: "developers" finds "developer") or a plain substring match on the title
    where.push(`(j.search_vector @@ websearch_to_tsquery('english', ${text}) OR j.title ILIKE ${like})`);
    rank = `ts_rank(j.search_vector, websearch_to_tsquery('english', ${text}))`;
  }
  if (category) where.push(`j.category_id = ${add(category)}`);
  if (location) where.push(`j.location ILIKE ${add(`%${escapeLike(location)}%`)}`);
  if (type?.length) where.push(`j.job_type = ANY(${add(type)}::job_type[])`);
  if (mode?.length) where.push(`j.work_mode = ANY(${add(mode)}::work_mode[])`);
  if (salaryMin != null) where.push(`j.salary_max >= ${add(salaryMin)}`);

  const effectiveSort = sort ?? (rank ? 'relevance' : 'newest');
  const orderBy = effectiveSort === 'relevance' && rank ? `${rank} DESC, j.created_at DESC` : SORTS[effectiveSort] ?? SORTS.newest;
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countResult = await pool.query(`SELECT count(*)::int AS total ${FROM} ${whereSql}`, params);
  const total = countResult.rows[0].total;

  const limitParam = add(limit);
  const offsetParam = add((page - 1) * limit);
  const { rows } = await pool.query(
    `SELECT ${SUMMARY_COLUMNS} ${FROM} ${whereSql} ORDER BY ${orderBy}, j.id LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  return {
    data: rows.map(toSummary),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${SUMMARY_COLUMNS}, j.description, j.expires_at, j.updated_at,
            c.owner_id, c.description AS company_description, c.website AS company_website, c.location AS company_location
     ${FROM} WHERE j.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  const summary = toSummary(r);
  return {
    ...summary,
    description: r.description,
    expiresAt: r.expires_at,
    updatedAt: r.updated_at,
    company: { ...summary.company, description: r.company_description, website: r.company_website, location: r.company_location },
    ownerId: r.owner_id, // internal: stripped by the service before responding
  };
}

export async function listByOwner(ownerId, status) {
  const params = [ownerId];
  let statusSql = '';
  if (status) {
    params.push(status);
    statusSql = 'AND j.status = $2';
  }
  const { rows } = await pool.query(
    `SELECT ${SUMMARY_COLUMNS}, j.expires_at,
            (SELECT count(*)::int FROM applications a WHERE a.job_id = j.id) AS applicant_count
     ${FROM} WHERE c.owner_id = $1 ${statusSql} ORDER BY j.created_at DESC`,
    params,
  );
  return rows.map((r) => ({ ...toSummary(r), expiresAt: r.expires_at, applicantCount: r.applicant_count }));
}

export async function create(companyId, f) {
  const { rows } = await pool.query(
    `INSERT INTO jobs (company_id, category_id, title, description, location, job_type, work_mode,
                       salary_min, salary_max, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [companyId, f.categoryId ?? null, f.title, f.description, f.location ?? null, f.jobType, f.workMode,
     f.salaryMin ?? null, f.salaryMax ?? null, f.status, f.expiresAt ?? null],
  );
  return rows[0].id;
}

// Only these fields can be changed, and the column names never come from user input.
const UPDATABLE = {
  title: 'title', description: 'description', location: 'location', categoryId: 'category_id',
  jobType: 'job_type', workMode: 'work_mode', salaryMin: 'salary_min', salaryMax: 'salary_max',
  status: 'status', expiresAt: 'expires_at',
};

export async function update(id, fields) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  params.push(id);
  await pool.query(`UPDATE jobs SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
}

export async function remove(id) {
  await pool.query('DELETE FROM jobs WHERE id = $1', [id]);
}

export async function listCategories() {
  const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY name');
  return rows;
}

export async function categoryExists(id) {
  const { rowCount } = await pool.query('SELECT 1 FROM categories WHERE id = $1', [id]);
  return rowCount > 0;
}
