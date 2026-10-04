import * as applications from '../repositories/applicationRepository.js';
import * as jobs from '../repositories/jobRepository.js';
import * as profiles from '../repositories/profileRepository.js';
import * as resumes from './resumeService.js';
import { isLive } from './jobService.js';
import { AppError } from '../utils/AppError.js';

// Allowed status changes (see the state diagram in docs/DESIGN.md). hired and rejected are final.
const TRANSITIONS = {
  submitted: ['reviewed', 'rejected'],
  reviewed: ['shortlisted', 'rejected'],
  shortlisted: ['hired', 'rejected'],
  hired: [],
  rejected: [],
};

const strip = ({ resumeKey, seekerId, ownerId, ...application }) => application;
const forSeeker = ({ applicant, ...rest }) => strip(rest); // job info, without the seeker's own profile echoed back
const forEmployer = ({ job, ...rest }) => strip(rest); // applicants are listed under a job already

// Applications are visible only to the applicant and to the employer who owns the job.
// Everyone else gets 404, so ids don't reveal which applications exist.
async function loadForParticipant(id, user) {
  const application = await applications.findById(id);
  const isApplicant = application?.seekerId === user.id;
  const isOwner = application?.ownerId === user.id;
  if (!application || !(isApplicant || isOwner)) throw AppError.notFound('Application not found');
  return { application, isOwner };
}

export async function apply(user, jobId, { coverLetter }, file) {
  const job = await jobs.findById(jobId);
  if (!job || !isLive(job)) throw AppError.notFound('Job not found');
  if (await applications.findByJobAndSeeker(jobId, user.id)) throw AppError.conflict('You have already applied to this job');

  // Either a freshly uploaded PDF for this application, or the seeker's saved default resume.
  let resume;
  let uploadedKey = null;
  if (file) {
    resume = await resumes.saveUpload(user.id, file);
    uploadedKey = resume.key;
  } else {
    resume = await profiles.getResume(user.id);
    if (!resume) throw AppError.badRequest('Attach a PDF resume, or save a default resume to your profile first');
  }

  try {
    const id = await applications.create({
      jobId,
      seekerId: user.id,
      coverLetter: coverLetter || null,
      resumeKey: resume.key,
      resumeFilename: resume.filename,
    });
    return forSeeker(await applications.findById(id));
  } catch (err) {
    if (uploadedKey) await resumes.discardIfUnused(uploadedKey).catch(() => {}); // don't leave an orphan file behind
    if (err.code === '23505') throw AppError.conflict('You have already applied to this job'); // two requests raced
    throw err;
  }
}

export async function listMine(user, status) {
  return (await applications.listBySeeker(user.id, status)).map(forSeeker);
}

export async function listForJob(user, jobId, query) {
  const job = await jobs.findById(jobId);
  if (!job) throw AppError.notFound('Job not found');
  if (job.ownerId !== user.id) throw AppError.forbidden('You can only view applicants for your own listings');
  const { data, pagination } = await applications.listByJob(jobId, query);
  return { data: data.map(forEmployer), pagination };
}

export async function getOne(id, user) {
  const { application } = await loadForParticipant(id, user);
  return strip(application);
}

export async function updateStatus(id, user, to) {
  const { application, isOwner } = await loadForParticipant(id, user);
  if (!isOwner) throw AppError.forbidden('Only the employer can change an application status');
  if (!TRANSITIONS[application.status].includes(to)) {
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot move an application from "${application.status}" to "${to}"`);
  }
  if (!(await applications.updateStatus(id, application.status, to))) {
    throw AppError.conflict('The application status just changed, reload and try again');
  }
  return strip(await applications.findById(id));
}

export async function sendResume(id, user, res) {
  const { application } = await loadForParticipant(id, user);
  await resumes.sendStoredResume(res, application.resumeKey, application.resume.filename);
}
