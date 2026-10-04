import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import { useDeleteJob, useMyJobs, useSetJobStatus } from '../api/hooks';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Container, EmptyState, Skeleton, ToggleChip, buttonClass } from '../components/ui';
import { JOB_STATUS_TONE, JOB_STATUSES } from '../lib/constants';
import { formatDate, timeAgo } from '../lib/format';
import { usePageTitle } from '../lib/usePageTitle';

const FILTERS = [['all', 'All'], ['open', 'Open'], ['draft', 'Drafts'], ['closed', 'Closed']];
const isExpired = (job) => job.status === 'open' && job.expiresAt && new Date(job.expiresAt) <= new Date();

function ListingRow({ job }) {
  const setStatus = useSetJobStatus();
  const remove = useDeleteJob();
  const expired = isExpired(job);
  const next = { open: ['closed', 'Close listing'], closed: ['open', 'Reopen'], draft: ['open', 'Publish'] }[job.status];
  const busy = setStatus.isPending || remove.isPending;

  const onDelete = () => {
    if (window.confirm(`Delete “${job.title}”? Applications it received are deleted too.`)) remove.mutate(job.id);
  };

  return (
    <li className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold leading-snug">
            {job.status === 'open' && !expired ? <Link to={`/jobs/${job.id}`} className="hover:text-sapphire">{job.title}</Link> : job.title}
          </h2>
          <Badge tone={expired ? 'ruby' : JOB_STATUS_TONE[job.status]}>{expired ? 'Expired' : JOB_STATUSES[job.status]}</Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
          {job.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{job.location}</span>}
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden />Posted {timeAgo(job.createdAt).toLowerCase()}</span>
          {job.expiresAt && <span>{expired ? 'Closed' : 'Closes'} {formatDate(job.expiresAt)}</span>}
        </div>
        <p className="mt-2 text-sm">
          {job.applicantCount > 0 ? (
            <Link to={`/employer/jobs/${job.id}/applicants`} className="font-semibold text-sapphire hover:underline">
              {job.applicantCount} {job.applicantCount === 1 ? 'applicant' : 'applicants'}
            </Link>
          ) : (
            <span className="text-ink-soft">No applicants yet</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link to={`/employer/jobs/${job.id}/edit`} className={buttonClass('secondary', 'sm')}>Edit</Link>
        {next && (
          <Button size="sm" variant="secondary" loading={setStatus.isPending} disabled={busy} onClick={() => setStatus.mutate({ id: job.id, status: next[0] })}>
            {next[1]}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-ruby hover:bg-ruby-tint hover:text-ruby" loading={remove.isPending} disabled={busy} onClick={onDelete}>Delete</Button>
      </div>
    </li>
  );
}

export default function EmployerDashboard() {
  usePageTitle('Your listings');
  const { company } = useAuth();
  const { data, isPending, isError, error, refetch } = useMyJobs();
  const [filter, setFilter] = useState('all');

  const count = (key) => (key === 'all' ? data.length : data.filter((j) => j.status === key).length);
  const shown = data && (filter === 'all' ? data : data.filter((j) => j.status === filter));

  return (
    <Container className="max-w-4xl py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your listings</h1>
          {company && <p className="mt-1 text-ink-soft">{company.name}</p>}
        </div>
        <Link to="/employer/jobs/new" className={buttonClass('primary', 'lg')}>Post a job</Link>
      </div>

      {data?.length > 0 && (
        <div role="group" aria-label="Filter listings" className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => (
            <ToggleChip key={key} pressed={filter === key} onClick={() => setFilter(key)}>{label} ({count(key)})</ToggleChip>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        {isPending ? (
          <div className="space-y-6 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : isError ? (
          <EmptyState title="Your listings couldn’t be loaded" action={<Button onClick={() => refetch()}>Try again</Button>}>{errorMessage(error)}</EmptyState>
        ) : data.length === 0 ? (
          <EmptyState title="You haven’t posted a job yet" action={<Link to="/employer/jobs/new" className={buttonClass('primary')}>Post your first job</Link>}>
            Listings you publish appear in search straight away. Drafts stay private until you publish them.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState title={`No ${FILTERS.find(([k]) => k === filter)[1].toLowerCase()} listings`} />
        ) : (
          <ul className="divide-y divide-line">{shown.map((job) => <ListingRow key={job.id} job={job} />)}</ul>
        )}
      </div>
    </Container>
  );
}
