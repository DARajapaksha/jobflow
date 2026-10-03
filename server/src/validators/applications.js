import { z } from 'zod';

export const idParamSchema = z.object({ id: z.uuid('Invalid id') });

// Text fields arrive in a multipart form together with the optional resume file.
export const applyBodySchema = z.object({
  coverLetter: z.string().trim().max(5000, 'Cover letter must be at most 5000 characters').optional(),
});

// "submitted" is the starting state, never a target.
export const statusBodySchema = z.object({
  status: z.enum(['reviewed', 'shortlisted', 'rejected', 'hired']),
});

const status = z.enum(['submitted', 'reviewed', 'shortlisted', 'rejected', 'hired']);

export const applicantsQuerySchema = z.object({
  status: status.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const myApplicationsQuerySchema = z.object({ status: status.optional() });
