import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobRow from './JobRow';

const job = {
  id: 'abc',
  title: 'Frontend Developer',
  location: 'Colombo',
  jobType: 'full_time',
  workMode: 'hybrid',
  salaryMin: 150000,
  salaryMax: 250000,
  createdAt: new Date().toISOString(),
  category: { id: 1, name: 'Software Engineering' },
  company: { id: 'c1', name: 'Acme Technologies' },
};
const renderRow = (props) => render(<MemoryRouter><ul><JobRow job={job} {...props} /></ul></MemoryRouter>);

describe('<JobRow>', () => {
  it('shows the key facts and links to the job', () => {
    renderRow();
    expect(screen.getByRole('link', { name: 'Frontend Developer' })).toHaveAttribute('href', '/jobs/abc');
    expect(screen.getByText('Acme Technologies')).toBeInTheDocument();
    expect(screen.getByText('Colombo')).toBeInTheDocument();
    expect(screen.getByText('LKR 150k–250k')).toBeInTheDocument();
    expect(screen.getByText('Full-time')).toBeInTheDocument();
    expect(screen.getByText('Hybrid')).toBeInTheDocument();
    expect(screen.getByText('Software Engineering')).toBeInTheDocument();
  });

  it('renders the action slot', () => {
    renderRow({ action: <button>Save</button> });
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows the work mode once for remote jobs, and hides a missing salary', () => {
    render(<MemoryRouter><ul><JobRow job={{ ...job, location: 'Remote', workMode: 'remote', salaryMin: null, salaryMax: null }} /></ul></MemoryRouter>);
    expect(screen.getAllByText('Remote')).toHaveLength(1);
    expect(screen.queryByText(/LKR/)).not.toBeInTheDocument();
  });

  it('is not a link when the job is no longer open', () => {
    renderRow({ unavailable: true });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('No longer open')).toBeInTheDocument();
  });
});
