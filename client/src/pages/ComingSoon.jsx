import { Link } from 'react-router-dom';
import { Container, EmptyState, buttonClass } from '../components/ui';
import { usePageTitle } from '../lib/usePageTitle';

export default function ComingSoon({ title = 'Employer dashboard' }) {
  usePageTitle(title);
  return (
    <Container className="py-16">
      <EmptyState title={`${title} isn’t built yet`} action={<Link to="/" className={buttonClass('primary')}>Browse jobs</Link>}>
        Employer tools (post a job, review applicants) are the next part of Jobflow.
      </EmptyState>
    </Container>
  );
}
