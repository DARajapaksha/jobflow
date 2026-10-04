import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../services/authService.js';
import * as users from '../repositories/userRepository.js';

function readToken(req) {
  if (req.cookies?.token) return req.cookies.token;
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7); // handy for Postman / curl
  return null;
}

async function loadUser(req) {
  const token = readToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  // Load from the DB on every request so deleted accounts lose access immediately.
  const user = await users.findById(payload.sub);
  if (!user) throw AppError.unauthorized('Invalid or expired session');
  return user;
}

export async function authenticate(req, _res, next) {
  const user = await loadUser(req);
  if (!user) throw AppError.unauthorized();
  req.user = user;
  next();
}

// For public routes that behave differently when logged in (e.g. "already applied").
export async function optionalAuth(req, _res, next) {
  try {
    req.user = (await loadUser(req)) ?? undefined;
  } catch (err) {
    if (err.status !== 401) throw err;
    req.user = undefined; // an expired or invalid session on a public page just means "not logged in"
  }
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
