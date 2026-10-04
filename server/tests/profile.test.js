// Integration tests against the database in DATABASE_URL (use your dev DB, never production).
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const DOMAIN = '@profiletest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Sup3rSecret';

async function signUp(name, role) {
  const agent = request.agent(app);
  const body = { fullName: `Test ${name}`, email: `${name}-${run}${DOMAIN}`, password: PASSWORD, role };
  if (role === 'employer') body.companyName = `Test Co ${name}`;
  assert.equal((await agent.post('/api/auth/register').send(body)).status, 201);
  return agent;
}

let seeker, employer;
before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  seeker = await signUp('seek', 'seeker');
  employer = await signUp('emp', 'employer');
});
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  await pool.end();
});

test('seeker updates their profile; skills are trimmed and de-duplicated', async () => {
  const res = await seeker.patch('/api/me/profile').send({
    fullName: '  New Name  ',
    headline: 'Full stack developer',
    bio: 'I build things.',
    skills: ['React', ' react ', 'Node.js', 'SQL', 'sql'],
    location: 'Kandy',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.fullName, 'New Name');
  assert.deepEqual(res.body.profile.skills, ['React', 'Node.js', 'SQL']);
  assert.equal(res.body.profile.headline, 'Full stack developer');

  const me = await seeker.get('/api/auth/me');
  assert.equal(me.body.profile.location, 'Kandy');
  assert.equal(me.body.user.fullName, 'New Name');
});

test('partial updates keep other fields; empty strings and null clear a field', async () => {
  const res = await seeker.patch('/api/me/profile').send({ location: '' });
  assert.equal(res.body.profile.location, null);
  assert.equal(res.body.profile.headline, 'Full stack developer'); // untouched
  assert.equal((await seeker.patch('/api/me/profile').send({ bio: null })).body.profile.bio, null);
  assert.deepEqual((await seeker.patch('/api/me/profile').send({ skills: [] })).body.profile.skills, []);
});

test('seeker input is validated', async () => {
  const bad = [
    {},
    { headline: 'x'.repeat(161) },
    { bio: 'x'.repeat(2001) },
    { skills: Array.from({ length: 21 }, (_, i) => `skill${i}`) },
    { skills: ['x'.repeat(41)] },
    { skills: [''] },
    { skills: 'React' },
    { fullName: 'x' },
    { companyName: 'Not for seekers' },
    { website: 'https://example.com' },
  ];
  for (const body of bad) assert.equal((await seeker.patch('/api/me/profile').send(body)).status, 400, JSON.stringify(body));
});

test('employer updates the company; listings show the new details', async () => {
  const res = await employer.patch('/api/me/profile').send({
    name: 'Renamed Co', description: 'We build products.', website: 'https://renamed.example', location: 'Colombo',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.company.name, 'Renamed Co');
  assert.equal(res.body.company.website, 'https://renamed.example');

  const job = (await employer.post('/api/jobs').send({
    title: `Profile test ${run}`, description: 'A job used only by the profile test suite.', jobType: 'full_time', workMode: 'remote',
  })).body.job;
  assert.equal(job.company.name, 'Renamed Co');

  assert.equal((await employer.patch('/api/me/profile').send({ website: '' })).body.company.website, null);
  assert.equal((await employer.patch('/api/me/profile').send({ fullName: 'Boss Person' })).body.user.fullName, 'Boss Person');
});

test('employer input is validated; website must be http(s)', async () => {
  const bad = [
    {},
    { name: 'x' },
    { website: 'javascript:alert(1)' },
    { website: 'ftp://files.example.com' },
    { website: 'not a url' },
    { description: 'x'.repeat(5001) },
    { skills: ['React'] },
    { headline: 'Not for employers' },
  ];
  for (const body of bad) assert.equal((await employer.patch('/api/me/profile').send(body)).status, 400, JSON.stringify(body));
});

test('profile updates need a session', async () => {
  assert.equal((await request(app).patch('/api/me/profile').send({ headline: 'x' })).status, 401);
});
