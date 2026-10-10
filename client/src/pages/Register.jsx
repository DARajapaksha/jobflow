import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import AuthAside from '../components/AuthAside';
import { Button, Container, TextField } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { applyApiErrors, errorMessage } from '../api/client';
import { cn } from '../lib/cn';
import { safeNext } from '../lib/format';
import { usePageTitle } from '../lib/usePageTitle';

const schema = z
  .object({
    role: z.enum(['seeker', 'employer']),
    fullName: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().trim().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use at most 72 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    companyName: z.string().trim().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.role === 'employer' && (d.companyName?.length ?? 0) < 2) {
      ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Enter your company name' });
    }
  });

const ROLES = [
  { value: 'seeker', label: 'I’m looking for work' },
  { value: 'employer', label: 'I’m hiring' },
];

export default function Register() {
  usePageTitle('Create an account');
  const { user, register: signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: params.get('role') === 'employer' ? 'employer' : 'seeker' },
  });
  const role = watch('role');

  if (user) return <Navigate to={next ?? '/'} replace />;

  const onSubmit = async ({ companyName, ...values }) => {
    setFormError('');
    try {
      const created = await signUp(role === 'employer' ? { ...values, companyName } : values);
      toast.success('Your account is ready');
      navigate(next ?? (created.role === 'employer' ? '/employer' : '/'), { replace: true });
    } catch (err) {
      if (err.response?.status === 409) setError('email', { message: 'An account with this email already exists. Try logging in.' });
      else if (!applyApiErrors(err, setError)) setFormError(errorMessage(err));
    }
  };

  return (
    <Container className="grid gap-10 py-10 lg:grid-cols-2 lg:py-16">
      <AuthAside title="Apply once, then keep track of everything.">
        <p>Save jobs to come back to.</p>
        <p>Apply with a PDF resume and a cover letter.</p>
        <p>Follow each application from submitted to hired.</p>
      </AuthAside>
      <section className="mx-auto w-full max-w-md self-center">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
          {formError && <p role="alert" className="rounded-lg bg-ruby-tint px-3.5 py-2.5 text-sm text-ruby">{formError}</p>}

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">What brings you here?</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-moon-deep p-1">
              {ROLES.map((r) => (
                <label key={r.value} className={cn('cursor-pointer rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sapphire', role === r.value ? 'bg-white shadow-sm' : 'text-ink-soft hover:text-ink')}>
                  <input type="radio" value={r.value} className="sr-only" {...register('role')} />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <TextField label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
          {role === 'employer' && <TextField label="Company name" autoComplete="organization" error={errors.companyName?.message} {...register('companyName')} />}
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account</Button>
        </form>
        <p className="mt-6 text-ink-soft">
          Already have an account? <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-sapphire underline underline-offset-4">Log in</Link>
        </p>
      </section>
    </Container>
  );
}
