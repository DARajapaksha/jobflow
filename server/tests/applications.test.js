// Integration tests against the database in DATABASE_URL, with files written to a temp folder.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobflow-apps-'));
process.env.NODE_ENV = 'test';
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOAD_DIR = uploadDir;

const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const DOMAIN = '@apptest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Sup3rSecret';
const pdf = (extra = '') => Buffer.from(`%PDF-1.4\n% application test ${extra}\n%%EOF\n`);

async function signUp(name, role) {
  const agent = request.agent(app);
  const body = { fullName: `Test ${name}`, email: `${name}-${run}${DOMAIN}`, password: PASSWORD, role };
  if (role === 'employer') body.companyName = `Test Co ${name}`;
  const res = await agent.post('/api/auth/register').send(body);
  assert.equal(res.status, 201);
  return { agent, id: res.body.user.id };
}
const newJob = async (employer, over = {}) => {
  const res = await employer.agent.post('/api/jobs').send({
    title: `App test ${run}`, description: 'A job used only by the applications test suite.', jobType: 'full_time', workMode: 'remote', ...over,
  });
  assert.equal(res.status, 201);
  return res.body.job;
};
const download = (agent, url) =>
  agent.get(url).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
const filesOf = (userId) => {
  const dir = path.join(uploadDir, 'resumes', userId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

let empA, empB, seekerA, seekerB;
before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  empA = await signUp('empa', 'employer');
  empB = await signUp('empb', 'employer');
  seekerA = await signUp('seeka', 'seeker');
  seekerB = await signUp('seekb', 'seeker');
});
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  await pool.end();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

test('apply with an uploaded resume and cover letter', async () => {
  const job = await newJob(empA);
  const res = await seekerA.agent
    .post(`/api/jobs/${job.id}/applications`)
    .field('coverLetter', 'I would love to join the team.')
    .attach('resume', pdf('1'), { filename: 'cv.pdf', contentType: 'application/pdf' });
  assert.equal(res.status, 201);
  const a = res.body.application;
  assert.equal(a.status, 'submitted');
  assert.equal(a.coverLetter, 'I would love to join the team.');
  assert.equal(a.resume.filename, 'cv.pdf');
  assert.equal(a.job.id, job.id);
  assert.ok(!JSON.stringify(a).includes('resumes/'), 'storage key must not leak');
  assert.ok(!('ownerId' in a) && !('seekerId' in a) && !('resumeKey' in a));

  const mine = await empA.agent.get('/api/employer/jobs');
  assert.equal(mine.body.data.find((j) => j.id === job.id).applicantCount, 1);
});

test('duplicate application is rejected and leaves no orphan file', async () => {
  const job = await newJob(empA);
  const first = await seekerA.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf('d1'), 'cv.pdf');
  assert.equal(first.status, 201);
  const before = filesOf(seekerA.id).length;
  const second = await seekerA.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf('d2'), 'cv2.pdf');
  assert.equal(second.status, 409);
  assert.equal(filesOf(seekerA.id).length, before);
});

test('without a file the saved default resume is used; replacing it keeps the application file', async () => {
  const job = await newJob(empA);
  const noResume = await seekerB.agent.post(`/api/jobs/${job.id}/applications`).field('coverLetter', 'hi');
  assert.equal(noResume.status, 400);

  await seekerB.agent.put('/api/me/resume').attach('resume', pdf('default'), 'default.pdf');
  const res = await seekerB.agent.post(`/api/jobs/${job.id}/applications`);
  assert.equal(res.status, 201);
  assert.equal(res.body.application.resume.filename, 'default.pdf');
  assert.equal(res.body.application.coverLetter, null);

  await seekerB.agent.put('/api/me/resume').attach('resume', pdf('newer'), 'newer.pdf');
  const dl = await download(empA.agent, `/api/applications/${res.body.application.id}/resume`);
  assert.equal(dl.status, 200);
  assert.deepEqual(dl.body, pdf('default')); // still the resume that was sent, not the new default
});

test('cannot apply to missing, draft, closed or expired jobs; role and input checks', async () => {
  const draft = await newJob(empA, { status: 'draft' });
  const closed = await newJob(empA);
  await empA.agent.patch(`/api/jobs/${closed.id}`).send({ status: 'closed' });
  const expired = await newJob(empA);
  await pool.query("UPDATE jobs SET expires_at = now() - interval '1 day' WHERE id = $1", [expired.id]);

  const apply = (id, agent = seekerB.agent) => agent.post(`/api/jobs/${id}/applications`).attach('resume', pdf('x'), 'cv.pdf');
  for (const id of [draft.id, closed.id, expired.id, '00000000-0000-4000-8000-000000000000']) {
    assert.equal((await apply(id)).status, 404, id);
  }
  assert.equal((await apply('not-a-uuid')).status, 400);

  const open = await newJob(empA);
  assert.equal((await apply(open.id, empB.agent)).status, 403);
  assert.equal((await request(app).post(`/api/jobs/${open.id}/applications`).attach('resume', pdf('x'), 'cv.pdf')).status, 401);

  const long = await apply(open.id).field('coverLetter', 'x'.repeat(5001));
  assert.equal(long.status, 400);
  const notPdf = await seekerB.agent.post(`/api/jobs/${open.id}/applications`).attach('resume', Buffer.from('plain text'), 'cv.pdf');
  assert.equal(notPdf.status, 400);
  const still = await seekerB.agent.get('/api/me/applications');
  assert.ok(!still.body.data.some((a) => a.job.id === open.id), 'failed attempts must not create applications');
});

test("a seeker's application list shows only their own, with job info and no applicant data", async () => {
  const job = await newJob(empB);
  await seekerA.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf('l'), 'cv.pdf');
  const mine = await seekerA.agent.get('/api/me/applications');
  assert.equal(mine.status, 200);
  const entry = mine.body.data.find((a) => a.job.id === job.id);
  assert.equal(entry.job.company.name, 'Test Co empb');
  assert.ok(!('applicant' in entry));
  assert.ok(mine.body.data.every((a) => a.status));
  assert.ok(!(await seekerB.agent.get('/api/me/applications')).body.data.some((a) => a.job.id === job.id));
  const filtered = await seekerA.agent.get('/api/me/applications').query({ status: 'hired' });
  assert.equal(filtered.body.data.length, 0);
  assert.equal((await seekerA.agent.get('/api/me/applications').query({ status: 'nope' })).status, 400);
});

test('job detail tells a seeker whether they already applied', async () => {
  const job = await newJob(empB);
  const before = await seekerB.agent.get(`/api/jobs/${job.id}`);
  assert.equal(before.body.viewer.application, null);
  await seekerB.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf('v'), 'cv.pdf');
  const after = await seekerB.agent.get(`/api/jobs/${job.id}`);
  assert.equal(after.body.viewer.application.status, 'submitted');
  assert.ok(!('viewer' in (await request(app).get(`/api/jobs/${job.id}`)).body));
});

test('employer lists applicants of their own job only, with filters and pagination', async () => {
  const job = await newJob(empA, { title: `Applicants ${run}` });
  const a1 = await seekerA.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf('p1'), 'a.pdf');
  await seekerB.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf('p2'), 'b.pdf');
  await empA.agent.patch(`/api/applications/${a1.body.application.id}/status`).send({ status: 'reviewed' });

  const all = await empA.agent.get(`/api/jobs/${job.id}/applications`);
  assert.equal(all.status, 200);
  assert.equal(all.body.pagination.total, 2);
  const row = all.body.data[0];
  assert.ok(row.applicant.email.endsWith(DOMAIN));
  assert.ok(!('job' in row) && !('resumeKey' in row));

  assert.equal((await empA.agent.get(`/api/jobs/${job.id}/applications`).query({ status: 'reviewed' })).body.pagination.total, 1);
  const p1 = await empA.agent.get(`/api/jobs/${job.id}/applications`).query({ limit: 1, page: 1 });
  const p2 = await empA.agent.get(`/api/jobs/${job.id}/applications`).query({ limit: 1, page: 2 });
  assert.equal(p1.body.pagination.totalPages, 2);
  assert.notEqual(p1.body.data[0].id, p2.body.data[0].id);

  assert.equal((await empB.agent.get(`/api/jobs/${job.id}/applications`)).status, 403);
  assert.equal((await seekerA.agent.get(`/api/jobs/${job.id}/applications`)).status, 403);
  assert.equal((await request(app).get(`/api/jobs/${job.id}/applications`)).status, 401);
  assert.equal((await empA.agent.get('/api/jobs/00000000-0000-4000-8000-000000000000/applications')).status, 404);
});

test('status changes follow the allowed transitions', async () => {
  const job = await newJob(empA);
  const { body } = await seekerA.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf('s'), 'cv.pdf');
  const url = `/api/applications/${body.application.id}/status`;
  const set = (status, agent = empA.agent) => agent.patch(url).send({ status });

  assert.equal((await set('shortlisted')).status, 409); // must be reviewed first
  assert.equal((await set('hired')).status, 409);
  assert.equal((await set('submitted')).status, 400); // not a valid target
  assert.equal((await set('bogus')).status, 400);
  assert.equal((await set('reviewed', seekerA.agent)).status, 403); // applicants can't change status
  assert.equal((await set('reviewed', empB.agent)).status, 404); // other employers can't even see it
  assert.equal((await set('reviewed')).body.application.status, 'reviewed');
  assert.equal((await set('shortlisted')).body.application.status, 'shortlisted');
  assert.equal((await set('hired')).body.application.status, 'hired');
  const final = await set('rejected');
  assert.equal(final.status, 409);
  assert.equal(final.body.error.code, 'INVALID_TRANSITION');

  const detail = await seekerA.agent.get(`/api/applications/${body.application.id}`);
  assert.equal(detail.body.application.status, 'hired'); // the applicant sees the outcome
});

test('application detail and resume download are limited to the applicant and the job owner', async () => {
  const job = await newJob(empA);
  const content = pdf('private');
  const { body } = await seekerA.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', content, 'secret cv.pdf');
  const id = body.application.id;

  for (const agent of [seekerA.agent, empA.agent]) {
    assert.equal((await agent.get(`/api/applications/${id}`)).status, 200);
    const dl = await download(agent, `/api/applications/${id}/resume`);
    assert.equal(dl.status, 200);
    assert.match(dl.headers['content-disposition'], /attachment; filename="secret cv\.pdf"/);
    assert.match(dl.headers['content-type'], /application\/pdf/);
    assert.deepEqual(dl.body, content);
  }
  for (const agent of [seekerB.agent, empB.agent]) {
    assert.equal((await agent.get(`/api/applications/${id}`)).status, 404);
    assert.equal((await agent.get(`/api/applications/${id}/resume`)).status, 404);
  }
  assert.equal((await request(app).get(`/api/applications/${id}`)).status, 401);
  assert.equal((await request(app).get(`/api/applications/${id}/resume`)).status, 401);
  assert.equal((await seekerA.agent.get('/api/applications/not-a-uuid')).status, 400);
});
