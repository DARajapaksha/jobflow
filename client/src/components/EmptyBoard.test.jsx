import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmptyBoard from './EmptyBoard';
import { AuthContext } from '../context/AuthContext';

const renderAs = (user) =>
  render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter><EmptyBoard /></MemoryRouter>
    </AuthContext.Provider>,
  );

describe('<EmptyBoard>', () => {
  it('invites a guest to create an employer account', () => {
    renderAs(null);
    expect(screen.getByRole('heading', { name: 'No jobs have been posted yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an employer account' })).toHaveAttribute('href', '/register?role=employer');
  });

  it('lets an employer post the first job', () => {
    renderAs({ role: 'employer' });
    expect(screen.getByRole('link', { name: 'Post a job' })).toHaveAttribute('href', '/employer/jobs/new');
  });

  it('tells a job seeker to check back, without a misleading button', () => {
    renderAs({ role: 'seeker' });
    expect(screen.getByText(/Check back soon/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
