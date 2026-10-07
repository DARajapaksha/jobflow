import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CompanyMark from './CompanyMark';
import Avatar from './Avatar';

describe('<CompanyMark>', () => {
  it('shows initials when there is no logo', () => {
    render(<CompanyMark name="Acme Technologies" />);
    expect(screen.getByText('AT')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows the logo as a decorative image when there is one', () => {
    const { container } = render(<CompanyMark name="Acme Technologies" logoUrl="/api/companies/1/logo?v=abc" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/companies/1/logo?v=abc');
    expect(img).toHaveAttribute('alt', '');
    expect(screen.queryByText('AT')).not.toBeInTheDocument();
  });

  it('falls back to initials if the image fails to load', () => {
    const { container } = render(<CompanyMark name="Acme Technologies" logoUrl="/broken.webp" />);
    fireEvent.error(container.querySelector('img'));
    expect(screen.getByText('AT')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('tries a new logo again after the old one failed', () => {
    const { container, rerender } = render(<CompanyMark name="Acme" logoUrl="/broken.webp" />);
    fireEvent.error(container.querySelector('img'));
    rerender(<CompanyMark name="Acme" logoUrl="/fixed.webp" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/fixed.webp');
  });
});

describe('<Avatar>', () => {
  it('shows the photo, or initials when missing or broken', () => {
    const { container, rerender } = render(<Avatar name="Nimal Perera" src="/a.webp" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/a.webp');
    fireEvent.error(container.querySelector('img'));
    expect(screen.getByText('NP')).toBeInTheDocument();
    rerender(<Avatar name="Nimal Perera" />);
    expect(screen.getByText('NP')).toBeInTheDocument();
  });
});
