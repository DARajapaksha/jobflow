import { useState } from 'react';
import { cn } from '../lib/cn';
import { initials } from '../lib/format';

const SIZES = { sm: 'size-8 text-sm', md: 'size-12 text-base', xl: 'size-24 text-3xl' };

// A person's photo, or their initials. `fit="contain"` is for logos shown in a circle (e.g. an employer in the menu).
export default function Avatar({ name, src, size = 'md', solid = false, fit = 'cover', className }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const base = cn('grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold', SIZES[size], className);

  if (src && failedSrc !== src) {
    return (
      <span aria-hidden className={cn(base, fit === 'contain' && 'border border-line bg-white')}>
        <img src={src} alt="" onError={() => setFailedSrc(src)} className={cn('size-full', fit === 'contain' ? 'object-contain p-1' : 'object-cover')} />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(base, solid ? 'bg-sapphire text-white' : 'bg-sapphire-tint text-sapphire-deep')}>
      {initials(name)}
    </span>
  );
}
