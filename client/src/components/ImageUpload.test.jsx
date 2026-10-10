import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import ImageUpload, { imageProblem } from './ImageUpload';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// The real editor needs a canvas and image decoding, so it is tested on its own. Here it is a stand-in.
vi.mock('./PhotoEditor', () => ({
  default: ({ onSave, onCancel }) => (
    <div role="group" aria-label="editor stand-in">
      <button onClick={() => onSave(new Blob(['cropped'], { type: 'image/jpeg' })).catch(() => {})}>stand-in save</button>
      <button onClick={onCancel}>stand-in cancel</button>
    </div>
  ),
}));

const file = (name, type, size = 1000) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
// applyAccept: false, so the component's own checks are tested (a browser would filter by `accept` first)
const user = () => userEvent.setup({ applyAccept: false });

beforeEach(() => vi.clearAllMocks());

describe('imageProblem', () => {
  it('accepts PNG, JPEG and WebP within the size limit', () => {
    expect(imageProblem(file('a.png', 'image/png'))).toBeNull();
    expect(imageProblem(file('a.jpg', 'image/jpeg'))).toBeNull();
    expect(imageProblem(file('a.webp', 'image/webp'))).toBeNull();
    expect(imageProblem(file('photo.JPEG', ''))).toBeNull(); // some systems send no type
  });
  it('rejects other types and big files', () => {
    expect(imageProblem(file('a.svg', 'image/svg+xml'))).toMatch(/PNG, JPEG or WebP/);
    expect(imageProblem(file('a.gif', 'image/gif'))).toMatch(/PNG, JPEG or WebP/);
    expect(imageProblem(file('a.png', 'image/png', 6 * 1024 * 1024))).toMatch(/over 5 MB/);
  });
});

describe('<ImageUpload>', () => {
  it('opens the editor for a profile photo and uploads only what the editor produces', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<ImageUpload kind="avatar" name="Nimal Perera" onUpload={onUpload} onRemove={() => {}} />);
    await user().upload(screen.getByLabelText('Choose profile photo'), file('me.png', 'image/png'));

    expect(screen.getByRole('group', { name: 'editor stand-in' })).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled(); // nothing is sent before the user confirms the framing

    await user().click(screen.getByRole('button', { name: 'stand-in save' }));
    expect(onUpload).toHaveBeenCalledTimes(1);
    const sent = onUpload.mock.calls[0][0];
    expect(sent).toBeInstanceOf(File);
    expect(sent.type).toBe('image/jpeg');
    await waitFor(() => expect(screen.queryByRole('group', { name: 'editor stand-in' })).not.toBeInTheDocument());
  });

  it('cancelling the editor uploads nothing', async () => {
    const onUpload = vi.fn();
    render(<ImageUpload kind="avatar" name="Nimal" onUpload={onUpload} onRemove={() => {}} />);
    await user().upload(screen.getByLabelText('Choose profile photo'), file('me.png', 'image/png'));
    await user().click(screen.getByRole('button', { name: 'stand-in cancel' }));
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'editor stand-in' })).not.toBeInTheDocument();
  });

  it('keeps the editor open when the upload fails', async () => {
    const onUpload = vi.fn().mockRejectedValue(new Error('nope'));
    render(<ImageUpload kind="avatar" name="Nimal" onUpload={onUpload} onRemove={() => {}} />);
    await user().upload(screen.getByLabelText('Choose profile photo'), file('me.png', 'image/png'));
    await user().click(screen.getByRole('button', { name: 'stand-in save' }));
    expect(onUpload).toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'editor stand-in' })).toBeInTheDocument();
  });

  it('allows large originals for photos (they are cropped in the browser) but not huge ones', async () => {
    render(<ImageUpload kind="avatar" name="Nimal" onUpload={() => {}} onRemove={() => {}} />);
    const input = screen.getByLabelText('Choose profile photo');
    await user().upload(input, file('big.jpg', 'image/jpeg', 12 * 1024 * 1024));
    expect(screen.getByRole('group', { name: 'editor stand-in' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'stand-in cancel' }));
    await user().upload(input, file('huge.jpg', 'image/jpeg', 25 * 1024 * 1024));
    expect(screen.queryByRole('group', { name: 'editor stand-in' })).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/over 20 MB/));
  });

  it('uploads a logo directly, because logos keep their own shape', async () => {
    const onUpload = vi.fn();
    render(<ImageUpload kind="logo" name="Acme" onUpload={onUpload} onRemove={() => {}} />);
    const png = file('logo.png', 'image/png');
    await user().upload(screen.getByLabelText('Choose company logo'), png);
    expect(onUpload).toHaveBeenCalledWith(png);
    expect(screen.queryByRole('group', { name: 'editor stand-in' })).not.toBeInTheDocument();
  });

  it('refuses a wrong type or a big file and says why', async () => {
    const onUpload = vi.fn();
    render(<ImageUpload kind="logo" name="Acme" onUpload={onUpload} onRemove={() => {}} />);
    const input = screen.getByLabelText('Choose company logo');
    await user().upload(input, file('logo.svg', 'image/svg+xml'));
    await user().upload(input, file('logo.png', 'image/png', 9 * 1024 * 1024));
    expect(onUpload).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it('offers Remove only when there is a picture', async () => {
    const onRemove = vi.fn();
    const { rerender } = render(<ImageUpload kind="avatar" name="Nimal" onUpload={() => {}} onRemove={onRemove} />);
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    rerender(<ImageUpload kind="avatar" name="Nimal" imageUrl="/a.webp" onUpload={() => {}} onRemove={onRemove} />);
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('uses logo wording for companies', () => {
    render(<ImageUpload kind="logo" name="Acme" onUpload={() => {}} onRemove={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Company logo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload logo' })).toBeInTheDocument();
  });
});
