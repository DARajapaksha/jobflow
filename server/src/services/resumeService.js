import crypto from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { getStorage } from '../storage/index.js';
import * as profiles from '../repositories/profileRepository.js';
import * as applications from '../repositories/applicationRepository.js';
import { AppError } from '../utils/AppError.js';

// The filename a user uploads is untrusted: keep only a safe display name, always ending in .pdf.
export function safeFilename(name) {
  const base = path.basename(String(name ?? '').replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  const stem = base.replace(/\.pdf$/i, '').trim().slice(0, 100) || 'resume';
  return `${stem}.pdf`;
}

function assertPdf(file) {
  if (!file) throw AppError.badRequest('Attach a PDF in the "resume" field');
  if (file.size === 0) throw AppError.badRequest('The uploaded file is empty');
  // Check the file's real content, not the extension or the client-supplied content type.
  if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw AppError.badRequest('Resume must be a PDF file');
}

// Validates and stores an uploaded file; returns what the database needs. Reused by the apply flow in Phase 4.
export async function saveUpload(userId, file) {
  assertPdf(file);
  const key = `resumes/${userId}/${crypto.randomUUID()}.pdf`; // random and server-chosen, never user input
  await (await getStorage()).put(key, file.buffer, 'application/pdf');
  return { key, filename: safeFilename(file.originalname) };
}

// A stored file can be shared by the profile and by applications that used it as the default resume,
// so it is only deleted once nothing references it any more.
export async function discardIfUnused(key) {
  if (!key || (await applications.isResumeKeyReferenced(key))) return;
  await (await getStorage()).delete(key);
}

export async function setDefaultResume(userId, file) {
  const previous = await profiles.getResume(userId);
  const stored = await saveUpload(userId, file);
  try {
    await profiles.setResume(userId, stored.key, stored.filename);
  } catch (err) {
    await (await getStorage()).delete(stored.key).catch(() => {});
    throw err;
  }
  if (previous) await discardIfUnused(previous.key).catch((e) => console.error('resume cleanup failed', e));
  return { filename: stored.filename };
}

export async function removeDefaultResume(userId) {
  const current = await profiles.getResume(userId);
  if (!current) throw AppError.notFound('No resume uploaded');
  await profiles.clearResume(userId);
  await discardIfUnused(current.key).catch((e) => console.error('resume cleanup failed', e));
}

export async function sendDefaultResume(userId, res) {
  const current = await profiles.getResume(userId);
  if (!current) throw AppError.notFound('No resume uploaded');
  await sendStoredResume(res, current.key, current.filename);
}

// Streams a stored resume as a download. Callers must have checked access first.
export async function sendStoredResume(res, key, filename) {
  const stream = await (await getStorage()).get(key);
  res.attachment(filename); // sets Content-Disposition (with safe encoding) and Content-Type from the .pdf extension
  res.set('Cache-Control', 'private, no-store');
  await pipeline(stream, res);
}
