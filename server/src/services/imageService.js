import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { getStorage } from '../storage/index.js';
import * as profiles from '../repositories/profileRepository.js';
import * as companies from '../repositories/companyRepository.js';
import * as applications from '../repositories/applicationRepository.js';
import { avatarUrl, logoUrl } from '../utils/assets.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp']); // no SVG (can carry scripts) and no GIF
const MIN_SIDE = 32;
const MAX_PIXELS = 25_000_000; // refuse "image bombs": tiny files that decode to enormous bitmaps

// avatars become a centred square; logos keep their shape (and transparency) and are only ever shrunk
const PRESETS = {
  avatar: { folder: 'avatars', size: 256, fit: 'cover', enlarge: true },
  logo: { folder: 'logos', size: 512, fit: 'inside', enlarge: false },
};

// Decodes the upload and re-encodes it as WebP. Re-encoding strips metadata (EXIF can contain GPS location),
// fixes rotation and neutralises anything unusual hidden in the file. The original is never stored.
export async function processImage(file, kind) {
  if (!file) throw AppError.badRequest('Attach an image in the "image" field');
  if (file.size === 0) throw AppError.badRequest('The uploaded file is empty');
  const preset = PRESETS[kind];

  try {
    const image = sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' });
    const meta = await image.metadata();
    if (!ALLOWED_FORMATS.has(meta.format)) throw AppError.badRequest('Use a PNG, JPEG or WebP image');
    if (Math.min(meta.width, meta.height) < MIN_SIDE) {
      throw AppError.badRequest(`The image is too small. Use one at least ${MIN_SIDE} × ${MIN_SIDE} pixels.`);
    }
    return await image
      .rotate()
      .resize({ width: preset.size, height: preset.size, fit: preset.fit, withoutEnlargement: !preset.enlarge })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (/pixel limit/i.test(err.message)) throw AppError.badRequest('The image dimensions are too large. Use one under 5000 × 5000 pixels.');
    throw AppError.badRequest('That file could not be read as an image. Use a PNG, JPEG or WebP file.');
  }
}

async function storeImage(kind, ownerId, file) {
  const data = await processImage(file, kind);
  const key = `${PRESETS[kind].folder}/${ownerId}/${crypto.randomUUID()}.webp`; // server-chosen, never user input
  await (await getStorage()).put(key, data, 'image/webp');
  return key;
}

const discard = (key) => key && getStorage().then((s) => s.delete(key)).catch((e) => console.error('image cleanup failed', e));

// ---------- seekers: avatar ----------
export async function setAvatar(userId, file) {
  const key = await storeImage('avatar', userId, file);
  const previous = await profiles.getAvatarKey(userId);
  try {
    await profiles.setAvatarKey(userId, key);
  } catch (err) {
    await discard(key);
    throw err;
  }
  await discard(previous);
  return { avatarUrl: avatarUrl(userId, key) };
}

export async function removeAvatar(userId) {
  const previous = await profiles.getAvatarKey(userId);
  if (!previous) throw AppError.notFound('No profile picture to remove');
  await profiles.clearAvatarKey(userId);
  await discard(previous);
}

// ---------- employers: company logo ----------
async function companyOf(user) {
  const company = await profiles.findCompanyByOwner(user.id);
  if (!company) throw AppError.badRequest('No company profile found for this account');
  return company;
}

export async function setLogo(user, file) {
  const company = await companyOf(user);
  const key = await storeImage('logo', company.id, file);
  const previous = await companies.getLogoKey(company.id);
  try {
    await companies.setLogoKey(company.id, key);
  } catch (err) {
    await discard(key);
    throw err;
  }
  await discard(previous);
  return { logoUrl: logoUrl(company.id, key) };
}

export async function removeLogo(user) {
  const company = await companyOf(user);
  const previous = await companies.getLogoKey(company.id);
  if (!previous) throw AppError.notFound('No logo to remove');
  await companies.setLogoKey(company.id, null);
  await discard(previous);
}

// ---------- serving ----------
async function sendImage(res, key, headers) {
  const stream = await (await getStorage()).get(key);
  res.set({ 'Content-Type': 'image/webp', 'Content-Disposition': 'inline', ...headers });
  await pipeline(stream, res);
}

// Logos are public: they appear on every listing. The URL carries a version, so it can be cached forever.
export async function sendCompanyLogo(companyId, res) {
  const key = await companies.getLogoKey(companyId);
  if (!key) throw AppError.notFound('This company has no logo');
  await sendImage(res, key, { 'Cache-Control': 'public, max-age=31536000, immutable' });
}

// A seeker's photo is visible to the seeker and to employers they applied to, nobody else (same rule as resumes).
export async function sendAvatar(seekerId, viewer, res) {
  const allowed = viewer.id === seekerId || (viewer.role === 'employer' && (await applications.employerCanSeeApplicant(viewer.id, seekerId)));
  const key = allowed ? await profiles.getAvatarKey(seekerId) : null;
  if (!key) throw AppError.notFound('Profile picture not found');
  // Private data must not outlive the session in the browser cache: keep it short, and tie each cached copy to the
  // login cookie (Vary: Cookie) so another account on the same browser always goes back to the server, which checks access.
  await sendImage(res, key, { 'Cache-Control': 'private, max-age=300', Vary: 'Cookie' });
}
