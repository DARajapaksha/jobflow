import { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { RotateCw } from 'lucide-react';
import { Button, Spinner } from './ui';
import { cropToBlob, prepareImage } from '../lib/cropImage';

// Lets the user frame their photo before it is saved: drag to move, slide or pinch to zoom, rotate in quarter turns.
// `onSave(blob)` should upload the picture; if it throws, the message is shown here and the editor stays open.
export default function PhotoEditor({ file, onCancel, onSave }) {
  const [source, setSource] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [ready, setReady] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let opened;
    prepareImage(file)
      .then((s) => {
        if (!active) return s.revoke();
        opened = s;
        setSource(s);
      })
      .catch((err) => active && setLoadError(err.message));
    return () => {
      active = false;
      opened?.revoke();
    };
  }, [file]);

  // The editor sits in a dialog that is only shown after this component mounts; measuring a hidden box gives zero.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(await cropToBlob(source.url, area, rotation));
    } catch (err) {
      setError(err.response?.data?.error?.message ?? err.message ?? 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div>
        <p role="alert" className="rounded-lg bg-ruby-tint px-3.5 py-2.5 text-sm text-ruby">{loadError}</p>
        <div className="mt-5 flex justify-end"><Button variant="secondary" onClick={onCancel}>Close</Button></div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-72 w-full overflow-hidden rounded-xl bg-ink">
        {source && ready ? (
          <Cropper
            image={source.url}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            keyboardStep={5}
            disableAutomaticStylesInjection
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        ) : (
          <div className="grid h-full place-items-center text-white"><Spinner label="Opening your photo" /></div>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-soft">Drag the photo to move it. Use the slider, or pinch, to zoom.</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <label htmlFor="photo-zoom" className="text-sm font-medium">Zoom</label>
          <input
            id="photo-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-2 flex-1 accent-sapphire"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>
          <RotateCw className="size-4" aria-hidden />Rotate
        </Button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-ruby-tint px-3.5 py-2.5 text-sm text-ruby">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={save} loading={saving} disabled={!area}>Save photo</Button>
      </div>
    </div>
  );
}
