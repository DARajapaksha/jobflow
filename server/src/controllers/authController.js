import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { registerSchema, loginSchema } from '../validators/auth.js';
import * as authService from '../services/authService.js';

const COOKIE_BASE = {
  httpOnly: true, // not readable from JavaScript, which limits the damage of XSS
  secure: env.nodeEnv === 'production',
  sameSite: 'lax',
  path: '/',
};

function setSessionCookie(res, token) {
  const { exp } = jwt.decode(token);
  res.cookie('token', token, { ...COOKIE_BASE, maxAge: exp * 1000 - Date.now() });
}

export async function register(req, res) {
  const input = registerSchema.parse(req.body);
  const { user, token } = await authService.register(input);
  setSessionCookie(res, token);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const input = loginSchema.parse(req.body);
  const { user, token } = await authService.login(input);
  setSessionCookie(res, token);
  res.json({ user });
}

export function logout(_req, res) {
  res.clearCookie('token', COOKIE_BASE);
  res.status(204).end();
}

export async function me(req, res) {
  res.json(await authService.getCurrentUser(req.user));
}
