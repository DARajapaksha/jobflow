// Categories must exist in any database that has been migrated, with or without the demo seed.
import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
const { default: request } = await import('supertest');
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');

after(() => pool.end());

test('a migrated database already has the job categories', async () => {
  const res = await request(app).get('/api/categories');
  assert.equal(res.status, 200);
  const names = res.body.data.map((c) => c.name);
  for (const required of ['Software Engineering', 'Design', 'Data & Analytics', 'Marketing', 'Finance', 'Customer Support', 'Other']) {
    assert.ok(names.includes(required), `missing category: ${required}`);
  }
  assert.equal(new Set(names).size, names.length, 'category names must be unique');
});

test('the categories migration can be re-applied without creating duplicates or touching existing rows', async () => {
  const sql = fs.readFileSync(path.resolve(import.meta.dirname, '../src/db/migrations/003_categories.sql'), 'utf8');
  // Only the categories this migration owns: other test files add and remove temporary categories at the same time.
  const owned = [...sql.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(owned.length >= 10);
  const rows = async () => (await pool.query('SELECT id, name FROM categories WHERE name = ANY($1) ORDER BY id', [owned])).rows;
  const before = await rows();
  assert.equal(before.length, owned.length);
  await pool.query(sql);
  await pool.query(sql);
  assert.deepEqual(await rows(), before); // no duplicates, and the existing rows (and their ids) are untouched
});
