import { describe, expect, it } from 'vitest';
import { formatSalary, initials, safeNext, timeAgo } from './format';

describe('formatSalary', () => {
  it('formats ranges, one-sided ranges and missing salaries', () => {
    expect(formatSalary(150000, 250000)).toBe('LKR 150k–250k');
    expect(formatSalary(125000, 125000)).toBe('LKR 125k');
    expect(formatSalary(150000, null)).toBe('From LKR 150k');
    expect(formatSalary(null, 90000)).toBe('Up to LKR 90k');
    expect(formatSalary(null, null)).toBeNull();
    expect(formatSalary(1_500_000, 2_000_000)).toBe('LKR 1.5M–2M');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-04T12:00:00Z').getTime();
  const ago = (days) => new Date(now - days * 86_400_000).toISOString();
  it('uses friendly units', () => {
    expect(timeAgo(ago(0), now)).toBe('Today');
    expect(timeAgo(ago(1), now)).toBe('Yesterday');
    expect(timeAgo(ago(5), now)).toBe('5 days ago');
    expect(timeAgo(ago(14), now)).toBe('2 weeks ago');
    expect(timeAgo(ago(45), now)).toBe('6 weeks ago');
    expect(timeAgo(ago(65), now)).toBe('2 months ago');
  });
});

describe('initials', () => {
  it('takes up to two initials', () => {
    expect(initials('Acme Technologies Ltd')).toBe('AT');
    expect(initials('lanka')).toBe('L');
    expect(initials('')).toBe('?');
  });
});

describe('safeNext', () => {
  it('only allows same-site paths', () => {
    expect(safeNext('/jobs/1?x=2')).toBe('/jobs/1?x=2');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
