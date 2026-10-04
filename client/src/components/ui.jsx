import { useEffect, useId, useRef } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { cn } from '../lib/cn';

export const Container = ({ className, children }) => (
  <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>
);

const VARIANTS = {
  primary: 'bg-sapphire text-white hover:bg-sapphire-deep',
  secondary: 'border border-line bg-white text-ink hover:bg-moon',
  ghost: 'text-ink-soft hover:bg-moon-deep hover:text-ink',
  danger: 'bg-ruby text-white hover:brightness-110',
  onDark: 'bg-white text-sapphire-deep hover:bg-sapphire-tint',
  outlineOnDark: 'border border-white/45 text-white hover:bg-white/10',
};
const SIZES = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-[0.95rem]', lg: 'px-6 py-3 text-base' };

// Use on <Link> as well as <button> so both look identical.
export const buttonClass = (variant = 'primary', size = 'md', extra) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
    SIZES[size],
    VARIANTS[variant],
    extra,
  );

export function Button({ variant, size, loading = false, className, children, disabled, type = 'button', ...props }) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const inputBase =
  'w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink placeholder:text-ink-soft/60 focus-visible:border-sapphire';

export function TextField({ label, error, hint, as: Tag = 'input', className, id, ...props }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1.5 block text-sm font-medium">{label}</label>
      <Tag
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn(inputBase, error && 'border-ruby')}
        {...props}
      />
      {hint && !error && <p id={`${fid}-hint`} className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
      {error && <p id={`${fid}-error`} role="alert" className="mt-1.5 text-sm text-ruby">{error}</p>}
    </div>
  );
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        className={cn('w-full appearance-none rounded-lg border border-line bg-white py-2.5 pl-3.5 pr-9 text-ink focus-visible:border-sapphire', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
    </div>
  );
}

export function ToggleChip({ pressed, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        pressed ? 'border-sapphire bg-sapphire text-white' : 'border-line bg-white text-ink-soft hover:border-ink-soft hover:text-ink',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const TONES = {
  neutral: 'bg-moon text-ink-soft',
  sapphire: 'bg-sapphire-tint text-sapphire-deep',
  tea: 'bg-tea-tint text-tea',
  citrine: 'bg-citrine-tint text-citrine',
  ruby: 'bg-ruby-tint text-ruby',
  amethyst: 'bg-amethyst-tint text-amethyst',
};
export const Badge = ({ tone = 'neutral', className, children }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone], className)}>{children}</span>
);

export function Spinner({ label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-ink-soft">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const Skeleton = ({ className }) => <div aria-hidden className={cn('animate-pulse rounded-md bg-moon-deep', className)} />;

export function EmptyState({ title, children, action }) {
  return (
    <div className="px-6 py-14 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="mx-auto mt-1.5 max-w-md text-ink-soft">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

// Built on the native <dialog>: focus trap, Escape to close and a backdrop come with the browser.
export function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-2xl bg-white p-0 text-ink shadow-2xl open:animate-sheet"
    >
      {open && (
        <div className="p-6 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-m-1.5 rounded-lg p-1.5 text-ink-soft hover:bg-moon">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
