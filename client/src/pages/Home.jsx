import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCategories, useJobs } from '../api/hooks';
import { errorMessage } from '../api/client';
import JobRow from '../components/JobRow';
import BookmarkButton from '../components/BookmarkButton';
import EmptyBoard from '../components/EmptyBoard';
import Pagination from '../components/Pagination';
import { Button, Container, EmptyState, Select, Skeleton, ToggleChip } from '../components/ui';
import { JOB_TYPES, WORK_MODES } from '../lib/constants';
import { cn } from '../lib/cn';
import { usePageTitle } from '../lib/usePageTitle';

const SALARY_STEPS = [50_000, 100_000, 150_000, 200_000];
const SORTS = ['newest', 'salary_desc'];
const list = (value, allowed) => (value ?? '').split(',').filter((v) => allowed.includes(v));

// The URL is the source of truth for the search, so results can be shared and the back button works.
function filtersFromUrl(sp) {
  return {
    q: sp.get('q') ?? '',
    location: sp.get('location') ?? '',
    category: /^\d+$/.test(sp.get('category') ?? '') ? sp.get('category') : '',
    type: list(sp.get('type'), Object.keys(JOB_TYPES)),
    mode: list(sp.get('mode'), Object.keys(WORK_MODES)),
    salaryMin: /^\d+$/.test(sp.get('salaryMin') ?? '') ? sp.get('salaryMin') : '',
    sort: SORTS.includes(sp.get('sort')) ? sp.get('sort') : '',
    page: Math.max(1, Number(sp.get('page')) || 1),
  };
}

function apiParams(f) {
  const params = { page: f.page, limit: 10 };
  for (const key of ['q', 'location', 'category', 'salaryMin', 'sort']) if (f[key]) params[key] = f[key];
  if (f.type.length) params.type = f.type.join(',');
  if (f.mode.length) params.mode = f.mode.join(',');
  return params;
}

function Blank({ value, onChange, placeholder, label }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      maxLength={100}
      style={{ width: `${Math.max(value.length, placeholder.length) * 0.5 + 0.8}em` }}
      className="mx-1 inline-block max-w-full border-b-[3px] border-white/50 bg-transparent px-1 text-white placeholder:text-white/55 focus-visible:border-white focus-visible:bg-white/10"
    />
  );
}

// The page's one big idea: the search is a sentence you finish.
function SearchSentence({ initialQ, initialLocation, onSearch }) {
  const [q, setQ] = useState(initialQ);
  const [location, setLocation] = useState(initialLocation);
  return (
    <form
      role="search"
      aria-label="Search jobs"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch({ q: q.trim(), location: location.trim() });
      }}
    >
      <p className="text-[clamp(1.75rem,4.6vw,3.25rem)] font-semibold leading-[1.35] tracking-tight">
        I’m looking for <Blank value={q} onChange={setQ} placeholder="any role" label="Job title or keyword" /> jobs in{' '}
        <span className="whitespace-nowrap"><Blank value={location} onChange={setLocation} placeholder="anywhere" label="Location" />.</span>
      </p>
      <Button type="submit" variant="onDark" size="lg" className="mt-8">Search jobs</Button>
    </form>
  );
}

function SkeletonRows() {
  return (
    <ul aria-label="Loading jobs" className="divide-y divide-line">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex gap-4 p-5">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  usePageTitle('');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromUrl(searchParams);
  const { data: categories = [] } = useCategories();
  const { data, isPending, isError, error, isPlaceholderData, refetch } = useJobs(apiParams(filters));
  const resultsRef = useRef(null);

  const setFilters = (patch, { keepPage = false } = {}) => {
    const next = { ...filters, ...patch, ...(keepPage ? {} : { page: 1 }) };
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (Array.isArray(value)) value.length && sp.set(key, value.join(','));
      else if (value && !(key === 'page' && value === 1)) sp.set(key, String(value));
    }
    setSearchParams(sp);
  };
  const toggle = (key, value) =>
    setFilters({ [key]: filters[key].includes(value) ? filters[key].filter((v) => v !== value) : [...filters[key], value] });
  const hasFilters = Boolean(filters.q || filters.location || filters.category || filters.salaryMin || filters.type.length || filters.mode.length);
  const total = data?.pagination.total;

  const changePage = (page) => {
    setFilters({ page }, { keepPage: true });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <section className="px-4 pt-6 sm:px-6">
        <div className="on-dark mx-auto max-w-6xl rounded-[2rem] bg-sapphire px-6 py-12 text-white sm:rounded-br-[7rem] sm:px-14 sm:py-16">
          <h1 className="sr-only">Find a job</h1>
          <SearchSentence
            key={`${filters.q}|${filters.location}`}
            initialQ={filters.q}
            initialLocation={filters.location}
            onSearch={(patch) => setFilters(patch)}
          />
        </div>
      </section>

      <Container className="mt-8">
        <section aria-label="Filters" className="space-y-5">
          <div className="-mx-4 flex flex-col gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-row sm:flex-wrap sm:gap-x-10 sm:gap-y-4 sm:overflow-visible sm:px-0">
            <div role="group" aria-label="Job type" className="flex gap-2 sm:flex-wrap">
              {Object.entries(JOB_TYPES).map(([value, label]) => (
                <ToggleChip key={value} pressed={filters.type.includes(value)} onClick={() => toggle('type', value)}>{label}</ToggleChip>
              ))}
            </div>
            <div role="group" aria-label="Work mode" className="flex gap-2 sm:flex-wrap">
              {Object.entries(WORK_MODES).map(([value, label]) => (
                <ToggleChip key={value} pressed={filters.mode.includes(value)} onClick={() => toggle('mode', value)}>{label}</ToggleChip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:max-w-3xl">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="f-category" className="mb-1.5 block text-sm font-medium">Category</label>
              <Select id="f-category" value={filters.category} onChange={(e) => setFilters({ category: e.target.value })}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="f-salary" className="mb-1.5 block text-sm font-medium">Minimum salary</label>
              <Select id="f-salary" value={filters.salaryMin} onChange={(e) => setFilters({ salaryMin: e.target.value })}>
                <option value="">Any salary</option>
                {SALARY_STEPS.map((n) => <option key={n} value={n}>LKR {n / 1000}k or more</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="f-sort" className="mb-1.5 block text-sm font-medium">Sort by</label>
              <Select id="f-sort" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
                <option value="">Best match</option>
                <option value="newest">Newest first</option>
                <option value="salary_desc">Highest paying</option>
              </Select>
            </div>
          </div>
        </section>

        <section ref={resultsRef} aria-label="Results" className="mt-8 scroll-mt-20">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 aria-live="polite" className="text-xl font-semibold">
              {total == null ? 'Jobs' : `${total} ${total === 1 ? 'job' : 'jobs'}`}
              {filters.q && ` for “${filters.q}”`}
              {filters.location && ` in ${filters.location}`}
            </h2>
            {hasFilters && (
              <button type="button" onClick={() => setSearchParams({})} className="shrink-0 text-sm font-medium text-sapphire hover:underline">Clear all</button>
            )}
          </div>

          <div className={cn('overflow-hidden rounded-2xl border border-line bg-white transition-opacity', isPlaceholderData && 'opacity-60')}>
            {isPending ? (
              <SkeletonRows />
            ) : isError ? (
              <EmptyState title="Jobs couldn’t be loaded" action={<Button onClick={() => refetch()}>Try again</Button>}>
                {errorMessage(error)}
              </EmptyState>
            ) : data.pagination.total === 0 && !hasFilters ? (
              <EmptyBoard />
            ) : data.data.length === 0 ? (
              <EmptyState
                title="No jobs match your search"
                action={hasFilters && <Button variant="secondary" onClick={() => setSearchParams({})}>Clear all filters</Button>}
              >
                Try a shorter keyword, a nearby city, or remove a filter.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.data.map((job) => <JobRow key={job.id} job={job} action={<BookmarkButton job={job} />} />)}
              </ul>
            )}
          </div>
          {data && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={changePage} />}
        </section>
      </Container>
    </>
  );
}
