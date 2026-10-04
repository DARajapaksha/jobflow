import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusRail from './StatusRail';

describe('<StatusRail>', () => {
  it('marks the current stage and describes it for screen readers', () => {
    render(<StatusRail status="reviewed" />);
    expect(screen.getByRole('list', { name: 'Application status: Reviewed' })).toBeInTheDocument();
    const current = screen.getAllByRole('listitem').filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Reviewed');
  });

  it('shows a plain message for rejected applications', () => {
    render(<StatusRail status="rejected" />);
    expect(screen.getByText('Not selected for this role')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
