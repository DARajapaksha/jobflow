import { Bookmark } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useToggleSave } from '../api/hooks';
import { cn } from '../lib/cn';
import { buttonClass } from './ui';

// Guests are sent to log in; employers can't save jobs, so they don't see it.
export default function BookmarkButton({ job, saved = job.saved ?? false, className, withLabel = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toggle = useToggleSave();

  if (user?.role === 'employer') return null;

  const onClick = () => {
    if (!user) {
      toast('Log in to save jobs');
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    toggle.mutate({ id: job.id, saved });
  };

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={toggle.isPending}
        aria-pressed={saved}
        className={cn(buttonClass('outlineOnDark', 'md'), 'w-full', className)}
      >
        <Bookmark className={cn('size-5', saved && 'animate-pop')} fill={saved ? 'currentColor' : 'none'} aria-hidden />
        {saved ? 'Saved' : 'Save job'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
      className={cn('relative z-10 grid size-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-moon-deep hover:text-ink', saved && 'text-padpa hover:text-padpa', className)}
    >
      <Bookmark className={cn('size-5', saved && 'animate-pop')} fill={saved ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}
