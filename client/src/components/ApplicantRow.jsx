import { FileText, Mail, MapPin } from 'lucide-react';
import Avatar from './Avatar';
import { Badge, Button } from './ui';
import { APPLICATION_STATUSES, APPLICATION_TONE, NEXT_STATUSES } from '../lib/constants';
import { formatDate } from '../lib/format';
import { cn } from '../lib/cn';

// One applicant. Presentational: the page decides what a status change does.
export default function ApplicantRow({ application, onStatus, pending = false }) {
  const { applicant, status } = application;
  const actions = NEXT_STATUSES[status];

  return (
    <li className="p-5 sm:p-6">
      <div className="flex gap-4">
        <Avatar name={applicant.fullName} src={applicant.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-snug">{applicant.fullName}</h3>
              {applicant.headline && <p className="text-ink-soft">{applicant.headline}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-soft">Applied {formatDate(application.appliedAt)}</span>
              <Badge tone={APPLICATION_TONE[status]}>{APPLICATION_STATUSES[status]}</Badge>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
            <a href={`mailto:${applicant.email}`} className="inline-flex items-center gap-1.5 hover:text-sapphire"><Mail className="size-4" aria-hidden />{applicant.email}</a>
            {applicant.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{applicant.location}</span>}
            <a href={`/api/applications/${application.id}/resume`} className="inline-flex max-w-full items-center gap-1.5 font-medium text-sapphire hover:underline">
              <FileText className="size-4 shrink-0" aria-hidden /><span className="truncate">{application.resume.filename}</span>
            </a>
          </div>

          {applicant.skills.length > 0 && (
            <ul aria-label="Skills" className="mt-3 flex flex-wrap gap-1.5">
              {applicant.skills.slice(0, 8).map((s) => <li key={s}><Badge>{s}</Badge></li>)}
            </ul>
          )}

          {application.coverLetter && (
            <details className="group mt-3">
              <summary className="cursor-pointer text-sm font-medium text-sapphire hover:underline">Read cover letter</summary>
              <p className="mt-2 max-w-[66ch] whitespace-pre-line rounded-lg bg-moon px-4 py-3 font-serif text-[1.05rem] leading-7">{application.coverLetter}</p>
            </details>
          )}

          {actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button
                  key={a.to}
                  size="sm"
                  variant={a.danger ? 'ghost' : 'primary'}
                  className={cn(a.danger && 'text-ruby hover:bg-ruby-tint hover:text-ruby')}
                  disabled={pending}
                  onClick={() => onStatus(a.to)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
