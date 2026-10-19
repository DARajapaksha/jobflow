// Typo-tolerant search, tested against real PostgreSQL with a realistic set of jobs under one throwaway company.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

const DOMAIN = '@fuzzytest.jobflow';
const run = Math.random().toString(36).slice(2, 8);
let employer, companyId, cats;

const JOBS = [
  { title: 'Full Stack Developer', cat: 'Software Engineering', description: 'Build features end to end with React and Node.js for our product team.' },
  { title: 'Fullstack Engineer', cat: 'Software Engineering', description: 'Work across the whole stack of our web platform and its APIs.' },
  { title: 'Full-Stack Web Developer', cat: 'Software Engineering', description: 'Create and maintain websites for clients, from database to browser.' },
  { title: 'Frontend Developer', cat: 'Software Engineering', description: 'Build accessible interfaces with React and modern CSS.' },
  { title: 'Backend Developer (Node.js)', cat: 'Software Engineering', description: 'Design REST services and databases with Express.' },
  { title: 'UI/UX Designer', cat: 'Design', description: 'Design interfaces and run usability tests with real users.' },
  { title: 'Junior Accountant', cat: 'Finance', description: 'Support month-end close, reconciliations and payroll.' },
  { title: 'Data Analyst', cat: 'Data & Analytics', description: 'Turn raw data into dashboards using SQL.' },
  { title: 'QA Engineer', cat: 'Software Engineering', description: 'Test releases and automate regression checks.' },
  { title: 'Digital Marketing Manager', cat: 'Marketing', description: 'Plan campaigns across social channels.' },
];
const FULL_STACK = ['Full Stack Developer', 'Fullstack Engineer', 'Full-Stack Web Developer'];

async function search(q, extra = {}) {
  const res = await request(app).get('/api/jobs').query({ q, company: companyId, limit: 50, ...extra });
  assert.equal(res.status, 200, `search "${q}" failed: ${JSON.stringify(res.body)}`);
  return res.body;
}
const titles = async (q) => (await search(q)).data.map((j) => j.title);
const sorted = (a) => [...a].sort();

before(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  employer = request.agent(app);
  const reg = await employer.post('/api/auth/register').send({
    fullName: 'Fuzzy Employer', email: `emp-${run}${DOMAIN}`, password: 'Sup3rSecret', role: 'employer', companyName: `Zentrix ${run}`,
  });
  assert.equal(reg.status, 201);
  companyId = (await employer.get('/api/auth/me')).body.company.id;
  cats = Object.fromEntries((await request(app).get('/api/categories')).body.data.map((c) => [c.name, c.id]));
  for (const j of JOBS) {
    const res = await employer.post('/api/jobs').send({ title: j.title, description: j.description, categoryId: cats[j.cat], jobType: 'full_time', workMode: 'hybrid' });
    assert.equal(res.status, 201, j.title);
  }
  // never visible, however close the title: a draft and a closed listing
  await employer.post('/api/jobs').send({ title: 'Fullstack Draft Role', description: 'A draft that must stay private.', jobType: 'full_time', workMode: 'remote', status: 'draft' });
  const closed = (await employer.post('/api/jobs').send({ title: 'Full Stack Closed Role', description: 'A listing that was closed.', jobType: 'full_time', workMode: 'remote' })).body.job;
  await employer.patch(`/api/jobs/${closed.id}`).send({ status: 'closed' });
});
after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMAIN}`]);
  await pool.end();
});

test('"full stack", "fullstack" and "full-stack" all find the same jobs', async () => {
  for (const q of ['full stack', 'fullstack', 'full-stack', 'Full  Stack', 'FULLSTACK', 'Full-Stack', 'full_stack']) {
    assert.deepEqual(sorted(await titles(q)), sorted(FULL_STACK), `query "${q}"`);
  }
});

test('typos in "full stack" still find full stack jobs, and only those', async () => {
  for (const q of ['foll stack', 'full stak', 'fulstack', 'fullstak', 'full stck', 'fullstck', 'ful stack', 'fulll stack', 'full stackk', 'full satck', 'fullstacc']) {
    assert.deepEqual(sorted(await titles(q)), sorted(FULL_STACK), `query "${q}"`);
  }
});

test('"front end" and "back end" match the one-word titles, and the reverse', async () => {
  assert.ok((await titles('front end')).includes('Frontend Developer'));
  assert.ok((await titles('frontent')).includes('Frontend Developer'));
  assert.ok((await titles('back end')).includes('Backend Developer (Node.js)'));
  assert.ok((await titles('backend')).includes('Backend Developer (Node.js)'));
  assert.ok((await titles('bakend')).includes('Backend Developer (Node.js)'));
});

test('single-word typos, including swapped letters', async () => {
  const developers = ['Backend Developer (Node.js)', 'Frontend Developer', 'Full Stack Developer', 'Full-Stack Web Developer'];
  for (const q of ['developr', 'develper', 'devloper', 'developere', 'deveoper']) {
    const got = await titles(q);
    for (const t of developers) assert.ok(got.includes(t), `"${q}" should find "${t}" (got ${JSON.stringify(got)})`);
    assert.ok(!got.includes('Junior Accountant'), `"${q}" must not find accountants`);
  }
  assert.deepEqual(await titles('desinger'), ['UI/UX Designer']);
  assert.deepEqual(await titles('designr'), ['UI/UX Designer']);
  assert.deepEqual(await titles('acountant'), ['Junior Accountant']);
  assert.deepEqual(await titles('accoutant'), ['Junior Accountant']);
  assert.deepEqual(await titles('analist'), ['Data Analyst']);
  assert.deepEqual(await titles('marketting'), ['Digital Marketing Manager']);
  assert.deepEqual(sorted(await titles('enginer')), ['Fullstack Engineer', 'QA Engineer']);
});

test('every word of a longer query must match, and one word may have a typo', async () => {
  assert.deepEqual(sorted(await titles('react develper')), ['Frontend Developer', 'Full Stack Developer']); // React is in the description
  assert.deepEqual(await titles('junior acountant'), ['Junior Accountant']);
  assert.deepEqual(await titles('digital marketting manager'), ['Digital Marketing Manager']);
  assert.deepEqual(await titles('react accountant'), []); // no job is both
});

test('unrelated queries find nothing', async () => {
  for (const q of ['chef', 'cooking chef', 'plumber', 'nurse', 'zzzzqqqq', 'lawyer', 'driver', 'teacher', 'pilot', 'python', 'banking', 'stack overflow', 'accounting firm']) {
    assert.deepEqual(await titles(q), [], `query "${q}" should find nothing`);
  }
});

test('draft and closed listings never appear, however close the title', async () => {
  for (const q of ['fullstack', 'full stack', 'fullstack draft', 'full stack closed', 'draft role', 'closed role']) {
    const got = await titles(q);
    assert.ok(!got.includes('Fullstack Draft Role') && !got.includes('Full Stack Closed Role'), `"${q}" leaked: ${JSON.stringify(got)}`);
  }
});

test('exact matches rank above close matches', async () => {
  const got = await titles('full stack');
  assert.equal(got[got.length - 1], 'Fullstack Engineer'); // the only one that matches by closeness, not exactly
  assert.ok(got.slice(0, 2).every((t) => t !== 'Fullstack Engineer'));
  assert.equal((await titles('foll stack')).length, 3);
});

test('the API says when results are approximate, so the page can tell the user', async () => {
  assert.equal((await search('full stack')).approximate, false); // exact matches exist
  assert.equal((await search('qa')).approximate, false);
  assert.equal((await search('foll stack')).approximate, true);
  assert.equal((await search('desinger')).approximate, true);
  assert.equal((await search('zzzzqqqq')).approximate, false); // nothing found is not "approximate"
  const noQuery = await request(app).get('/api/jobs').query({ company: companyId });
  assert.equal(noQuery.body.approximate, false);
});

test('short words and very short queries stay exact (no noisy guesses)', async () => {
  assert.deepEqual(await titles('qa'), ['QA Engineer']);
  assert.deepEqual(await titles('ux'), ['UI/UX Designer']);
  assert.deepEqual(await titles('xq'), []);
  await titles('c'); // a single letter must not error
});

test('pagination and filters still work on fuzzy results', async () => {
  const p1 = await search('foll stack', { limit: 2, page: 1 });
  const p2 = await search('foll stack', { limit: 2, page: 2 });
  assert.equal(p1.pagination.total, 3);
  assert.equal(p1.pagination.totalPages, 2);
  assert.equal(p1.data.length, 2);
  assert.equal(p2.data.length, 1);
  assert.equal((await search('developr', { category: cats['Design'] })).data.length, 0);
  assert.equal((await search('develper', { category: cats['Software Engineering'] })).data.length, 4);
});

test('company and category names are searchable too, with typos', async () => {
  assert.equal((await titles(`zentrix ${run}`)).length >= 10, true); // the company's name
  assert.ok((await titles('finnance')).includes('Junior Accountant')); // category "Finance"
});

test('odd input is safe: quotes, SQL, wildcards, symbols, Sinhala, very long text', async () => {
  for (const q of ["'; DROP TABLE jobs; --", '"unterminated', '%', '_', '%%%%', '---', '(((', '\\', 'රැකියා සොයන්න', 'a'.repeat(100), '  ', '&|!:*', 'full & stack | dev', '-fullstack']) {
    const res = await request(app).get('/api/jobs').query({ q, limit: 5 });
    assert.equal(res.status, 200, `query ${JSON.stringify(q)} returned ${res.status}`);
  }
  assert.equal((await request(app).get('/api/categories')).status, 200); // the table is still there
});
