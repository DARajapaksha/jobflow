// Dev only: drops and recreates the public schema so migrations start clean.
import { pool } from './pool.js';
import { env } from '../config/env.js';

if (env.nodeEnv === 'production') {
  console.error('db:reset is disabled in production.');
  process.exit(1);
}

pool
  .query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  .then(() => console.log('schema reset'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
