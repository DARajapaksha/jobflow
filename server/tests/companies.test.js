// Integration tests against the database in DATABASE_URL (use your dev DB, never production).
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const DOMAIN = '@companytest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Sup3rSecret';

async function signUp(name) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({
    fullName: `Test ${name}`, email: `${name}-${run}${DOMAIN}`, password: PASSWORD, role: 'employer', companyName: `Zed${name} ${run}`,
  });
  assert.equal(res.status, 201);
  const me = await agent.get('/api/auth/me');
  return { agent, companyId: me.body.company.id };
}
const post = (agent, over = {}) =>
  agent.post('/api/jobs').send({ title: `Company test ${run}`, description: 'A job used only by the company test suite.', jobType: 'full_time', workMode: 'remote', ...over });

let busy, quiet, idle;
before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  busy = await signUp('busy');
  quiet = await signUp('quiet');
  idle = await signUp('idle');
  await post(busy.agent);
  await post(busy.agent);
  await post(busy.agent, { status: 'draft' }); // not counted
  await post(quiet.agent);
  await post(idle.agent, { status: 'draft' }); // only a draft: company not listed
});
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  await pool.end();
});

test('company list shows only companies with open jobs, busiest first, with counts', async () => {
  const res = await request(app).get('/api/companies').query({ q: `Zed` });
  assert.equal(res.status, 200);
  const mine = res.body.data.filter((c) => c.name.endsWith(run));
  assert.deepEqual(mine.map((c) => [c.id, c.openJobCount]), [[busy.companyId, 2], [quiet.companyId, 1]]);
  assert.ok(!mine.some((c) => c.id === idle.companyId));
  assert.ok(res.body.pagination.total >= 2);
});

test('company search and pagination', async () => {
  const q = await request(app).get('/api/companies').query({ q: `zedquiet ${run}` });
  assert.deepEqual(q.body.data.map((c) => c.id), [quiet.companyId]);

  const p1 = await request(app).get('/api/companies').query({ q: `${run}`, limit: 1, page: 1 });
  const p2 = await request(app).get('/api/companies').query({ q: `${run}`, limit: 1, page: 2 });
  assert.equal(p1.body.pagination.totalPages, 2);
  assert.notEqual(p1.body.data[0].id, p2.body.data[0].id);
  assert.equal((await request(app).get('/api/companies').query({ limit: 500 })).status, 400);
});

test('company detail, including a company with no open jobs; unknown and bad ids', async () => {
  const detail = await request(app).get(`/api/companies/${busy.companyId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.company.openJobCount, 2);
  assert.equal(detail.body.company.name, `Zedbusy ${run}`);

  assert.equal((await request(app).get(`/api/companies/${idle.companyId}`)).body.company.openJobCount, 0);
  assert.equal((await request(app).get('/api/companies/00000000-0000-4000-8000-000000000000')).status, 404);
  assert.equal((await request(app).get('/api/companies/not-a-uuid')).status, 400);
});

test("a company's jobs are available through the job search filter", async () => {
  const res = await request(app).get('/api/jobs').query({ company: busy.companyId });
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 2); // the draft is not public
  assert.ok(res.body.data.every((j) => j.company.id === busy.companyId));
  assert.equal((await request(app).get('/api/jobs').query({ company: 'nope' })).status, 400);
});
