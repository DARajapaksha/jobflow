import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Briefcase, CalendarClock, ChevronLeft, Clock, MapPin } from 'lucide-react';
import { useJob } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import ApplyModal from '../components/ApplyModal';
import BookmarkButton from '../components/BookmarkButton';
import CompanyMark from '../components/CompanyMark';
import JobDescription from '../components/JobDescription';
import { Badge, Button, Container, EmptyState, Skeleton, buttonClass } from '../components/ui';
import { JOB_TYPES, APPLICATION_STAGES, WORK_MODES } from '../lib/constants';
import { formatDate, formatSalary, timeAgo } from '../lib/format';
import { usePageTitle } from '../lib/usePageTitle';

const MODE_TONE = { remote: 'tea', hybrid: 'amethyst', onsite: 'neutral' };

function ApplyPanel({ job, viewer, onApply }) {
  const { user } = useAuth();
  const location = useLocation();
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const next = encodeURIComponent(location.pathname);
  const live = job.status === 'open';
  const stage = viewer?.application && APPLICATION_STAGES.find((s) => s.key === viewer.application.status);

  return (
    <aside className="on-dark rounded-3xl bg-sapphire-deep p-6 text-white lg:sticky lg:top-24">
      {salary && <p className="text-2xl font-bold tabular-nums">{salary}</p>}
      {job.expiresAt && <p className={`text-sm text-white/75 ${salary ? 'mt-1' : ''}`}>Applications close {formatDate(job.expiresAt)}</p>}

      <div className={`space-y-3 ${salary || job.expiresAt ? 'mt-5' : ''}`}>
        {!live ? (
          <p className="rounded-lg bg-white/10 px-3.5 py-3 text-sm">This listing is {job.status === 'draft' ? 'a draft' : 'closed'}. Only you can see it.</p>
        ) : user?.role === 'employer' ? (
          <p className="rounded-lg bg-white/10 px-3.5 py-3 text-sm">You’re logged in as an employer. Only job seekers can apply.</p>
        ) : !user ? (
          <>
            <Link to={`/login?next=${next}`} className={buttonClass('onDark', 'lg', 'w-full')}>Log in to apply</Link>
            <p className="text-center text-sm text-white/80">
              New to Jobflow? <Link to={`/register?next=${next}`} className="font-semibold underline underline-offset-4">Create an account</Link>
            </p>
          </>
        ) : viewer?.application ? (
          <div className="rounded-lg bg-white/10 px-3.5 py-3 text-sm">
            <p className="font-semibold">You applied to this job.</p>
            <p className="mt-0.5 text-white/85">Status: {stage?.label ?? 'Not selected'}.</p>
            <Link to="/applications" className="mt-2 inline-block font-semibold underline underline-offset-4">See all your applications</Link>
          </div>
        ) : (
          <Button variant="onDark" size="lg" className="w-full" onClick={onApply}>Apply now</Button>
        )}
        {live && user?.role !== 'employer' && <BookmarkButton job={job} saved={viewer?.saved ?? false} withLabel />}
      </div>
    </aside>
  );
}

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isPending, isError, error } = useJob(id);
  const [applyOpen, setApplyOpen] = useState(false);
  const job = data?.job;
  usePageTitle(job ? `${job.title} at ${job.company.name}` : 'Job');

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));

  if (isPending) {
    return (
      <Container className="py-10">
        <Skeleton className="mb-8 h-5 w-32" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4"><Skeleton className="size-16 rounded-2xl" /><Skeleton className="h-9 w-3/5" /><Skeleton className="h-5 w-2/5" /><Skeleton className="mt-8 h-64 w-full" /></div>
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      </Container>
    );
  }

  if (isError) {
    const missing = [400, 404].includes(error?.response?.status);
    return (
      <Container className="py-16">
        <EmptyState
          title={missing ? 'This job isn’t available' : 'The job couldn’t be loaded'}
          action={<Link to="/" className={buttonClass('primary')}>Browse jobs</Link>}
        >
          {missing ? 'It may have been filled, closed or removed by the employer.' : 'Check your connection and reload the page.'}
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10">
      <button type="button" onClick={back} className="mb-6 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />Back to search
      </button>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <article>
          <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <CompanyMark name={job.company.name} size="lg" />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{job.title}</h1>
              <p className="mt-1 text-lg text-ink-soft">{job.company.name}</p>
            </div>
          </header>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-ink-soft">
            {job.location && job.location.toLowerCase() !== 'remote' && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{job.location}</span>
            )}
            <span className="inline-flex items-center gap-1.5"><Briefcase className="size-4" aria-hidden />{JOB_TYPES[job.jobType]}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden />Posted {timeAgo(job.createdAt).toLowerCase()}</span>
            {job.expiresAt && <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden />Closes {formatDate(job.expiresAt)}</span>}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge tone={MODE_TONE[job.workMode]}>{WORK_MODES[job.workMode]}</Badge>
            {job.category && <Badge>{job.category.name}</Badge>}
          </div>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">About the role</h2>
            <div className="mt-4"><JobDescription text={job.description} /></div>
          </section>

          <section className="mt-10 max-w-[66ch] border-t border-line pt-8">
            <h2 className="text-xl font-semibold">About {job.company.name}</h2>
            {job.company.description && <p className="mt-3 font-serif text-[1.1rem] leading-8">{job.company.description}</p>}
            <dl className="mt-4 space-y-1 text-ink-soft">
              {job.company.location && <div className="flex gap-2"><dt className="font-medium text-ink">Based in</dt><dd>{job.company.location}</dd></div>}
              {job.company.website && (
                <div className="flex gap-2">
                  <dt className="font-medium text-ink">Website</dt>
                  <dd><a href={job.company.website} target="_blank" rel="noopener noreferrer" className="text-sapphire underline underline-offset-4">{job.company.website.replace(/^https?:\/\//, '')}</a></dd>
                </div>
              )}
            </dl>
          </section>
        </article>

        <div>
          <ApplyPanel job={job} viewer={data.viewer} onApply={() => setApplyOpen(true)} />
        </div>
      </div>

      <ApplyModal job={job} open={applyOpen} onClose={() => setApplyOpen(false)} />
    </Container>
  );
}
