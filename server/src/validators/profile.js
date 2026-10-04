import { z } from 'zod';

// Trims; an empty string clears the field (stored as NULL).
const optionalText = (max) =>
  z.string().trim().max(max).transform((v) => v || null).nullable().optional();

const isHttpUrl = (v) => {
  try {
    const { protocol } = new URL(v);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const skills = z
  .array(z.string().trim().min(1).max(40))
  .max(20, 'At most 20 skills')
  .transform((list) => {
    const seen = new Set();
    return list.filter((s) => !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  })
  .optional();

const fullName = z.string().trim().min(2, 'Full name is required').max(120).optional();
const notEmpty = (data) => Object.keys(data).length > 0;
const notEmptyMsg = { message: 'Provide at least one field to update' };

// strictObject: sending a field that belongs to the other role is an error, not silently ignored.
export const seekerProfileSchema = z
  .strictObject({
    fullName,
    headline: optionalText(160),
    bio: optionalText(2000),
    skills,
    location: optionalText(120),
  })
  .refine(notEmpty, notEmptyMsg);

export const employerProfileSchema = z
  .strictObject({
    fullName,
    name: z.string().trim().min(2, 'Company name is required').max(160).optional(),
    description: optionalText(5000),
    website: z
      .string()
      .trim()
      .max(255)
      .refine((v) => v === '' || isHttpUrl(v), 'Website must start with http:// or https://')
      .transform((v) => v || null)
      .nullable()
      .optional(),
    location: optionalText(120),
  })
  .refine(notEmpty, notEmptyMsg);
