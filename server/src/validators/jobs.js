import { z } from 'zod';

export const JOB_TYPES = ['full_time', 'part_time', 'contract', 'internship'];
export const WORK_MODES = ['onsite', 'remote', 'hybrid'];

const salary = z.number().int().min(0).max(100_000_000).nullable().optional();

// Shared by create and update. Kept as a plain object so update can use .partial().
const jobFields = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(160),
  description: z.string().trim().min(20, 'Describe the role in at least 20 characters').max(10000),
  location: z.string().trim().max(120).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  jobType: z.enum(JOB_TYPES),
  workMode: z.enum(WORK_MODES),
  salaryMin: salary,
  salaryMax: salary,
  expiresAt: z.iso.datetime().nullable().optional(), // e.g. 2026-12-31T00:00:00Z
});

function checkSalaryAndExpiry(data, ctx) {
  if (data.salaryMin != null && data.salaryMax != null && data.salaryMax < data.salaryMin) {
    ctx.addIssue({ code: 'custom', path: ['salaryMax'], message: 'Maximum salary must be at least the minimum' });
  }
  if (data.expiresAt && new Date(data.expiresAt) <= new Date()) {
    ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Expiry date must be in the future' });
  }
}

export const createJobSchema = jobFields
  .extend({ status: z.enum(['draft', 'open']).default('open') })
  .superRefine(checkSalaryAndExpiry);

export const updateJobSchema = jobFields
  .partial()
  .extend({ status: z.enum(['draft', 'open', 'closed']).optional() })
  .superRefine(checkSalaryAndExpiry)
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

const csv = (values) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)));

export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.coerce.number().int().positive().optional(),
  company: z.uuid().optional(), // all open jobs of one company
  location: z.string().trim().max(120).optional(),
  type: csv(JOB_TYPES).optional(), // ?type=full_time,internship
  mode: csv(WORK_MODES).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['relevance', 'newest', 'salary_desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const myJobsQuerySchema = z.object({
  status: z.enum(['draft', 'open', 'closed']).optional(),
});

export const idParamSchema = z.object({ id: z.uuid('Invalid job id') });

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
