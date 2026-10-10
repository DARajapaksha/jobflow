import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyState, buttonClass } from './ui';

// Shown when the whole board has no jobs (not when a search or filter simply matched nothing).
export default function EmptyBoard() {
  const { user } = useAuth();
  const isEmployer = user?.role === 'employer';
  const isSeeker = user?.role === 'seeker';

  return (
    <EmptyState
      title="No jobs have been posted yet"
      action={
        isEmployer ? (
          <Link to="/employer/jobs/new" className={buttonClass('primary')}>Post a job</Link>
        ) : isSeeker ? null : (
          <Link to="/register?role=employer" className={buttonClass('primary')}>Create an employer account</Link>
        )
      }
    >
      {isSeeker
        ? 'Employers haven’t posted anything yet. Check back soon, or save the Companies page to see who joins.'
        : 'Be the first: create an employer account and post a listing. It appears here straight away.'}
    </EmptyState>
  );
}
