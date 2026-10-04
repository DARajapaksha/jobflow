import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSavedJobs } from '../api/hooks';
import { errorMessage } from '../api/client';
import BookmarkButton from '../components/BookmarkButton';
import JobRow from '../components/JobRow';
import Pagination from '../components/Pagination';
import { Button, Container, EmptyState, Skeleton, buttonClass } from '../components/ui';
import { usePageTitle } from '../lib/usePageTitle';

export default function Saved() {
  usePageTitle('Saved jobs');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useSavedJobs({ page, limit: 10 });

  return (
    <Container className="max-w-4xl py-10">
      <h1 className="text-3xl font-bold">Saved jobs</h1>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        {isPending ? (
          <div className="space-y-5 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : isError ? (
          <EmptyState title="Saved jobs couldn’t be loaded" action={<Button onClick={() => refetch()}>Try again</Button>}>{errorMessage(error)}</EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState title="Nothing saved yet" action={<Link to="/" className={buttonClass('primary')}>Browse jobs</Link>}>
            Tap the bookmark on a job to keep it here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {data.data.map((job) => (
              <JobRow key={job.id} job={job} unavailable={!job.available} action={<BookmarkButton job={job} saved />} />
            ))}
          </ul>
        )}
      </div>
      {data && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />}
    </Container>
  );
}
