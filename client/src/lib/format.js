const short = (n) => {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
};

// "LKR 150k–250k", "From LKR 150k", "Up to LKR 250k", or null when the employer gave no range.
export function formatSalary(min, max) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `LKR ${short(min)}` : `LKR ${short(min)}–${short(max)}`;
  return min != null ? `From LKR ${short(min)}` : `Up to LKR ${short(max)}`;
}

const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

export function timeAgo(date, now = Date.now()) {
  const days = Math.floor((now - new Date(date).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.floor(days / 7), 'week');
  return plural(Math.floor(days / 30), 'month');
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDate = (date) => dateFmt.format(new Date(date));

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

// Only allow same-site redirects after login (blocks "//evil.com" and absolute URLs).
export const safeNext = (next) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null);
