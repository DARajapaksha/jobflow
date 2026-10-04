import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useMyApplications } from '../api/hooks';
import { errorMessage } from '../api/client';
import CompanyMark from '../components/CompanyMark';
import StatusRail from '../components/StatusRail';
import { Badge, Button, Container, EmptyState, Skeleton, buttonClass } from '../components/ui';
import { formatDate } from '../lib/format';
import { usePageTitle } from '../lib/usePageTitle';

export default function Applications() {
  usePageTitle('Your applications');
  const { data, isPending, isError, error, refetch } = useMyApplications();

  return (
    <Container className="max-w-4xl py-10">
      <h1 className="text-3xl font-bold">Your applications</h1>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        {isPending ? (
          <div className="space-y-6 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : isError ? (
          <EmptyState title="Applications couldn’t be loaded" action={<Button onClick={() => refetch()}>Try again</Button>}>{errorMessage(error)}</EmptyState>
        ) : data.length === 0 ? (
          <EmptyState title="You haven’t applied to any jobs yet" action={<Link to="/" className={buttonClass('primary')}>Browse jobs</Link>}>
            When you apply, you can follow each application here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {data.map((a) => (
              <li key={a.id} className="p-5 sm:p-6">
                <div className="flex gap-4">
                  <CompanyMark name={a.job.company.name} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold leading-snug">
                      {a.job.status === 'open' ? <Link to={`/jobs/${a.job.id}`} className="hover:text-sapphire">{a.job.title}</Link> : a.job.title}
                    </h2>
                    <p className="text-ink-soft">{a.job.company.name}</p>
                    <p className="mt-1 text-sm text-ink-soft">Applied {formatDate(a.appliedAt)}</p>
                  </div>
                  {a.job.status !== 'open' && <Badge className="h-fit shrink-0">Listing closed</Badge>}
                </div>
                <div className="mt-5 max-w-lg"><StatusRail status={a.status} /></div>
                <a href={`/api/applications/${a.id}/resume`} className="mt-4 inline-flex max-w-full items-center gap-2 text-sm font-medium text-sapphire hover:underline">
                  <FileText className="size-4 shrink-0" aria-hidden /><span className="truncate">{a.resume.filename}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
