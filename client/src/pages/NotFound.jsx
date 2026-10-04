import { Link } from 'react-router-dom';
import { Container, EmptyState, buttonClass } from '../components/ui';
import { usePageTitle } from '../lib/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <Container className="py-20">
      <EmptyState title="That page doesn’t exist" action={<Link to="/" className={buttonClass('primary')}>Browse jobs</Link>}>
        The link may be out of date, or the address may have a typo.
      </EmptyState>
    </Container>
  );
}
