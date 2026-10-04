import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicantRow from './ApplicantRow';

const base = {
  id: 'a1',
  status: 'submitted',
  appliedAt: '2026-10-01T10:00:00Z',
  coverLetter: 'I love this role.',
  resume: { filename: 'cv.pdf' },
  applicant: { id: 'u1', fullName: 'Nimal Perera', email: 'nimal@example.com', headline: 'Junior developer', location: 'Kandy', skills: ['React', 'SQL'] },
};
const renderRow = (over = {}, props = {}) =>
  render(<ul><ApplicantRow application={{ ...base, ...over }} onStatus={() => {}} {...props} /></ul>);

describe('<ApplicantRow>', () => {
  it('shows who applied, their resume and cover letter', () => {
    renderRow();
    expect(screen.getByRole('heading', { name: 'Nimal Perera' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nimal@example.com' })).toHaveAttribute('href', 'mailto:nimal@example.com');
    expect(screen.getByRole('link', { name: 'cv.pdf' })).toHaveAttribute('href', '/api/applications/a1/resume');
    expect(screen.getByText('Read cover letter')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('offers only the next valid steps and reports the choice', async () => {
    const onStatus = vi.fn();
    renderRow({}, { onStatus });
    expect(screen.queryByRole('button', { name: 'Hire' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
    expect(onStatus).toHaveBeenCalledWith('reviewed');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onStatus).toHaveBeenCalledWith('rejected');
  });

  it('has no actions for final statuses', () => {
    renderRow({ status: 'hired' });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Hired')).toBeInTheDocument();
  });

  it('disables the actions while a change is being saved', () => {
    renderRow({ status: 'reviewed' }, { pending: true });
    expect(screen.getByRole('button', { name: 'Shortlist' })).toBeDisabled();
  });
});
