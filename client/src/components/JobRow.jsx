import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import CompanyMark from './CompanyMark';
import { Badge } from './ui';
import { cn } from '../lib/cn';
import { JOB_TYPES, WORK_MODES } from '../lib/constants';
import { formatSalary, timeAgo } from '../lib/format';

const MODE_TONE = { remote: 'tea', hybrid: 'amethyst', onsite: 'neutral' };

// One line of the results list. The whole row is clickable through the title link; `action` (the bookmark) sits above it.
export default function JobRow({ job, action, unavailable = false }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const location = job.location && job.location.toLowerCase() !== 'remote' ? job.location : null; // the Remote tag already says it

  return (
    <li className={cn('relative flex gap-4 p-4 transition-colors sm:p-5', unavailable ? 'bg-moon/60' : 'hover:bg-sapphire-tint/50')}>
      <CompanyMark name={job.company.name} />
      <div className="min-w-0 flex-1">
        <h3 className={cn('text-lg font-semibold leading-snug', unavailable && 'text-ink-soft')}>
          {unavailable ? (
            job.title
          ) : (
            <Link to={`/jobs/${job.id}`} className="after:absolute after:inset-0 hover:text-sapphire focus-visible:outline-offset-[-2px]">
              {job.title}
            </Link>
          )}
        </h3>
        <p className="text-ink-soft">{job.company.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
          {location && (
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{location}</span>
          )}
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden />{timeAgo(job.createdAt)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge>{JOB_TYPES[job.jobType]}</Badge>
          <Badge tone={MODE_TONE[job.workMode]}>{WORK_MODES[job.workMode]}</Badge>
          {job.category && <Badge>{job.category.name}</Badge>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        {unavailable ? (
          <span className="text-sm font-medium text-ink-soft">No longer open</span>
        ) : (
          salary && <span className="text-sm font-semibold tabular-nums">{salary}</span>
        )}
        {action}
      </div>
    </li>
  );
}
