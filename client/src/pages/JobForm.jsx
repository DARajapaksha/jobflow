import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCategories, useCreateJob, useJob, useMyJobs, useUpdateJob } from '../api/hooks';
import { applyApiErrors, errorMessage } from '../api/client';
import JobDescription from '../components/JobDescription';
import { Button, Container, EmptyState, Select, Skeleton, TextField, ToggleChip, buttonClass } from '../components/ui';
import { JOB_TYPES, WORK_MODES } from '../lib/constants';
import { emptyJob, formToPayload, jobToForm, makeJobSchema, numberOrNull } from '../lib/jobForm';
import { usePageTitle } from '../lib/usePageTitle';

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function Section({ title, children }) {
  return (
    <fieldset className="space-y-5 border-t border-line pt-8 first:border-0 first:pt-0">
      <legend className="mb-1 text-xl font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function JobFormFields({ job }) {
  const navigate = useNavigate();
  const editing = Boolean(job);
  const original = useMemo(() => (job ? jobToForm(job) : emptyJob), [job]);
  const schema = useMemo(() => makeJobSchema(original.expiresAt), [original.expiresAt]);
  const { data: categories = [] } = useCategories();
  const create = useCreateJob();
  const update = useUpdateJob(job?.id);
  const [preview, setPreview] = useState(false);
  const [formError, setFormError] = useState('');

  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: original,
  });
  const description = watch('description');
  const isDraft = !editing || job.status === 'draft';

  // status: 'draft' | 'open' to set it explicitly; undefined keeps the current one (editing an open or closed job)
  const save = (status) =>
    handleSubmit(async (values) => {
      setFormError('');
      try {
        const payload = formToPayload(values, { originalExpiry: original.expiresAt, status });
        if (editing) await update.mutateAsync(payload);
        else await create.mutateAsync(payload);
        toast.success(status === 'open' && isDraft ? 'Job published' : status === 'draft' ? 'Draft saved' : 'Changes saved');
        navigate('/employer');
      } catch (err) {
        if (!applyApiErrors(err, setError)) setFormError(errorMessage(err));
      }
    });

  return (
    <form onSubmit={save(isDraft ? 'open' : undefined)} noValidate className="mt-8 space-y-10">
      {formError && <p role="alert" className="rounded-lg bg-ruby-tint px-3.5 py-2.5 text-sm text-ruby">{formError}</p>}

      <Section title="The role">
        <TextField label="Job title" placeholder="Frontend Developer" error={errors.title?.message} {...register('title')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="job-category" className="mb-1.5 block text-sm font-medium">Category</label>
            <Select id="job-category" {...register('categoryId', { setValueAs: numberOrNull })}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <TextField label="Location" placeholder="Colombo" error={errors.location?.message} {...register('location')} />
          <div>
            <label htmlFor="job-type" className="mb-1.5 block text-sm font-medium">Job type</label>
            <Select id="job-type" {...register('jobType')}>
              {Object.entries(JOB_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="job-mode" className="mb-1.5 block text-sm font-medium">Work mode</label>
            <Select id="job-mode" {...register('workMode')}>
              {Object.entries(WORK_MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Pay and dates">
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField label="Minimum salary" type="number" inputMode="numeric" min={0} step={1000} placeholder="100000" hint="In LKR. Optional." error={errors.salaryMin?.message} {...register('salaryMin', { setValueAs: numberOrNull })} />
          <TextField label="Maximum salary" type="number" inputMode="numeric" min={0} step={1000} placeholder="150000" error={errors.salaryMax?.message} {...register('salaryMax', { setValueAs: numberOrNull })} />
          <TextField label="Applications close" type="date" min={tomorrow()} hint="Optional. Leave empty for no deadline." error={errors.expiresAt?.message} {...register('expiresAt')} />
        </div>
      </Section>

      <Section title="Description">
        <div role="group" aria-label="Description view" className="flex gap-2">
          <ToggleChip pressed={!preview} onClick={() => setPreview(false)}>Write</ToggleChip>
          <ToggleChip pressed={preview} onClick={() => setPreview(true)}>Preview</ToggleChip>
        </div>
        {preview ? (
          <div className="min-h-64 rounded-lg border border-line bg-white p-5">
            {description.trim() ? <JobDescription text={description} /> : <p className="text-ink-soft">Nothing to preview yet.</p>}
          </div>
        ) : (
          <TextField
            as="textarea"
            rows={14}
            label="About the role"
            className="[&_label]:sr-only"
            hint="Leave a blank line between paragraphs. Start lines with “- ” for bullet points; a short line above bullets becomes a heading."
            error={errors.description?.message}
            {...register('description')}
          />
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-8">
        {isDraft ? (
          <>
            <Button type="submit" size="lg" loading={isSubmitting}>Publish</Button>
            <Button size="lg" variant="secondary" disabled={isSubmitting} onClick={save('draft')}>Save as draft</Button>
          </>
        ) : (
          <Button type="submit" size="lg" loading={isSubmitting}>Save changes</Button>
        )}
        <Link to="/employer" className={buttonClass('ghost', 'lg')}>Cancel</Link>
      </div>
    </form>
  );
}

export default function JobForm() {
  const { id } = useParams();
  usePageTitle(id ? 'Edit listing' : 'Post a job');
  const { data: mine, isPending: minePending } = useMyJobs();
  const { data, isPending, isError } = useJob(id);

  let body;
  if (!id) body = <JobFormFields key="new" />;
  else if (isPending || minePending) body = <div className="mt-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  else if (isError || !mine?.some((j) => j.id === id)) {
    body = (
      <EmptyState title="You can’t edit this listing" action={<Link to="/employer" className={buttonClass('primary')}>Back to your listings</Link>}>
        It may have been deleted, or it belongs to another account.
      </EmptyState>
    );
  } else body = <JobFormFields key={data.job.id} job={data.job} />;

  return (
    <Container className="max-w-3xl py-10">
      <Link to="/employer" className="mb-6 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />Your listings
      </Link>
      <h1 className="text-3xl font-bold">{id ? 'Edit listing' : 'Post a job'}</h1>
      {body}
    </Container>
  );
}
