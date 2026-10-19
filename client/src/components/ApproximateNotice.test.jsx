import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ApproximateNotice from './ApproximateNotice';

describe('<ApproximateNotice>', () => {
  it('names the search and says the results are the closest ones', () => {
    render(<ApproximateNotice query="foll stack" />);
    expect(screen.getByRole('status')).toHaveTextContent('No exact matches for “foll stack”. Showing the closest jobs instead.');
  });
});
