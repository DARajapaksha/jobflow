import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin } from 'lucide-react';
import { useCompany, useJobs } from '../api/hooks';
import BookmarkButton from '../components/BookmarkButton';
import CompanyMark from '../components/CompanyMark';
import JobRow from '../components/JobRow';
import { Container, EmptyState, Skeleton, buttonClass } from '../components/ui';
import { usePageTitle } from '../lib/usePageTitle';

export default function CompanyPage() {
  const { id } = useParams();
  const { data: company, isPending, isError } = useCompany(id);
  const { data: jobs } = useJobs({ company: id, limit: 20 });
  usePageTitle(company?.name ?? 'Company');

  if (isPending) return <Container className="max-w-4xl py-10"><Skeleton className="h-40 w-full" /></Container>;
  if (isError) {
    return (
      <Container className="max-w-4xl py-16">
        <EmptyState title="This company isn’t available" action={<Link to="/companies" className={buttonClass('primary')}>See all companies</Link>} />
      </Container>
    );
  }

  return (
    <Container className="max-w-4xl py-10">
      <Link to="/companies" className="mb-6 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />All companies
      </Link>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <CompanyMark name={company.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{company.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-ink-soft">
            {company.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{company.location}</span>}
            {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sapphire underline underline-offset-4">{company.website.replace(/^https?:\/\//, '')}</a>}
          </div>
        </div>
      </header>
      {company.description && <p className="mt-6 max-w-[66ch] font-serif text-[1.1rem] leading-8">{company.description}</p>}

      <h2 className="mt-10 text-xl font-semibold">Open jobs ({company.openJobCount})</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
        {!jobs ? (
          <div className="p-6"><Skeleton className="h-20 w-full" /></div>
        ) : jobs.data.length === 0 ? (
          <EmptyState title="No open jobs right now">Check back soon.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">{jobs.data.map((job) => <JobRow key={job.id} job={job} action={<BookmarkButton job={job} />} />)}</ul>
        )}
      </div>
    </Container>
  );
}
