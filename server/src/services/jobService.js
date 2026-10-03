import * as jobs from '../repositories/jobRepository.js';
import * as profiles from '../repositories/profileRepository.js';
import { AppError } from '../utils/AppError.js';

export const isLive = (job) => job.status === 'open' && (!job.expiresAt || new Date(job.expiresAt) > new Date());
const toPublic = ({ ownerId, ...job }) => job;

async function ownedJobOrThrow(id, user) {
  const job = await jobs.findById(id);
  if (!job) throw AppError.notFound('Job not found');
  if (job.ownerId !== user.id) throw AppError.forbidden('You can only manage your own listings');
  return job;
}

async function assertCategory(categoryId) {
  if (categoryId != null && !(await jobs.categoryExists(categoryId))) {
    throw AppError.badRequest('Unknown category', [{ path: 'categoryId', message: 'Category does not exist' }]);
  }
}

export const search = (filters) => jobs.search(filters);
export const listCategories = () => jobs.listCategories();
export const listMine = (user, status) => jobs.listByOwner(user.id, status);

// Drafts, closed and expired listings are only visible to the employer who owns them.
export async function getById(id, user) {
  const job = await jobs.findById(id);
  if (!job || (!isLive(job) && job.ownerId !== user?.id)) throw AppError.notFound('Job not found');
  return toPublic(job);
}

export async function create(user, input) {
  const company = await profiles.findCompanyByOwner(user.id);
  if (!company) throw AppError.badRequest('Create a company profile before posting jobs');
  await assertCategory(input.categoryId);
  const id = await jobs.create(company.id, input);
  return toPublic(await jobs.findById(id));
}

export async function update(id, user, input) {
  const existing = await ownedJobOrThrow(id, user);
  await assertCategory(input.categoryId);

  // Validate the salary range against the merged result, since the request may send only one side.
  const min = input.salaryMin !== undefined ? input.salaryMin : existing.salaryMin;
  const max = input.salaryMax !== undefined ? input.salaryMax : existing.salaryMax;
  if (min != null && max != null && max < min) {
    throw AppError.badRequest('Invalid salary range', [{ path: 'salaryMax', message: 'Maximum salary must be at least the minimum' }]);
  }

  await jobs.update(id, input);
  return toPublic(await jobs.findById(id));
}

export async function remove(id, user) {
  await ownedJobOrThrow(id, user);
  await jobs.remove(id);
}
