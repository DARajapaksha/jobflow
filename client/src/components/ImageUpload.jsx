import { useRef, useState } from 'react';
import { toast } from 'sonner';
import Avatar from './Avatar';
import CompanyMark from './CompanyMark';
import PhotoEditor from './PhotoEditor';
import { Button, Modal } from './ui';
import { MAX_IMAGE_MB, MAX_PHOTO_ORIGINAL_MB } from '../lib/constants';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const COPY = {
  avatar: {
    title: 'Profile photo',
    hint: `PNG, JPEG or WebP, up to ${MAX_PHOTO_ORIGINAL_MB} MB. You choose how it is framed before saving. Employers you apply to can see it.`,
    add: 'Upload photo',
    change: 'Change photo',
  },
  logo: {
    title: 'Company logo',
    hint: `PNG, JPEG or WebP, up to ${MAX_IMAGE_MB} MB. It appears next to every listing. A square image with a transparent background works best.`,
    add: 'Upload logo',
    change: 'Change logo',
  },
};

export function imageProblem(file, maxMb = MAX_IMAGE_MB) {
  if (!TYPES.includes(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) return 'Use a PNG, JPEG or WebP image.';
  if (file.size > maxMb * 1024 * 1024) return `That image is over ${maxMb} MB. Choose a smaller one.`;
  return null;
}

// Preview, upload and remove for a profile picture. The page decides what uploading does.
export default function ImageUpload({ kind, name, imageUrl, onUpload, onRemove, uploading = false, removing = false }) {
  const input = useRef(null);
  const copy = COPY[kind];
  const [editing, setEditing] = useState(null); // the chosen file while the photo editor is open

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still fires
    if (!file) return;
    // Profile photos are framed in the editor first; logos keep their own shape and upload directly.
    const problem = imageProblem(file, kind === 'avatar' ? MAX_PHOTO_ORIGINAL_MB : MAX_IMAGE_MB);
    if (problem) return toast.error(problem);
    if (kind === 'avatar') setEditing(file);
    else onUpload(file);
  };

  const saveEdited = async (blob) => {
    await onUpload(new File([blob], 'photo.jpg', { type: 'image/jpeg' })); // rejects on failure, which keeps the editor open
    setEditing(null);
  };

  return (
    <section aria-label={copy.title} className="flex flex-col gap-5 sm:flex-row sm:items-center">
      {kind === 'logo' ? <CompanyMark name={name} logoUrl={imageUrl} size="xl" /> : <Avatar name={name} src={imageUrl} size="xl" />}
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="mt-1 max-w-md text-sm text-ink-soft">{copy.hint}</p>
        <input ref={input} type="file" accept={TYPES.join(',')} onChange={onFile} className="sr-only" aria-label={`Choose ${copy.title.toLowerCase()}`} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={uploading} disabled={removing} onClick={() => input.current?.click()}>
            {imageUrl ? copy.change : copy.add}
          </Button>
          {imageUrl && (
            <Button size="sm" variant="ghost" loading={removing} disabled={uploading} onClick={onRemove}>Remove</Button>
          )}
        </div>
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Adjust your photo">
        {editing && <PhotoEditor file={editing} onCancel={() => setEditing(null)} onSave={saveEdited} />}
      </Modal>
    </section>
  );
}
