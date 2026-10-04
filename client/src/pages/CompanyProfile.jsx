import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useUpdateProfile } from '../api/hooks';
import { applyApiErrors, notifyError } from '../api/client';
import { Button, Container, TextField } from '../components/ui';

const isHttpUrl = (v) => {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your company name').max(160),
  location: z.string().trim().max(120),
  website: z.string().trim().max(255).refine((v) => v === '' || isHttpUrl(v), 'Start with http:// or https://'),
  description: z.string().trim().max(5000, 'Keep the description under 5000 characters'),
  fullName: z.string().trim().min(2, 'Enter your name').max(120),
});

export default function CompanyProfile() {
  const { user, company } = useAuth();
  const update = useUpdateProfile();
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    values: {
      name: company?.name ?? '',
      location: company?.location ?? '',
      website: company?.website ?? '',
      description: company?.description ?? '',
      fullName: user.fullName,
    },
  });

  const onSubmit = (values) => update.mutate(values, { onError: (err) => !applyApiErrors(err, setError) && notifyError(err) });

  return (
    <Container className="max-w-3xl py-10">
      <h1 className="text-3xl font-bold">Company profile</h1>
      <p className="mt-1 text-ink-soft">Job seekers see this on every listing you post.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5" aria-label="Company details">
        <TextField label="Company name" autoComplete="organization" error={errors.name?.message} {...register('name')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Location" placeholder="Colombo" error={errors.location?.message} {...register('location')} />
          <TextField label="Website" type="url" placeholder="https://example.com" error={errors.website?.message} {...register('website')} />
        </div>
        <TextField as="textarea" rows={6} label="About the company" error={errors.description?.message} {...register('description')} />
        <TextField label="Your name" autoComplete="name" hint={`Signed in as ${user.email}`} error={errors.fullName?.message} {...register('fullName')} />
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>Save company profile</Button>
      </form>
    </Container>
  );
}
