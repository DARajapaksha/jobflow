import { cn } from '../lib/cn';
import { initials } from '../lib/format';

const TONES = [
  'bg-sapphire-tint text-sapphire',
  'bg-tea-tint text-tea',
  'bg-amethyst-tint text-amethyst',
  'bg-citrine-tint text-citrine',
  'bg-ruby-tint text-ruby',
];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Stand-in for a logo: the company's initials on a tint chosen from its name, so the same company always looks the same.
export default function CompanyMark({ name, size = 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center font-semibold',
        TONES[hash(name) % TONES.length],
        size === 'lg' ? 'size-16 rounded-2xl text-xl' : 'size-12 rounded-xl text-base',
      )}
    >
      {initials(name)}
    </span>
  );
}
