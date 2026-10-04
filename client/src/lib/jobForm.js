import { z } from 'zod';

const toNumber = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
export const numberOrNull = (v) => toNumber(v);

const salary = z.number({ invalid_type_error: 'Enter a number' }).int('Use whole numbers').min(0, 'Cannot be negative').max(100_000_000, 'That is too large').nullable();
export const endOfDay = (date) => `${date}T23:59:59Z`;

// Server-side expiry is "end of that day, UTC". An unchanged date is never re-validated, so an old listing can still be edited.
export function makeJobSchema(originalExpiry = '') {
  return z
    .object({
      title: z.string().trim().min(3, 'Enter a job title (at least 3 characters)').max(160, 'Keep the title under 160 characters'),
      categoryId: z.number().int().positive().nullable(),
      jobType: z.enum(['full_time', 'part_time', 'contract', 'internship']),
      workMode: z.enum(['onsite', 'remote', 'hybrid']),
      location: z.string().trim().max(120, 'Keep the location under 120 characters'),
      salaryMin: salary,
      salaryMax: salary,
      expiresAt: z.string(),
      description: z.string().trim().min(20, 'Describe the role in at least 20 characters').max(10000, 'Keep the description under 10,000 characters'),
    })
    .superRefine((d, ctx) => {
      if (d.salaryMin != null && d.salaryMax != null && d.salaryMax < d.salaryMin) {
        ctx.addIssue({ code: 'custom', path: ['salaryMax'], message: 'Maximum must be at least the minimum' });
      }
      if (d.expiresAt && d.expiresAt !== originalExpiry && new Date(endOfDay(d.expiresAt)) <= new Date()) {
        ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Choose a date in the future' });
      }
    });
}

export const emptyJob = { title: '', categoryId: null, jobType: 'full_time', workMode: 'onsite', location: '', salaryMin: null, salaryMax: null, expiresAt: '', description: '' };

export function jobToForm(job) {
  return {
    title: job.title,
    categoryId: job.category?.id ?? null,
    jobType: job.jobType,
    workMode: job.workMode,
    location: job.location ?? '',
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    expiresAt: job.expiresAt ? new Date(job.expiresAt).toISOString().slice(0, 10) : '',
    description: job.description,
  };
}

// Form values -> API body. Blank optional fields become null so they can be cleared.
export function formToPayload(values, { originalExpiry = '', status } = {}) {
  const payload = {
    title: values.title,
    categoryId: values.categoryId,
    jobType: values.jobType,
    workMode: values.workMode,
    location: values.location || null,
    salaryMin: values.salaryMin,
    salaryMax: values.salaryMax,
    description: values.description,
  };
  if (values.expiresAt !== originalExpiry) payload.expiresAt = values.expiresAt ? endOfDay(values.expiresAt) : null;
  if (status) payload.status = status;
  return payload;
}
