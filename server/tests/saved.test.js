// Integration tests against the database in DATABASE_URL (use your dev DB, never production).
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const DOMAIN = '@savedtest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Sup3rSecret';

async function signUp(name, role) {
  const agent = request.agent(app);
  const body = { fullName: `Test ${name}`, email: `${name}-${run}${DOMAIN}`, password: PASSWORD, role };
  if (role === 'employer') body.companyName = `Test Co ${name}`;
  assert.equal((await agent.post('/api/auth/register').send(body)).status, 201);
  return agent;
}
const newJob = async (agent, over = {}) => {
  const res = await agent.post('/api/jobs').send({
    title: `Saved test ${run}`, description: 'A job used only by the saved-jobs test suite.', jobType: 'full_time', workMode: 'remote', ...over,
  });
  assert.equal(res.status, 201);
  return res.body.job;
};

let employer, seeker, other;
before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  employer = await signUp('emp', 'employer');
  seeker = await signUp('seek', 'seeker');
  other = await signUp('other', 'seeker');
});
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  await pool.end();
});

test('save and unsave are idempotent and appear in the saved list', async () => {
  const job = await newJob(employer);
  const url = `/api/jobs/${job.id}/save`;

  assert.deepEqual((await seeker.post(url)).body, { saved: true });
  assert.equal((await seeker.post(url)).status, 200); // saving twice is harmless

  const list = await seeker.get('/api/me/saved-jobs');
  assert.equal(list.status, 200);
  const entry = list.body.data.find((j) => j.id === job.id);
  assert.equal(entry.available, true);
  assert.ok(entry.savedAt);
  assert.equal(entry.company.name, 'Test Co emp');
  assert.equal(list.body.pagination.total, 1);

  assert.equal((await seeker.delete(url)).status, 204);
  assert.equal((await seeker.delete(url)).status, 204); // unsaving twice is harmless
  assert.equal((await seeker.get('/api/me/saved-jobs')).body.pagination.total, 0);
});

test('only open jobs can be saved; role and input checks', async () => {
  const draft = await newJob(employer, { status: 'draft' });
  const closed = await newJob(employer);
  await employer.patch(`/api/jobs/${closed.id}`).send({ status: 'closed' });
  for (const id of [draft.id, closed.id, '00000000-0000-4000-8000-000000000000']) {
    assert.equal((await seeker.post(`/api/jobs/${id}/save`)).status, 404, id);
  }
  assert.equal((await seeker.post('/api/jobs/not-a-uuid/save')).status, 400);

  const open = await newJob(employer);
  assert.equal((await employer.post(`/api/jobs/${open.id}/save`)).status, 403);
  assert.equal((await request(app).post(`/api/jobs/${open.id}/save`)).status, 401);
  assert.equal((await request(app).get('/api/me/saved-jobs')).status, 401);
  assert.equal((await employer.get('/api/me/saved-jobs')).status, 403);
});

test("lists are private, newest first and paginated", async () => {
  const jobs = [];
  for (let i = 0; i < 3; i++) {
    const job = await newJob(employer, { title: `Paged ${i} ${run}` });
    await other.post(`/api/jobs/${job.id}/save`);
    jobs.push(job);
  }
  const p1 = await other.get('/api/me/saved-jobs').query({ limit: 2, page: 1 });
  const p2 = await other.get('/api/me/saved-jobs').query({ limit: 2, page: 2 });
  assert.equal(p1.body.pagination.total >= 3, true);
  assert.equal(p1.body.data.length, 2);
  assert.equal(p1.body.data[0].id, jobs[2].id); // most recently saved first
  assert.ok(!p2.body.data.some((j) => p1.body.data.map((x) => x.id).includes(j.id)));

  const mine = await seeker.get('/api/me/saved-jobs');
  assert.ok(!mine.body.data.some((j) => jobs.some((x) => x.id === j.id)));
  assert.equal((await other.get('/api/me/saved-jobs').query({ limit: 1000 })).status, 400);
});

test('closed jobs stay in the list as unavailable, drafts disappear, deleted jobs vanish', async () => {
  const job = await newJob(employer, { title: `Lifecycle ${run}` });
  await seeker.post(`/api/jobs/${job.id}/save`);
  const find = async () => (await seeker.get('/api/me/saved-jobs').query({ limit: 50 })).body.data.find((j) => j.id === job.id);

  assert.equal((await find()).available, true);
  await employer.patch(`/api/jobs/${job.id}`).send({ status: 'closed' });
  assert.equal((await find()).available, false);
  await employer.patch(`/api/jobs/${job.id}`).send({ status: 'draft' });
  assert.equal(await find(), undefined);
  await employer.patch(`/api/jobs/${job.id}`).send({ status: 'open' });
  await pool.query("UPDATE jobs SET expires_at = now() - interval '1 day' WHERE id = $1", [job.id]);
  assert.equal((await find()).available, false);
  await employer.delete(`/api/jobs/${job.id}`);
  assert.equal(await find(), undefined);
});

test('search results and job detail tell a logged-in seeker what is saved', async () => {
  const job = await newJob(employer, { title: `Flagged ${run}` });
  const other2 = await newJob(employer, { title: `Flagged ${run} second` });
  await seeker.post(`/api/jobs/${job.id}/save`);

  const search = await seeker.get('/api/jobs').query({ q: `Flagged ${run}` });
  assert.equal(search.body.data.find((j) => j.id === job.id).saved, true);
  assert.equal(search.body.data.find((j) => j.id === other2.id).saved, false);

  const anon = await request(app).get('/api/jobs').query({ q: `Flagged ${run}` });
  assert.ok(anon.body.data.every((j) => !('saved' in j)));

  assert.equal((await seeker.get(`/api/jobs/${job.id}`)).body.viewer.saved, true);
  assert.equal((await seeker.get(`/api/jobs/${other2.id}`)).body.viewer.saved, false);
  assert.ok(!('viewer' in (await request(app).get(`/api/jobs/${job.id}`)).body));
});
