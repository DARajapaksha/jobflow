import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useDeleteResume, useUpdateProfile, useUploadResume } from '../api/hooks';
import { applyApiErrors, notifyError } from '../api/client';
import { isPdf, sizeError } from '../components/ApplyModal';
import { Button, Container, TextField } from '../components/ui';
import CompanyProfile from './CompanyProfile';
import { usePageTitle } from '../lib/usePageTitle';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  headline: z.string().trim().max(160, 'Keep the headline under 160 characters'),
  location: z.string().trim().max(120),
  bio: z.string().trim().max(2000, 'Keep your bio under 2000 characters'),
  skills: z.array(z.string()).max(20, 'Add at most 20 skills'),
});

function TagInput({ value, onChange, label, hint }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const tag = draft.trim().replace(/,+$/, '').trim().slice(0, 40);
    setDraft('');
    if (!tag || value.length >= 20 || value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };
  return (
    <div>
      <label htmlFor="skills-input" className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2 focus-within:border-sapphire">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sapphire-tint py-1 pl-3 pr-1.5 text-sm font-medium text-sapphire-deep">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))} aria-label={`Remove ${tag}`} className="grid size-5 place-items-center rounded-full hover:bg-sapphire/15">
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id="skills-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={value.length ? '' : 'React, Node.js, SQL'}
          className="min-w-32 flex-1 bg-transparent px-1.5 py-1 outline-none placeholder:text-ink-soft/60"
        />
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>
    </div>
  );
}

function ResumeSection({ filename }) {
  const upload = useUploadResume();
  const remove = useDeleteResume();
  const input = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    const problem = !isPdf(file) ? 'Resumes must be PDF files.' : sizeError(file);
    if (problem) return toast.error(problem);
    upload.mutate(file, { onError: notifyError });
  };

  const onRemove = () => {
    if (window.confirm('Remove your saved resume? Applications you already sent keep their own copy.')) remove.mutate(undefined, { onError: notifyError });
  };

  return (
    <section aria-labelledby="resume-heading">
      <h2 id="resume-heading" className="text-xl font-semibold">Resume</h2>
      <p className="mt-1 text-ink-soft">Save a PDF here and apply to jobs without uploading it each time.</p>
      <input ref={input} type="file" accept="application/pdf,.pdf" onChange={onFile} className="sr-only" aria-label="Choose a PDF resume" />
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
        {filename ? (
          <>
            <FileText className="size-6 shrink-0 text-sapphire" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">{filename}</span>
            <a href="/api/me/resume" className="rounded-lg px-3 py-1.5 text-sm font-medium text-sapphire hover:bg-sapphire-tint">Download</a>
            <Button size="sm" variant="secondary" loading={upload.isPending} onClick={() => input.current?.click()}>Replace</Button>
            <Button size="sm" variant="ghost" loading={remove.isPending} onClick={onRemove}>Remove</Button>
          </>
        ) : (
          <>
            <Upload className="size-6 shrink-0 text-ink-soft" aria-hidden />
            <span className="flex-1 text-ink-soft">No resume saved yet.</span>
            <Button size="sm" loading={upload.isPending} onClick={() => input.current?.click()}>Upload PDF</Button>
          </>
        )}
      </div>
    </section>
  );
}

function SeekerProfile() {
  const { user, profile } = useAuth();
  const update = useUpdateProfile();
  const { register, handleSubmit, control, setError, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    values: {
      fullName: user.fullName,
      headline: profile?.headline ?? '',
      location: profile?.location ?? '',
      bio: profile?.bio ?? '',
      skills: profile?.skills ?? [],
    },
  });

  const onSubmit = (values) =>
    update.mutate(values, { onError: (err) => !applyApiErrors(err, setError) && notifyError(err) });

  return (
    <Container className="max-w-3xl space-y-12 py-10">
      <div>
        <h1 className="text-3xl font-bold">Your profile</h1>
        <p className="mt-1 text-ink-soft">{user.email}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-label="Profile details">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
          <TextField label="Location" autoComplete="address-level2" placeholder="Colombo" error={errors.location?.message} {...register('location')} />
        </div>
        <TextField label="Headline" placeholder="Final-year computing student" hint="One line employers see first." error={errors.headline?.message} {...register('headline')} />
        <TextField as="textarea" rows={5} label="About you" error={errors.bio?.message} {...register('bio')} />
        <Controller control={control} name="skills" render={({ field }) => (
          <TagInput label="Skills" value={field.value} onChange={field.onChange} hint="Press Enter or comma after each skill." />
        )} />
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>Save profile</Button>
      </form>

      <ResumeSection filename={profile?.resumeFilename} />
    </Container>
  );
}

export default function Profile() {
  usePageTitle('Profile');
  const { user } = useAuth();
  return user.role === 'employer' ? <CompanyProfile /> : <SeekerProfile />;
}
