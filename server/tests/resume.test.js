// Integration tests against the database in DATABASE_URL, with files written to a temp folder.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobflow-resumes-'));
process.env.NODE_ENV = 'test';
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOAD_DIR = uploadDir;
process.env.MAX_RESUME_MB = '1';

const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { createLocalDriver } = await import('../src/storage/localDriver.js');
const { createS3Driver } = await import('../src/storage/s3Driver.js');
const { safeFilename } = await import('../src/services/resumeService.js');

const DOMAIN = '@resumetest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Sup3rSecret';
const pdf = (extra = '') => Buffer.from(`%PDF-1.4\n% jobflow test ${extra}\n%%EOF\n`);

async function signUp(name, role) {
  const agent = request.agent(app);
  const body = { fullName: `Test ${name}`, email: `${name}-${run}${DOMAIN}`, password: PASSWORD, role };
  if (role === 'employer') body.companyName = `Test Co ${name}`;
  const res = await agent.post('/api/auth/register').send(body);
  assert.equal(res.status, 201);
  return { agent, id: res.body.user.id };
}
const storedKey = async (userId) =>
  (await pool.query('SELECT resume_key FROM seeker_profiles WHERE user_id = $1', [userId])).rows[0].resume_key;
const onDisk = (key) => fs.existsSync(path.join(uploadDir, key));

let seeker, other, employer;
before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  seeker = await signUp('seek', 'seeker');
  other = await signUp('other', 'seeker');
  employer = await signUp('emp', 'employer');
});
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  await pool.end();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

test('upload, profile reflects it, download returns the same bytes', async () => {
  const body = pdf('v1');
  const up = await seeker.agent.put('/api/me/resume').attach('resume', body, { filename: 'My CV.pdf', contentType: 'application/pdf' });
  assert.equal(up.status, 200);
  assert.equal(up.body.resume.filename, 'My CV.pdf');

  const me = await seeker.agent.get('/api/auth/me');
  assert.equal(me.body.profile.resumeFilename, 'My CV.pdf');
  assert.ok(!JSON.stringify(me.body).includes('resumes/')); // the storage key never leaks

  const key = await storedKey(seeker.id);
  assert.match(key, new RegExp(`^resumes/${seeker.id}/[0-9a-f-]{36}\\.pdf$`));
  assert.ok(onDisk(key));

  const dl = await seeker.agent.get('/api/me/resume').buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(dl.status, 200);
  assert.match(dl.headers['content-type'], /application\/pdf/);
  assert.match(dl.headers['content-disposition'], /attachment; filename="My CV\.pdf"/);
  assert.match(dl.headers['cache-control'], /no-store/);
  assert.deepEqual(dl.body, body);
});

test('rejects non-PDF content, empty files, missing files and oversized files', async () => {
  const fake = await seeker.agent.put('/api/me/resume').attach('resume', Buffer.from('just text'), { filename: 'cv.pdf', contentType: 'application/pdf' });
  assert.equal(fake.status, 400);

  const empty = await seeker.agent.put('/api/me/resume').attach('resume', Buffer.alloc(0), { filename: 'cv.pdf' });
  assert.equal(empty.status, 400);

  assert.equal((await seeker.agent.put('/api/me/resume')).status, 400);
  assert.equal((await seeker.agent.put('/api/me/resume').attach('wrongfield', pdf(), 'cv.pdf')).status, 400);

  const big = Buffer.concat([pdf(), Buffer.alloc(1.5 * 1024 * 1024)]);
  const tooBig = await seeker.agent.put('/api/me/resume').attach('resume', big, { filename: 'big.pdf' });
  assert.equal(tooBig.status, 413);
  assert.equal(tooBig.body.error.code, 'FILE_TOO_LARGE');
});

test('only seekers with a session can use the resume endpoints', async () => {
  assert.equal((await request(app).put('/api/me/resume').attach('resume', pdf(), 'cv.pdf')).status, 401);
  assert.equal((await request(app).get('/api/me/resume')).status, 401);
  assert.equal((await employer.agent.put('/api/me/resume').attach('resume', pdf(), 'cv.pdf')).status, 403);
  assert.equal((await employer.agent.get('/api/me/resume')).status, 403);
});

test("a seeker only ever gets their own resume", async () => {
  assert.equal((await other.agent.get('/api/me/resume')).status, 404); // 'other' uploaded nothing
});

test('filenames are sanitised; unicode names survive', async () => {
  assert.equal(safeFilename('../../etc/passwd'), 'passwd.pdf');
  assert.equal(safeFilename('C:\\Users\\me\\cv.PDF'), 'cv.pdf');
  assert.equal(safeFilename('a<b>:"|?*.pdf'), 'ab.pdf');
  assert.equal(safeFilename(''), 'resume.pdf');
  assert.equal(safeFilename(undefined), 'resume.pdf');

  const evil = await other.agent.put('/api/me/resume').attach('resume', pdf('evil'), { filename: '../../evil.pdf' });
  assert.equal(evil.body.resume.filename, 'evil.pdf');
  assert.ok(onDisk(await storedKey(other.id)));

  const name = 'résumé සිංහල.pdf';
  const uni = await other.agent.put('/api/me/resume').attach('resume', pdf('uni'), { filename: name });
  assert.equal(uni.body.resume.filename, name);
});

test('replacing the resume deletes the old file, unless an application still uses it', async () => {
  await seeker.agent.put('/api/me/resume').attach('resume', pdf('a'), 'a.pdf');
  const keyA = await storedKey(seeker.id);
  await seeker.agent.put('/api/me/resume').attach('resume', pdf('b'), 'b.pdf');
  const keyB = await storedKey(seeker.id);
  assert.notEqual(keyA, keyB);
  assert.ok(!onDisk(keyA), 'old file should be deleted');
  assert.ok(onDisk(keyB));

  // an application that used the current resume as its attachment
  const job = (await employer.agent.post('/api/jobs').send({
    title: 'Resume test job', description: 'A job used only by the resume test suite.', jobType: 'full_time', workMode: 'remote',
  })).body.job;
  await pool.query(
    'INSERT INTO applications (job_id, seeker_id, resume_key, resume_filename) VALUES ($1, $2, $3, $4)',
    [job.id, seeker.id, keyB, 'b.pdf'],
  );
  await seeker.agent.put('/api/me/resume').attach('resume', pdf('c'), 'c.pdf');
  assert.ok(onDisk(keyB), 'file referenced by an application must be kept');
});

test('deleting the resume clears the profile and the file', async () => {
  await other.agent.put('/api/me/resume').attach('resume', pdf('del'), 'del.pdf');
  const key = await storedKey(other.id);
  assert.equal((await other.agent.delete('/api/me/resume')).status, 204);
  assert.ok(!onDisk(key));
  assert.equal((await other.agent.get('/api/me/resume')).status, 404);
  assert.equal((await other.agent.delete('/api/me/resume')).status, 404);
  assert.equal((await other.agent.get('/api/auth/me')).body.profile.resumeFilename, null);
});

test('local driver refuses path traversal and never overwrites', async () => {
  const driver = createLocalDriver(uploadDir);
  await assert.rejects(driver.put('../escape.pdf', Buffer.from('x')), /Invalid storage key/);
  await assert.rejects(driver.get('../../etc/passwd'), /Invalid storage key/);
  await driver.put('resumes/x/once.pdf', Buffer.from('1'));
  await assert.rejects(driver.put('resumes/x/once.pdf', Buffer.from('2')), /EEXIST/);
  await assert.rejects(driver.get('resumes/x/missing.pdf'), (e) => e.status === 404);
});

test('S3 driver sends the right commands and maps missing keys to 404', async () => {
  const objects = new Map();
  const client = {
    async send(cmd) {
      const { Bucket, Key, Body, ContentType } = cmd.input;
      assert.equal(Bucket, 'test-bucket');
      switch (cmd.constructor.name) {
        case 'PutObjectCommand': objects.set(Key, { Body, ContentType }); return {};
        case 'GetObjectCommand': {
          if (!objects.has(Key)) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
          return { Body: Readable.from([objects.get(Key).Body]) };
        }
        case 'DeleteObjectCommand': objects.delete(Key); return {};
        default: throw new Error(`unexpected ${cmd.constructor.name}`);
      }
    },
  };
  const driver = createS3Driver({ client, bucket: 'test-bucket' });
  await driver.put('resumes/u/1.pdf', pdf('s3'), 'application/pdf');
  assert.equal(objects.get('resumes/u/1.pdf').ContentType, 'application/pdf');
  const chunks = [];
  for await (const c of await driver.get('resumes/u/1.pdf')) chunks.push(c);
  assert.deepEqual(Buffer.concat(chunks), pdf('s3'));
  await driver.delete('resumes/u/1.pdf');
  await assert.rejects(driver.get('resumes/u/1.pdf'), (e) => e.status === 404);
});
