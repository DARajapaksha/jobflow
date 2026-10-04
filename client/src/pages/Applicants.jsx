import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useApplicants, useJob, useSetApplicationStatus } from '../api/hooks';
import { errorMessage } from '../api/client';
import ApplicantRow from '../components/ApplicantRow';
import Pagination from '../components/Pagination';
import { Button, Container, EmptyState, Skeleton, ToggleChip, buttonClass } from '../components/ui';
import { APPLICATION_STATUSES } from '../lib/constants';
import { usePageTitle } from '../lib/usePageTitle';

const FILTERS = [['', 'All'], ...['submitted', 'reviewed', 'shortlisted', 'hired', 'rejected'].map((k) => [k, APPLICATION_STATUSES[k]])];

export default function Applicants() {
  const { id } = useParams();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data: jobData } = useJob(id);
  const { data, isPending, isError, error, refetch } = useApplicants(id, { status: status || undefined, page, limit: 10 });
  const change = useSetApplicationStatus();
  const job = jobData?.job;
  usePageTitle(job ? `Applicants for ${job.title}` : 'Applicants');

  const onStatus = (application, to) => {
    if (to === 'rejected' && !window.confirm(`Reject ${application.applicant.fullName}? This can’t be undone.`)) return;
    change.mutate({ id: application.id, status: to }, { onSuccess: () => toast.success(`${application.applicant.fullName}: ${APPLICATION_STATUSES[to].toLowerCase()}`) });
  };

  const forbidden = [403, 404].includes(error?.response?.status);

  return (
    <Container className="max-w-4xl py-10">
      <Link to="/employer" className="mb-6 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />Your listings
      </Link>
      <h1 className="text-3xl font-bold">{job ? job.title : 'Applicants'}</h1>
      <p className="mt-1 text-ink-soft" aria-live="polite">
        {data ? `${data.pagination.total} ${data.pagination.total === 1 ? 'applicant' : 'applicants'}${status ? ` (${APPLICATION_STATUSES[status].toLowerCase()})` : ''}` : ' '}
      </p>

      <div role="group" aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <ToggleChip key={key || 'all'} pressed={status === key} onClick={() => { setStatus(key); setPage(1); }}>{label}</ToggleChip>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        {isPending ? (
          <div className="space-y-6 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : isError ? (
          forbidden ? (
            <EmptyState title="You can’t view these applicants" action={<Link to="/employer" className={buttonClass('primary')}>Back to your listings</Link>}>
              Applicants are only visible to the employer who posted the job.
            </EmptyState>
          ) : (
            <EmptyState title="Applicants couldn’t be loaded" action={<Button onClick={() => refetch()}>Try again</Button>}>{errorMessage(error)}</EmptyState>
          )
        ) : data.data.length === 0 ? (
          <EmptyState title={status ? 'No applicants with this status' : 'No applications yet'}>
            {status ? 'Try another filter.' : 'When job seekers apply, they will appear here.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {data.data.map((a) => (
              <ApplicantRow key={a.id} application={a} onStatus={(to) => onStatus(a, to)} pending={change.isPending && change.variables?.id === a.id} />
            ))}
          </ul>
        )}
      </div>
      {data && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />}
    </Container>
  );
}
