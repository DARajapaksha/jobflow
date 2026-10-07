// Integration tests against the database in DATABASE_URL, with files written to a temp folder.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobflow-images-'));
process.env.NODE_ENV = 'test';
process.env.STORAGE_DRIVER = 'local';
process.env.UPLOAD_DIR = uploadDir;
process.env.MAX_IMAGE_MB = '1';

const { default: request } = await import('supertest');
const { default: sharp } = await import('sharp');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const DOMAIN = '@imagetest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Sup3rSecret';

const solid = (w, h, channels = 3, background = '#1f3fbf') => sharp({ create: { width: w, height: h, channels, background } });
const png = (w, h) => solid(w, h).png().toBuffer();
const pdf = Buffer.from('%PDF-1.4\n% image test\n%%EOF\n');
const fetchBuffer = (test) => test.buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
const filesIn = (dir) => (fs.existsSync(path.join(uploadDir, dir)) ? fs.readdirSync(path.join(uploadDir, dir)) : []);

async function signUp(name, role) {
  const agent = request.agent(app);
  const body = { fullName: `Test ${name}`, email: `${name}-${run}${DOMAIN}`, password: PASSWORD, role };
  if (role === 'employer') body.companyName = `Test Co ${name}`;
  const res = await agent.post('/api/auth/register').send(body);
  assert.equal(res.status, 201);
  const me = await agent.get('/api/auth/me');
  return { agent, id: res.body.user.id, companyId: me.body.company?.id };
}
const attach = (agent, url, buffer, filename = 'pic.png') => agent.put(url).attach('image', buffer, { filename });

let seeker, other, empA, empB;
before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  seeker = await signUp('seek', 'seeker');
  other = await signUp('other', 'seeker');
  empA = await signUp('empa', 'employer');
  empB = await signUp('empb', 'employer');
});
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  await pool.end();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

test('avatar: any shape becomes a 256px square WebP, and the profile points at it', async () => {
  const up = await attach(seeker.agent, '/api/me/avatar', await solid(800, 400).png().toBuffer());
  assert.equal(up.status, 200);
  assert.match(up.body.avatarUrl, new RegExp(`^/api/users/${seeker.id}/avatar\\?v=[0-9a-f]{8}$`));

  const me = await seeker.agent.get('/api/auth/me');
  assert.equal(me.body.profile.avatarUrl, up.body.avatarUrl);
  assert.ok(!JSON.stringify(me.body).includes('avatars/'), 'storage key must not leak');

  const img = await fetchBuffer(seeker.agent.get(up.body.avatarUrl));
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/webp');
  assert.match(img.headers['cache-control'], /^private, max-age=\d+$/);
  assert.match(img.headers.vary, /Cookie/); // a cached copy is never reused for another login
  const meta = await sharp(img.body).metadata();
  assert.deepEqual([meta.width, meta.height, meta.format], [256, 256, 'webp']);
});

test('uploads are re-encoded: EXIF (e.g. GPS location) is stripped and rotation is applied', async () => {
  const withExif = await solid(600, 400).jpeg().withExif({ IFD0: { Copyright: 'secret-location', Orientation: '6' } }).toBuffer();
  assert.ok((await sharp(withExif).metadata()).exif, 'test image should carry EXIF');
  const up = await attach(other.agent, '/api/me/avatar', withExif, 'photo.jpg');
  assert.equal(up.status, 200);
  const stored = await fetchBuffer(other.agent.get(up.body.avatarUrl));
  const meta = await sharp(stored.body).metadata();
  assert.equal(meta.exif, undefined);
  assert.ok(!stored.body.toString('latin1').includes('secret-location'));
});

test('rejects non-images, SVG, GIF, tiny images, image bombs, empty and oversized files', async () => {
  const bad = {
    'not an image': Buffer.from('just text, renamed'),
    svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script><rect width="100" height="100"/></svg>'),
    gif: await solid(100, 100).gif().toBuffer(),
    'too small': await png(16, 16),
    'too many pixels': await solid(6000, 6000).png({ compressionLevel: 9 }).toBuffer(),
    empty: Buffer.alloc(0),
  };
  for (const [name, buffer] of Object.entries(bad)) {
    const res = await attach(seeker.agent, '/api/me/avatar', buffer);
    assert.equal(res.status, 400, name);
  }
  const big = await attach(seeker.agent, '/api/me/avatar', Buffer.alloc(1.5 * 1024 * 1024));
  assert.equal(big.status, 413);
  assert.equal(big.body.error.code, 'FILE_TOO_LARGE');
  assert.equal((await seeker.agent.put('/api/me/avatar')).status, 400);
  assert.equal((await seeker.agent.put('/api/me/avatar').attach('wrongfield', await png(100, 100), 'a.png')).status, 400);
});

test('roles and sessions: avatars are for seekers, logos for employers', async () => {
  const image = await png(100, 100);
  assert.equal((await request(app).put('/api/me/avatar').attach('image', image, 'a.png')).status, 401);
  assert.equal((await empA.agent.put('/api/me/avatar').attach('image', image, 'a.png')).status, 403);
  assert.equal((await seeker.agent.put('/api/me/logo').attach('image', image, 'a.png')).status, 403);
  assert.equal((await request(app).put('/api/me/logo').attach('image', image, 'a.png')).status, 401);
});

test('replacing an avatar deletes the old file; removing it clears the profile and the file', async () => {
  await attach(other.agent, '/api/me/avatar', await png(200, 200));
  const before = filesIn(`avatars/${other.id}`);
  assert.equal(before.length, 1);
  await attach(other.agent, '/api/me/avatar', await solid(200, 200, 3, '#c33').png().toBuffer());
  const after = filesIn(`avatars/${other.id}`);
  assert.equal(after.length, 1);
  assert.notEqual(after[0], before[0]);

  assert.equal((await other.agent.delete('/api/me/avatar')).status, 204);
  assert.equal(filesIn(`avatars/${other.id}`).length, 0);
  assert.equal((await other.agent.get('/api/auth/me')).body.profile.avatarUrl, null);
  assert.equal((await other.agent.delete('/api/me/avatar')).status, 404);
});

test("a seeker's photo is visible to them and to employers they applied to, nobody else", async () => {
  const url = (await seeker.agent.get('/api/auth/me')).body.profile.avatarUrl;
  assert.equal((await seeker.agent.get(url)).status, 200);
  assert.equal((await other.agent.get(url)).status, 404); // another seeker
  assert.equal((await empA.agent.get(url)).status, 404); // employer, no application yet
  assert.equal((await request(app).get(url)).status, 401);

  const job = (await empA.agent.post('/api/jobs').send({
    title: `Image test ${run}`, description: 'A job used only by the image test suite.', jobType: 'full_time', workMode: 'remote',
  })).body.job;
  assert.equal((await seeker.agent.post(`/api/jobs/${job.id}/applications`).attach('resume', pdf, 'cv.pdf')).status, 201);

  assert.equal((await empA.agent.get(url)).status, 200); // now the owner of that job can see it
  assert.equal((await empB.agent.get(url)).status, 404); // a different employer still cannot

  const applicants = await empA.agent.get(`/api/jobs/${job.id}/applications`);
  assert.equal(applicants.body.data[0].applicant.avatarUrl, url);
  assert.equal((await seeker.agent.get('/api/users/not-a-uuid/avatar')).status, 400);
});

test('logo: keeps its shape and transparency, never upscales, and appears everywhere the company does', async () => {
  const wide = await solid(1000, 500, 4, { r: 31, g: 63, b: 191, alpha: 0.5 }).png().toBuffer();
  const up = await attach(empA.agent, '/api/me/logo', wide, 'logo.png');
  assert.equal(up.status, 200);
  assert.match(up.body.logoUrl, new RegExp(`^/api/companies/${empA.companyId}/logo\\?v=[0-9a-f]{8}$`));

  const logo = await fetchBuffer(request(app).get(up.body.logoUrl)); // public: no login
  assert.equal(logo.status, 200);
  assert.equal(logo.headers['content-type'], 'image/webp');
  assert.match(logo.headers['cache-control'], /public.*immutable/);
  const meta = await sharp(logo.body).metadata();
  assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [512, 256, true]);

  const small = await attach(empB.agent, '/api/me/logo', await png(100, 50), 'small.png');
  const smallMeta = await sharp((await fetchBuffer(request(app).get(small.body.logoUrl))).body).metadata();
  assert.deepEqual([smallMeta.width, smallMeta.height], [100, 50]);

  assert.equal((await empA.agent.get('/api/auth/me')).body.company.logoUrl, up.body.logoUrl);
  const search = await request(app).get('/api/jobs').query({ company: empA.companyId });
  assert.ok(search.body.data.length > 0 && search.body.data.every((j) => j.company.logoUrl === up.body.logoUrl));
  assert.equal((await request(app).get(`/api/companies/${empA.companyId}`)).body.company.logoUrl, up.body.logoUrl);
  const list = await request(app).get('/api/companies').query({ q: `Test Co empa` });
  assert.equal(list.body.data.find((c) => c.id === empA.companyId).logoUrl, up.body.logoUrl);
});

test('logo: replace and remove clean up files; a company without a logo is a 404', async () => {
  const dir = `logos/${empB.companyId}`;
  const first = filesIn(dir);
  await attach(empB.agent, '/api/me/logo', await solid(200, 200, 3, '#393').png().toBuffer());
  const second = filesIn(dir);
  assert.equal(second.length, 1);
  assert.notEqual(second[0], first[0]);

  assert.equal((await empB.agent.delete('/api/me/logo')).status, 204);
  assert.equal(filesIn(dir).length, 0);
  assert.equal((await empB.agent.get('/api/auth/me')).body.company.logoUrl, null);
  assert.equal((await request(app).get(`/api/companies/${empB.companyId}/logo`)).status, 404);
  assert.equal((await empB.agent.delete('/api/me/logo')).status, 404);
  assert.equal((await request(app).get('/api/companies/not-a-uuid/logo')).status, 400);
});
