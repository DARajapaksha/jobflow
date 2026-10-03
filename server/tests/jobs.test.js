// Integration tests against the database in DATABASE_URL (use your dev DB, never production).
// Test users use @jobstest.jobflow and a throwaway category; everything is deleted afterwards.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const DOMAIN = '@jobstest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const token = `tok${run}`; // unique search keyword for this run
const CATEGORY = `__jobs_test_${run}`;
const PASSWORD = 'Sup3rSecret';
let categoryId;

async function signUp(name, role) {
  const agent = request.agent(app);
  const body = { fullName: `Test ${name}`, email: `${name}-${run}${DOMAIN}`, password: PASSWORD, role };
  if (role === 'employer') body.companyName = `Test Co ${name}`;
  const res = await agent.post('/api/auth/register').send(body);
  assert.equal(res.status, 201);
  return agent;
}

const jobBody = (over = {}) => ({
  title: `Engineer ${token}`,
  description: 'Build and maintain services for our growing product. Teamwork required.',
  location: 'Colombo',
  categoryId,
  jobType: 'full_time',
  workMode: 'hybrid',
  ...over,
});

const cleanup = async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]); // cascades to companies and jobs
  await pool.query('DELETE FROM categories WHERE name LIKE $1', ['\\_\\_jobs\\_test\\_%']);
};

let employerA, employerB, seeker;
before(async () => {
  await cleanup();
  categoryId = (await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [CATEGORY])).rows[0].id;
  employerA = await signUp('empa', 'employer');
  employerB = await signUp('empb', 'employer');
  seeker = await signUp('seek', 'seeker');
});
after(async () => {
  await cleanup();
  await pool.end();
});

test('categories are public', async () => {
  const res = await request(app).get('/api/categories');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((c) => c.id === categoryId));
});

test('only employers can post jobs', async () => {
  assert.equal((await request(app).post('/api/jobs').send(jobBody())).status, 401);
  assert.equal((await seeker.post('/api/jobs').send(jobBody())).status, 403);
});

test('create validates input', async () => {
  const bad = [
    { title: 'x' },
    { jobType: 'forever' },
    { workMode: 'moon' },
    { salaryMin: 200, salaryMax: 100 },
    { categoryId: 999999 },
    { expiresAt: '2020-01-01T00:00:00Z' },
    { description: 'too short' },
  ];
  for (const over of bad) {
    const res = await employerA.post('/api/jobs').send(jobBody(over));
    assert.equal(res.status, 400, JSON.stringify(over));
  }
});

test('employer creates a job, it is public, drafts are private', async () => {
  const created = await employerA.post('/api/jobs').send(jobBody({ salaryMin: 100, salaryMax: 200 }));
  assert.equal(created.status, 201);
  const job = created.body.job;
  assert.equal(job.status, 'open');
  assert.equal(job.company.name, 'Test Co empa');
  assert.equal(job.category.name, CATEGORY);
  assert.ok(!('ownerId' in job));

  const pub = await request(app).get(`/api/jobs/${job.id}`);
  assert.equal(pub.status, 200);

  const draft = (await employerA.post('/api/jobs').send(jobBody({ title: `Draft ${token}`, status: 'draft' }))).body.job;
  assert.equal((await request(app).get(`/api/jobs/${draft.id}`)).status, 404);
  assert.equal((await employerB.get(`/api/jobs/${draft.id}`)).status, 404);
  assert.equal((await employerA.get(`/api/jobs/${draft.id}`)).status, 200);

  const search = await request(app).get('/api/jobs').query({ q: `Draft ${token}` });
  assert.ok(!search.body.data.some((j) => j.id === draft.id));
});

test('unknown and malformed ids', async () => {
  assert.equal((await request(app).get('/api/jobs/00000000-0000-4000-8000-000000000000')).status, 404);
  assert.equal((await request(app).get('/api/jobs/not-a-uuid')).status, 400);
});

test('search: keyword, filters, sorting, pagination', async () => {
  const mk = (over) => employerB.post('/api/jobs').send(jobBody({ title: `Search ${token} ${over.tag}`, ...over }));
  await mk({ tag: 'one', jobType: 'internship', workMode: 'remote', location: 'Kandy', salaryMin: 50, salaryMax: 100 });
  await mk({ tag: 'two', jobType: 'contract', workMode: 'onsite', location: 'Galle', salaryMin: 100, salaryMax: 300 });
  await mk({ tag: 'three', jobType: 'part_time', workMode: 'hybrid', location: 'Kandy', salaryMin: 100, salaryMax: 200 });

  const get = (qs) => request(app).get('/api/jobs').query({ q: `Search ${token}`, ...qs });

  assert.equal((await get({})).body.pagination.total, 3);
  assert.equal((await get({ type: 'internship' })).body.pagination.total, 1);
  assert.equal((await get({ type: 'internship,contract' })).body.pagination.total, 2);
  assert.equal((await get({ mode: 'onsite' })).body.pagination.total, 1);
  assert.equal((await get({ location: 'kandy' })).body.pagination.total, 2);
  assert.equal((await get({ category: categoryId })).body.pagination.total, 3);
  assert.equal((await get({ salaryMin: 250 })).body.pagination.total, 1);

  const bySalary = await get({ sort: 'salary_desc' });
  assert.deepEqual(bySalary.body.data.map((j) => j.salaryMax), [300, 200, 100]);

  const page1 = await get({ limit: 2, page: 1 });
  const page2 = await get({ limit: 2, page: 2 });
  assert.equal(page1.body.data.length, 2);
  assert.equal(page2.body.data.length, 1);
  assert.equal(page1.body.pagination.totalPages, 2);
  assert.ok(!page2.body.data.some((j) => page1.body.data.map((x) => x.id).includes(j.id)));

  // partial-word title match and stemming
  assert.ok((await request(app).get('/api/jobs').query({ q: token.slice(0, 6) })).body.pagination.total >= 3);

  assert.equal((await get({ type: 'banana' })).status, 400);
  assert.equal((await get({ limit: 1000 })).status, 400);
});

test('only the owner can edit or delete; closing hides the job', async () => {
  const job = (await employerA.post('/api/jobs').send(jobBody({ title: `Editable ${token}` }))).body.job;
  const url = `/api/jobs/${job.id}`;

  assert.equal((await request(app).patch(url).send({ title: 'Hacked title' })).status, 401);
  assert.equal((await seeker.patch(url).send({ title: 'Hacked title' })).status, 403);
  assert.equal((await employerB.patch(url).send({ title: 'Hacked title' })).status, 403);
  assert.equal((await employerB.delete(url)).status, 403);

  assert.equal((await employerA.patch(url).send({})).status, 400);
  const edited = await employerA.patch(url).send({ title: `Edited ${token}`, salaryMin: 10, salaryMax: 20 });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.job.title, `Edited ${token}`);

  // only one side of the salary range is sent: validated against the stored value
  assert.equal((await employerA.patch(url).send({ salaryMax: 5 })).status, 400);

  assert.equal((await employerA.patch(url).send({ status: 'closed' })).status, 200);
  assert.equal((await request(app).get(url)).status, 404);
  assert.equal((await employerA.get(url)).status, 200);
  assert.ok(!(await request(app).get('/api/jobs').query({ q: `Edited ${token}` })).body.data.some((j) => j.id === job.id));

  assert.equal((await employerA.patch(url).send({ status: 'open' })).status, 200);
  assert.equal((await request(app).get(url)).status, 200);

  assert.equal((await employerA.delete(url)).status, 204);
  assert.equal((await employerA.get(url)).status, 404);
});

test('expired listings disappear from public view', async () => {
  const job = (await employerA.post('/api/jobs').send(jobBody({ title: `Expiring ${token}` }))).body.job;
  await pool.query("UPDATE jobs SET expires_at = now() - interval '1 day' WHERE id = $1", [job.id]);
  assert.equal((await request(app).get(`/api/jobs/${job.id}`)).status, 404);
  assert.ok(!(await request(app).get('/api/jobs').query({ q: `Expiring ${token}` })).body.data.some((j) => j.id === job.id));
  assert.equal((await employerA.get(`/api/jobs/${job.id}`)).status, 200);
});

test('employer dashboard lists only own jobs, all statuses, with applicant counts', async () => {
  const mine = await employerA.get('/api/employer/jobs');
  assert.equal(mine.status, 200);
  assert.ok(mine.body.data.length > 0);
  assert.ok(mine.body.data.every((j) => j.company.name === 'Test Co empa' && j.applicantCount === 0));
  assert.ok(mine.body.data.some((j) => j.status === 'draft'));

  const drafts = await employerA.get('/api/employer/jobs').query({ status: 'draft' });
  assert.ok(drafts.body.data.every((j) => j.status === 'draft'));

  assert.equal((await seeker.get('/api/employer/jobs')).status, 403);
  assert.equal((await request(app).get('/api/employer/jobs')).status, 401);
});
