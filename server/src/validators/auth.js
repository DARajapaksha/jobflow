import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(255).pipe(z.email('Enter a valid email address'));

// bcrypt only uses the first 72 bytes, so cap there instead of silently truncating.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(120),
    email,
    password,
    role: z.enum(['seeker', 'employer']), // admin accounts are never self-registered
    companyName: z.string().trim().min(2).max(160).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'employer' && !data.companyName) {
      ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Company name is required for employers' });
    }
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});
