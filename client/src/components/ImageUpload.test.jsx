import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import ImageUpload, { imageProblem } from './ImageUpload';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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
  it('uploads a valid image', async () => {
    const onUpload = vi.fn();
    render(<ImageUpload kind="avatar" name="Nimal Perera" onUpload={onUpload} onRemove={() => {}} />);
    const png = file('me.png', 'image/png');
    await user().upload(screen.getByLabelText('Choose profile photo'), png);
    expect(onUpload).toHaveBeenCalledWith(png);
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
