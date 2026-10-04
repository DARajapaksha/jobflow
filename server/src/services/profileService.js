import { pool } from '../db/pool.js';
import * as users from '../repositories/userRepository.js';
import * as profiles from '../repositories/profileRepository.js';
import * as authService from './authService.js';
import { AppError } from '../utils/AppError.js';

// Seekers edit their own profile; employers edit their company. Returns the same shape as GET /api/auth/me.
export async function updateProfile(user, input) {
  const { fullName, ...fields } = input;

  const company = user.role === 'employer' ? await profiles.findCompanyByOwner(user.id) : null;
  if (user.role === 'employer' && !company) throw AppError.badRequest('No company profile found for this account');

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // the name lives in users, the rest elsewhere: change both or neither
    if (fullName !== undefined) await users.updateFullName(user.id, fullName, client);
    if (user.role === 'seeker') await profiles.updateSeekerProfile(user.id, fields, client);
    else await profiles.updateCompany(company.id, fields, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return authService.getCurrentUser(await users.findById(user.id));
}
