import { useState } from 'react';
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
const SIZES = {
  md: 'size-12 rounded-xl text-base',
  lg: 'size-16 rounded-2xl text-xl',
  xl: 'size-24 rounded-3xl text-3xl',
};

// The company's logo, or its initials on a tint chosen from its name (the same company always looks the same).
export default function CompanyMark({ name, logoUrl, size = 'md' }) {
  const [failedUrl, setFailedUrl] = useState(null);

  if (logoUrl && failedUrl !== logoUrl) {
    return (
      <span aria-hidden className={cn('grid shrink-0 place-items-center overflow-hidden border border-line bg-white', SIZES[size])}>
        {/* decorative: the company name is always written next to it */}
        <img src={logoUrl} alt="" loading="lazy" onError={() => setFailedUrl(logoUrl)} className="size-full object-contain p-1.5" />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center font-semibold', TONES[hash(name) % TONES.length], SIZES[size])}>
      {initials(name)}
    </span>
  );
}
