// Production-readiness checks: health endpoints, serving the built React app, startup validation,
// surviving dropped database connections, and the real S3 client talking to a (fake) S3-compatible server.
import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const run = Math.random().toString(36).slice(2, 8);
const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobflow-dist-'));
fs.mkdirSync(path.join(distDir, 'assets'));
fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Jobflow shell</title><div id="root"></div>');
fs.writeFileSync(path.join(distDir, 'assets', 'app-abc123.js'), 'console.log("app")');
fs.writeFileSync(path.join(distDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');

const baseUrl = process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.SERVE_CLIENT = 'true';
process.env.CLIENT_DIST = distDir;
// tag this process's database connections so the resilience test only ever drops its own
process.env.DATABASE_URL = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}application_name=deploytest_${run}`;

const { default: request } = await import('supertest');
const { default: pg } = await import('pg');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { createS3Driver, createS3ClientFromEnv } = await import('../src/storage/s3Driver.js');

after(async () => {
  await pool.end();
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('liveness never touches the database; readiness does', async () => {
  const original = pool.query;
  pool.query = async () => { throw new Error('database is asleep'); };
  try {
    const live = await request(app).get('/api/health');
    assert.equal(live.status, 200);
    assert.deepEqual(live.body, { status: 'ok' });
    assert.equal((await request(app).get('/api/health/ready')).status, 500);
  } finally {
    pool.query = original;
  }
  const ready = await request(app).get('/api/health/ready');
  assert.deepEqual(ready.body, { status: 'ok', database: 'up' });
});

test('health checks are exempt from the rate limiter', async () => {
  const codes = new Set();
  for (let i = 0; i < 350; i++) codes.add((await request(app).get('/api/health')).status);
  assert.deepEqual([...codes], [200]);
});

test('serves the app shell for deep links, with sensible caching, and keeps the API separate', async () => {
  for (const url of ['/', '/jobs/0b6d8f3e', '/employer/jobs/new', '/companies']) {
    const res = await request(app).get(url);
    assert.equal(res.status, 200, url);
    assert.match(res.text, /Jobflow shell/);
    assert.equal(res.headers['cache-control'], 'no-cache');
  }
  const asset = await request(app).get('/assets/app-abc123.js');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal((await request(app).get('/favicon.svg')).headers['cache-control'], 'public, max-age=3600');

  const missingApi = await request(app).get('/api/does-not-exist');
  assert.equal(missingApi.status, 404);
  assert.equal(missingApi.body.error.code, 'NOT_FOUND'); // JSON, not the app shell
  assert.equal((await request(app).get('/api/categories')).status, 200);
  assert.equal((await request(app).post('/some/page')).status, 404); // only GET falls back to the shell
});

test('security headers: strict CSP without upgrade-insecure-requests, no framing, no sniffing', async () => {
  const res = await request(app).get('/');
  const csp = res.headers['content-security-policy'];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  assert.match(csp, /img-src 'self' data: blob:(;|$)/); // blob: lets the photo editor preview a chosen file; no other hosts allowed
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(!res.headers['x-powered-by']);
});

// ---- startup validation (separate processes, because env.js reads the environment once at import) ----
const loadEnv = (extra) =>
  spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config/env.js'); await import('./src/app.js'); process.exit(0)"], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { PATH: process.env.PATH, DATABASE_URL: baseUrl, ...extra },
    encoding: 'utf8',
  });

test('production refuses weak or default JWT secrets', () => {
  for (const secret of ['short', 'change-me', 'secret-secret-secret-secret-secret-secret']) {
    const r = loadEnv({ NODE_ENV: 'production', JWT_SECRET: secret, STORAGE_DRIVER: 's3', S3_BUCKET: 'b' });
    assert.notEqual(r.status, 0, `"${secret}" should be refused`);
    assert.match(r.stderr, /JWT_SECRET must be a random string/);
  }
  const ok = loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(8) + 'Q9vL2mZ7pR4tW6yB1nK3dF5gH8jA0cEs', STORAGE_DRIVER: 's3', S3_BUCKET: 'b' });
  assert.equal(ok.status, 0, ok.stderr);
});

test('local storage in production warns; a missing client build stops the server with a clear message', () => {
  const warn = loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'Q9vL2mZ7pR4tW6yB1nK3dF5gH8jA0cEsX1', STORAGE_DRIVER: 'local' });
  assert.match(warn.stderr, /STORAGE_DRIVER=local in production/);

  const missing = loadEnv({ NODE_ENV: 'test', JWT_SECRET: 'x', SERVE_CLIENT: 'true', CLIENT_DIST: path.join(distDir, 'nope') });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Build the client first/);
});

// ---- serverless databases drop idle connections ----
test('a dropped database connection does not crash the server, and the next query works', async () => {
  await pool.query('SELECT 1'); // opens an idle connection tagged with this test's application_name
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = $1',
      [`deploytest_${run}`],
    );
    assert.ok(rowCount > 0, 'expected at least one pooled connection to terminate');
  } finally {
    await admin.end();
  }
  await new Promise((r) => setTimeout(r, 300)); // let the pool see the error event (unhandled it would crash this process)
  assert.equal((await pool.query('SELECT 1 AS ok')).rows[0].ok, 1);
  assert.equal((await request(app).get('/api/health/ready')).status, 200);
});

// ---- the real AWS SDK against a fake S3-compatible server (what Backblaze B2 / MinIO / R2 look like to us) ----
test('S3 client works against a path-style S3 server and does not send checksum extras that B2 rejects', async () => {
  const objects = new Map();
  const seen = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const key = decodeURIComponent(req.url.split('?')[0]); // /bucket/resumes/u/1.pdf
      seen.push({ method: req.method, headers: req.headers });
      if (req.method === 'PUT') {
        objects.set(key, { body: Buffer.concat(chunks), type: req.headers['content-type'] });
        res.writeHead(200, { ETag: '"fake"' }).end();
      } else if (req.method === 'GET' && objects.has(key)) {
        res.writeHead(200, { 'Content-Type': objects.get(key).type, 'Content-Length': objects.get(key).body.length }).end(objects.get(key).body);
      } else if (req.method === 'DELETE') {
        objects.delete(key);
        res.writeHead(204).end();
      } else {
        res.writeHead(404, { 'Content-Type': 'application/xml' }).end('<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>missing</Message></Error>');
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const client = createS3ClientFromEnv({
      s3Region: 'us-west-004',
      s3Endpoint: `http://127.0.0.1:${server.address().port}`,
      s3ForcePathStyle: true,
      s3AccessKeyId: 'AKIAFAKEFAKE',
      s3SecretAccessKey: 'fake-secret',
    });
    const driver = createS3Driver({ client, bucket: 'jobflow-test' });
    const bytes = Buffer.from('%PDF-1.4 hello resume');

    await driver.put('resumes/u/1.pdf', bytes, 'application/pdf');
    const put = seen.find((r) => r.method === 'PUT').headers;
    assert.match(put.authorization, /^AWS4-HMAC-SHA256 .*Credential=AKIAFAKEFAKE\/\d{8}\/us-west-004\/s3\/aws4_request/);
    assert.equal(put['content-type'], 'application/pdf');
    assert.equal(objects.get('/jobflow-test/resumes/u/1.pdf').body.toString(), bytes.toString(), 'body must arrive unmodified (no aws-chunked framing)');
    assert.ok(!put['content-encoding'], 'no aws-chunked content-encoding');
    assert.ok(!Object.keys(put).some((h) => h.startsWith('x-amz-checksum-') || h === 'x-amz-sdk-checksum-algorithm' || h === 'x-amz-trailer'), 'no checksum headers');

    const chunks = [];
    for await (const c of await driver.get('resumes/u/1.pdf')) chunks.push(c);
    assert.equal(Buffer.concat(chunks).toString(), bytes.toString());

    await driver.delete('resumes/u/1.pdf');
    assert.equal(objects.size, 0);
    await assert.rejects(driver.get('resumes/u/1.pdf'), (e) => e.status === 404);
  } finally {
    server.close();
  }
});
