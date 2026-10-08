// LOCAL DEVELOPMENT ONLY: fills your own machine's database with fake companies, jobs and accounts so the UI has
// something to show. It wipes users, companies, jobs and applications. Do not run it against the live site: real
// content there is added through the app itself. (Job categories are not part of this file; they come from migrations.)
import bcrypt from 'bcryptjs';
import { pool } from '../pool.js';
import { env } from '../../config/env.js';

if (env.nodeEnv === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Re-run with --force to confirm.');
  process.exit(1);
}

const DEMO_PASSWORD = 'Password123!';

const companies = [
  { key: 'acme', owner: 'Acme Employer', email: 'employer@jobflow.dev', name: 'Acme Technologies', location: 'Colombo', website: 'https://acme.example', description: 'Product studio building web and mobile apps.' },
  { key: 'lanka', owner: 'Lanka Employer', email: 'employer2@jobflow.dev', name: 'LankaSoft', location: 'Kandy', website: 'https://lankasoft.example', description: 'Software services for regional clients.' },
];

// intro, then "what you'll do" and "what we're looking for" bullet lists
const describe = (intro, doing, needs) =>
  `${intro}\n\nWhat you'll do\n${doing.map((d) => `- ${d}`).join('\n')}\n\nWhat we're looking for\n${needs.map((n) => `- ${n}`).join('\n')}`;

const jobs = [
  ['acme', 'Software Engineering', 'Frontend Developer', describe(
    'Join the product team building the web apps our clients use every day. You will work closely with designers to turn ideas into fast, accessible interfaces.',
    ['Build responsive React interfaces from design files', 'Own the quality of what you ship: tests, accessibility and performance', 'Review code and help teammates grow'],
    ['2+ years of React and modern JavaScript', 'A good eye for detail and layout', 'Comfort working with REST APIs']),
    'Colombo', 'full_time', 'hybrid', 150000, 250000],
  ['acme', 'Software Engineering', 'Backend Developer (Node.js)', describe(
    'We are growing our API team. You will design and run the services behind our web and mobile products.',
    ['Design REST APIs with Express and PostgreSQL', 'Write database migrations and tune slow queries', 'Add tests and monitoring so releases stay calm'],
    ['Solid SQL and Node.js experience', 'Habit of writing tests', 'Clear written communication']),
    'Colombo', 'full_time', 'onsite', 180000, 280000],
  ['acme', 'Software Engineering', 'Full Stack Intern', describe(
    'A six-month internship across our React and Node.js stack, with a mentor and real tickets from week one. Great for undergraduates.',
    ['Ship small features end to end with your mentor', 'Fix bugs and write tests', 'Present what you built at the monthly demo'],
    ['Studying computing or a related degree', 'A project or two on GitHub', 'Curiosity and a willingness to ask questions']),
    'Colombo', 'internship', 'hybrid', 40000, 60000],
  ['acme', 'Design', 'UI/UX Designer', describe(
    'Shape how our products look and feel. You will own the design system and test ideas with real users.',
    ['Design flows, wireframes and polished screens in Figma', 'Maintain the shared component library', 'Run short usability tests and share what you learn'],
    ['A portfolio that shows your process', 'Strong typography and layout skills', 'Experience handing designs to developers']),
    'Remote', 'contract', 'remote', 120000, 200000],
  ['acme', 'Marketing', 'Social Media Executive', describe(
    'Plan and publish campaigns across our social channels, and report on what works.',
    ['Write and schedule posts, stories and short videos', 'Track engagement and report monthly', 'Work with design on campaign visuals'],
    ['Excellent English writing; Sinhala or Tamil is a plus', 'Experience running social accounts', 'Comfort with analytics dashboards']),
    'Colombo', 'part_time', 'hybrid', 60000, 90000],
  ['lanka', 'Software Engineering', 'QA Engineer', describe(
    'Help us ship with confidence. You will test new features, automate regression checks and improve release quality.',
    ['Write manual and automated tests', 'Report and track defects with clear reproduction steps', 'Work with developers to prevent repeat bugs'],
    ['1+ years in software testing', 'Familiarity with a test framework such as Playwright or Cypress', 'A careful, methodical approach']),
    'Kandy', 'full_time', 'onsite', 110000, 170000],
  ['lanka', 'Data & Analytics', 'Data Analyst', describe(
    'Turn raw data into dashboards and decisions for our regional clients.',
    ['Build dashboards and reports with SQL and a BI tool', 'Clean and check data from several sources', 'Explain findings to non-technical teams'],
    ['Strong SQL', 'Experience with a BI tool such as Power BI or Metabase', 'Good at telling the story behind the numbers']),
    'Kandy', 'full_time', 'hybrid', 130000, 210000],
  ['lanka', 'Software Engineering', 'DevOps Intern', describe(
    'Learn how software gets built, tested and deployed. You will help maintain our CI/CD pipelines and Docker-based environments.',
    ['Maintain GitHub Actions pipelines', 'Containerise services with Docker', 'Document how our environments are set up'],
    ['Basic Linux and Git skills', 'Interest in cloud and automation', 'Currently studying computing or similar']),
    'Remote', 'internship', 'remote', 40000, 60000],
  ['lanka', 'Finance', 'Junior Accountant', describe(
    'Support our finance team with month-end close, reconciliations and payroll preparation.',
    ['Reconcile bank and supplier accounts', 'Prepare payroll inputs and journal entries', 'Help with audit requests'],
    ['Part-qualified or degree in accounting or finance', 'Accurate and organised', 'Working knowledge of Excel']),
    'Galle', 'full_time', 'onsite', 90000, 130000],
  ['lanka', 'Customer Support', 'Support Specialist', describe(
    'Be the friendly, knowledgeable voice customers meet when something goes wrong.',
    ['Answer tickets by chat and email', 'Escalate technical issues with clear notes', 'Suggest improvements to our help articles'],
    ['Clear written English; Sinhala or Tamil is a plus', 'Patience and empathy', 'Comfortable learning new software quickly']),
    'Kandy', 'full_time', 'onsite', 80000, 110000],
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE saved_jobs, applications, jobs, companies, seeker_profiles, users RESTART IDENTITY CASCADE');

    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    // Categories are reference data from migration 003, not seed data
    const { rows: categoryRows } = await client.query('SELECT id, name FROM categories');
    const catIds = Object.fromEntries(categoryRows.map((r) => [r.name, r.id]));
    for (const [, cat] of jobs) if (!catIds[cat]) throw new Error(`Category "${cat}" is missing. Run npm run migrate first.`);

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
    console.log(`Seeded ${companies.length} employers, 1 seeker, ${jobs.length} jobs.`);
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
