import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import * as users from '../repositories/userRepository.js';
import * as profiles from '../repositories/profileRepository.js';

const ROUNDS = env.nodeEnv === 'test' ? 4 : 12;
// Compared against when the email is unknown, so "no such user" and "wrong password"
// take about the same time and return the same error (no account enumeration).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

export function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw AppError.unauthorized('Invalid or expired session');
  }
}

export async function register({ fullName, email, password, role, companyName }) {
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await users.create({ email, passwordHash, fullName, role }, client);
    if (role === 'seeker') await profiles.createSeekerProfile(user.id, client);
    if (role === 'employer') await profiles.createCompany(user.id, companyName, client);
    await client.query('COMMIT');
    return { user, token: signToken(user) };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw AppError.conflict('An account with this email already exists');
    throw err;
  } finally {
    client.release();
  }
}

export async function login({ email, password }) {
  const row = await users.findByEmail(email);
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  const user = users.toUser(row);
  return { user, token: signToken(user) };
}

export async function getCurrentUser(user) {
  if (user.role === 'employer') return { user, company: await profiles.findCompanyByOwner(user.id) };
  if (user.role === 'seeker') return { user, profile: await profiles.findSeekerProfile(user.id) };
  return { user };
}
