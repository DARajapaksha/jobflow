import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import JobDescription, { parseDescription } from './JobDescription';

const text = `Join our team.\n\nWhat you'll do\n- Build things\n- Test things\n\n- Loose item\n- Another`;

describe('parseDescription', () => {
  it('splits paragraphs, headed lists and plain lists', () => {
    expect(parseDescription(text)).toEqual([
      { type: 'paragraph', text: 'Join our team.' },
      { type: 'section', heading: "What you'll do", items: ['Build things', 'Test things'] },
      { type: 'list', items: ['Loose item', 'Another'] },
    ]);
  });

  it('keeps long lines as paragraphs, even above bullets', () => {
    const long = 'x'.repeat(80);
    expect(parseDescription(`${long}\n- a`)).toEqual([{ type: 'paragraph', text: `${long}\n- a` }]);
  });
});

describe('<JobDescription>', () => {
  it('renders headings and list items, and never interprets HTML', () => {
    render(<JobDescription text={`Intro <b>bold</b>\n\nTasks\n- One\n- Two`} />);
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Intro <b>bold</b>')).toBeInTheDocument();
  });
});
