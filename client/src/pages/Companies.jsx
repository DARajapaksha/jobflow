import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { useCompanies } from '../api/hooks';
import { errorMessage } from '../api/client';
import CompanyMark from '../components/CompanyMark';
import Pagination from '../components/Pagination';
import { Button, Container, EmptyState, Skeleton } from '../components/ui';
import { usePageTitle } from '../lib/usePageTitle';

export default function Companies() {
  usePageTitle('Companies');
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useCompanies({ q: submitted || undefined, page, limit: 12 });

  return (
    <Container className="max-w-4xl py-10">
      <h1 className="text-3xl font-bold">Companies hiring now</h1>
      <form
        role="search"
        aria-label="Search companies"
        onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); setPage(1); }}
        className="mt-6 flex gap-2"
      >
        <div className="relative flex-1">
          <label htmlFor="company-search" className="sr-only">Company name</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input id="company-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by company name" maxLength={100} className="w-full rounded-lg border border-line bg-white py-2.5 pl-11 pr-3.5 placeholder:text-ink-soft/60 focus-visible:border-sapphire" />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        {isPending ? (
          <div className="space-y-6 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : isError ? (
          <EmptyState title="Companies couldn’t be loaded" action={<Button onClick={() => refetch()}>Try again</Button>}>{errorMessage(error)}</EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState title="No companies found">{submitted ? 'Try a different name.' : 'No company has an open job right now.'}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {data.data.map((c) => (
              <li key={c.id} className="relative flex gap-4 p-5 transition-colors hover:bg-sapphire-tint/50 sm:p-6">
                <CompanyMark name={c.name} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-snug">
                    <Link to={`/companies/${c.id}`} className="after:absolute after:inset-0 hover:text-sapphire focus-visible:outline-offset-[-2px]">{c.name}</Link>
                  </h2>
                  {c.location && <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-soft"><MapPin className="size-4" aria-hidden />{c.location}</p>}
                  {c.description && <p className="mt-2 line-clamp-2 text-ink-soft">{c.description}</p>}
                </div>
                <p className="shrink-0 text-sm font-semibold">{c.openJobCount} open {c.openJobCount === 1 ? 'job' : 'jobs'}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />}
    </Container>
  );
}
