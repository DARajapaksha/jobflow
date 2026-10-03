import * as resumes from '../services/resumeService.js';

export async function uploadResume(req, res) {
  res.json({ resume: await resumes.setDefaultResume(req.user.id, req.file) });
}

export async function downloadResume(req, res) {
  await resumes.sendDefaultResume(req.user.id, res);
}

export async function deleteResume(req, res) {
  await resumes.removeDefaultResume(req.user.id);
  res.status(204).end();
}
