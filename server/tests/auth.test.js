// Integration tests: run against the database in DATABASE_URL (use your dev DB, never production).
// Test users all use the @authtest.jobflow domain and are deleted afterwards.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');
const { default: jwt } = await import('jsonwebtoken');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { env } = await import('../src/config/env.js');
const { authenticate, requireRole } = await import('../src/middleware/auth.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const DOMAIN = '@authtest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const email = (name) => `${name}-${run}${DOMAIN}`;
const PASSWORD = 'Sup3rSecret';

const seekerBody = (name = 'seeker') => ({ fullName: 'Test Seeker', email: email(name), password: PASSWORD, role: 'seeker' });
const employerBody = (name = 'employer') => ({
  fullName: 'Test Employer', email: email(name), password: PASSWORD, role: 'employer', companyName: 'Test Co',
});

const cleanup = () => pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
before(cleanup);
after(async () => {
  await cleanup();
  await pool.end();
});

test('register seeker: 201, httpOnly cookie, no password hash leaked', async () => {
  const res = await request(app).post('/api/auth/register').send(seekerBody('reg'));
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'seeker');
  assert.equal(res.body.user.email, email('reg'));
  assert.ok(!JSON.stringify(res.body).includes('password'));
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('register: employer needs a company name and gets a company', async () => {
  const bad = await request(app).post('/api/auth/register').send({ ...employerBody('emp0'), companyName: undefined });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'VALIDATION_ERROR');

  const agent = request.agent(app);
  const ok = await agent.post('/api/auth/register').send(employerBody('emp1'));
  assert.equal(ok.status, 201);
  const me = await agent.get('/api/auth/me');
  assert.equal(me.body.company.name, 'Test Co');
});

test('register: duplicate email is rejected case-insensitively', async () => {
  await request(app).post('/api/auth/register').send(seekerBody('dup'));
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...seekerBody('dup'), email: email('dup').toUpperCase() });
  assert.equal(res.status, 409);
});

test('register: weak password, bad email and self-assigned admin role are rejected', async () => {
  const weak = await request(app).post('/api/auth/register').send({ ...seekerBody('weak'), password: 'short1' });
  assert.equal(weak.status, 400);
  const noDigit = await request(app).post('/api/auth/register').send({ ...seekerBody('weak'), password: 'onlyletters' });
  assert.equal(noDigit.status, 400);
  const badEmail = await request(app).post('/api/auth/register').send({ ...seekerBody(), email: 'nope' });
  assert.equal(badEmail.status, 400);
  const admin = await request(app).post('/api/auth/register').send({ ...seekerBody('adm'), role: 'admin' });
  assert.equal(admin.status, 400);
});

test('login: success, and identical error for wrong password and unknown email', async () => {
  await request(app).post('/api/auth/register').send(seekerBody('login'));

  const ok = await request(app).post('/api/auth/login').send({ email: email('login').toUpperCase(), password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.ok(ok.headers['set-cookie'].some((c) => c.startsWith('token=')));

  const wrongPw = await request(app).post('/api/auth/login').send({ email: email('login'), password: 'Wrong1234' });
  const unknown = await request(app).post('/api/auth/login').send({ email: email('ghost'), password: PASSWORD });
  assert.equal(wrongPw.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrongPw.body, unknown.body);
});

test('me: needs a session; cookie and Bearer token both work; logout ends the session', async () => {
  assert.equal((await request(app).get('/api/auth/me')).status, 401);

  const agent = request.agent(app);
  const reg = await agent.post('/api/auth/register').send(seekerBody('me'));
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, email('me'));
  assert.ok('profile' in me.body);

  const token = reg.headers['set-cookie'][0].split(';')[0].replace('token=', '');
  const bearer = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(bearer.status, 200);

  assert.equal((await agent.post('/api/auth/logout')).status, 204);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('tampered, expired and deleted-user tokens are rejected', async () => {
  const reg = await request(app).post('/api/auth/register').send(seekerBody('tok'));
  const id = reg.body.user.id;

  const forged = jwt.sign({ role: 'employer' }, 'wrong-secret', { subject: id });
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status, 401);

  const expired = jwt.sign({ role: 'seeker' }, env.jwtSecret, { subject: id, expiresIn: -10 });
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`)).status, 401);

  const valid = jwt.sign({ role: 'seeker' }, env.jwtSecret, { subject: id });
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${valid}`)).status, 401);
});

test('requireRole: employer-only route returns 403 for seekers, 200 for employers', async () => {
  const mini = express();
  mini.use(cookieParser());
  mini.get('/employer-only', authenticate, requireRole('employer'), (_req, res) => res.json({ ok: true }));
  mini.use(errorHandler);

  const seeker = request.agent(app);
  await seeker.post('/api/auth/register').send(seekerBody('rs'));
  const seekerToken = (await seeker.post('/api/auth/login').send({ email: email('rs'), password: PASSWORD }))
    .headers['set-cookie'][0].split(';')[0];

  const employer = request.agent(app);
  await employer.post('/api/auth/register').send(employerBody('re'));
  const employerToken = (await employer.post('/api/auth/login').send({ email: email('re'), password: PASSWORD }))
    .headers['set-cookie'][0].split(';')[0];

  assert.equal((await request(mini).get('/employer-only')).status, 401);
  assert.equal((await request(mini).get('/employer-only').set('Cookie', seekerToken)).status, 403);
  assert.equal((await request(mini).get('/employer-only').set('Cookie', employerToken)).status, 200);
});
