import { Check } from 'lucide-react';
import { APPLICATION_STAGES } from '../lib/constants';
import { cn } from '../lib/cn';

// The hiring pipeline as a rail: stages already reached are filled, the current one is ringed.
export default function StatusRail({ status }) {
  if (status === 'rejected') {
    return <p className="inline-flex rounded-full bg-ruby-tint px-3 py-1 text-sm font-medium text-ruby">Not selected for this role</p>;
  }
  const current = APPLICATION_STAGES.findIndex((s) => s.key === status);

  return (
    <ol className="flex items-start" aria-label={`Application status: ${APPLICATION_STAGES[current]?.label}`}>
      {APPLICATION_STAGES.map((stage, i) => {
        const reached = i <= current;
        return (
          <li key={stage.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className={cn('absolute right-1/2 top-3 h-0.5 w-full', i <= current ? 'bg-sapphire' : 'bg-line')} />}
            <span
              aria-hidden
              className={cn(
                'relative z-10 grid size-6 place-items-center rounded-full border-2',
                reached ? 'border-sapphire bg-sapphire text-white' : 'border-line bg-white',
                i === current && 'ring-4 ring-sapphire/20',
                stage.key === 'hired' && reached && 'border-tea bg-tea',
              )}
            >
              {reached && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className={cn('mt-1.5 text-xs', i === current ? 'font-semibold text-ink' : 'text-ink-soft')}>{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
