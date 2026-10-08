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
  const before = (await pool.query('SELECT id, name FROM categories ORDER BY id')).rows;
  await pool.query(sql);
  await pool.query(sql);
  const after = (await pool.query('SELECT id, name FROM categories ORDER BY id')).rows;
  assert.deepEqual(after, before);
});
