import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import AuthAside from '../components/AuthAside';
import { Button, Container, TextField } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { safeNext } from '../lib/format';
import { usePageTitle } from '../lib/usePageTitle';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export default function Login() {
  usePageTitle('Log in');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={next ?? '/'} replace />;

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const loggedIn = await login(values);
      toast.success(`Welcome back, ${loggedIn.fullName.split(' ')[0]}`);
      navigate(next ?? (loggedIn.role === 'employer' ? '/employer' : '/'), { replace: true });
    } catch (err) {
      setFormError(err.response?.status === 401 ? 'The email or password is incorrect.' : errorMessage(err));
    }
  };

  return (
    <Container className="grid gap-10 py-10 lg:grid-cols-2 lg:py-16">
      <AuthAside title="Pick up where you left off.">
        <p>Your saved jobs are waiting.</p>
        <p>See which applications have been reviewed.</p>
      </AuthAside>
      <section className="mx-auto w-full max-w-md self-center">
        <h1 className="text-3xl font-bold">Log in to Jobflow</h1>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
          {formError && <p role="alert" className="rounded-lg bg-ruby-tint px-3.5 py-2.5 text-sm text-ruby">{formError}</p>}
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Log in</Button>
        </form>
        <p className="mt-6 text-ink-soft">
          New to Jobflow? <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-medium text-sapphire underline underline-offset-4">Create an account</Link>
        </p>
      </section>
    </Container>
  );
}
