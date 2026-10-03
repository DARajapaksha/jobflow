// Demo data so reviewers see a populated board. Safe to re-run in dev (wipes data).
import bcrypt from 'bcryptjs';
import { pool } from '../pool.js';
import { env } from '../../config/env.js';

if (env.nodeEnv === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Re-run with --force to confirm.');
  process.exit(1);
}

const DEMO_PASSWORD = 'Password123!';
const categories = ['Software Engineering', 'Design', 'Data & Analytics', 'Marketing', 'Finance', 'Customer Support'];

const companies = [
  { key: 'acme', owner: 'Acme Employer', email: 'employer@jobflow.dev', name: 'Acme Technologies', location: 'Colombo', website: 'https://acme.example', description: 'Product studio building web and mobile apps.' },
  { key: 'lanka', owner: 'Lanka Employer', email: 'employer2@jobflow.dev', name: 'LankaSoft', location: 'Kandy', website: 'https://lankasoft.example', description: 'Software services for regional clients.' },
];

const jobs = [
  ['acme', 'Software Engineering', 'Frontend Developer', 'Build responsive React interfaces with a focus on accessibility and performance. You will work closely with designers.', 'Colombo', 'full_time', 'hybrid', 150000, 250000],
  ['acme', 'Software Engineering', 'Backend Developer (Node.js)', 'Design REST APIs with Express and PostgreSQL. Strong SQL and testing habits expected.', 'Colombo', 'full_time', 'onsite', 180000, 280000],
  ['acme', 'Software Engineering', 'Full Stack Intern', 'Six-month internship across React and Node.js with a mentor. Great for undergraduates.', 'Colombo', 'internship', 'hybrid', 40000, 60000],
  ['acme', 'Design', 'UI/UX Designer', 'Own the design system and run usability tests. Figma proficiency required.', 'Remote', 'contract', 'remote', 120000, 200000],
  ['acme', 'Marketing', 'Social Media Executive', 'Plan and publish campaigns, track engagement and report monthly.', 'Colombo', 'part_time', 'hybrid', 60000, 90000],
  ['lanka', 'Software Engineering', 'QA Engineer', 'Write manual and automated tests, report defects and improve release quality.', 'Kandy', 'full_time', 'onsite', 110000, 170000],
  ['lanka', 'Data & Analytics', 'Data Analyst', 'Turn raw data into dashboards using SQL and a BI tool. Communicate insights to non-technical teams.', 'Kandy', 'full_time', 'hybrid', 130000, 210000],
  ['lanka', 'Software Engineering', 'DevOps Intern', 'Help maintain CI/CD pipelines and Docker-based environments.', 'Remote', 'internship', 'remote', 40000, 60000],
  ['lanka', 'Finance', 'Junior Accountant', 'Support month-end close, reconciliations and payroll preparation.', 'Galle', 'full_time', 'onsite', 90000, 130000],
  ['lanka', 'Customer Support', 'Support Specialist', 'Handle customer tickets by chat and email, escalate technical issues.', 'Kandy', 'full_time', 'onsite', 80000, 110000],
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE saved_jobs, applications, jobs, companies, categories, seeker_profiles, users RESTART IDENTITY CASCADE');

    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const catIds = {};
    for (const name of categories) {
      const { rows } = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
      catIds[name] = rows[0].id;
    }

    const companyIds = {};
    for (const c of companies) {
      const user = await client.query(
        "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'employer') RETURNING id",
        [c.email, hash, c.owner],
      );
      const co = await client.query(
        'INSERT INTO companies (owner_id, name, description, website, location) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [user.rows[0].id, c.name, c.description, c.website, c.location],
      );
      companyIds[c.key] = co.rows[0].id;
    }

    const seeker = await client.query(
      "INSERT INTO users (email, password_hash, full_name, role) VALUES ('seeker@jobflow.dev', $1, 'Demo Seeker', 'seeker') RETURNING id",
      [hash],
    );
    await client.query(
      'INSERT INTO seeker_profiles (user_id, headline, skills, location) VALUES ($1, $2, $3, $4)',
      [seeker.rows[0].id, 'Aspiring full stack developer', ['React', 'Node.js', 'PostgreSQL'], 'Colombo'],
    );

    for (const [co, cat, title, desc, loc, type, mode, min, max] of jobs) {
      await client.query(
        `INSERT INTO jobs (company_id, category_id, title, description, location, job_type, work_mode, salary_min, salary_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [companyIds[co], catIds[cat], title, desc, loc, type, mode, min, max],
      );
    }

    await client.query('COMMIT');
    console.log(`Seeded ${categories.length} categories, ${companies.length} employers, 1 seeker, ${jobs.length} jobs.`);
    console.log(`Demo logins (password: ${DEMO_PASSWORD}): seeker@jobflow.dev, employer@jobflow.dev, employer2@jobflow.dev`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
