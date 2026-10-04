import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';

// 1 … 4 5 6 … 12
export function pageWindow(page, total) {
  const wanted = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const base = 'grid h-10 min-w-10 place-items-center rounded-lg px-2 text-sm font-medium transition-colors';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 py-5">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} className={cn(base, 'text-ink-soft hover:bg-moon-deep disabled:opacity-40')}>
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-ink-soft">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={cn(base, p === page ? 'bg-sapphire text-white' : 'text-ink-soft hover:bg-moon-deep')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={cn(base, 'text-ink-soft hover:bg-moon-deep disabled:opacity-40')}>
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </nav>
  );
}
