import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoEditor from './PhotoEditor';
import { cropToBlob, prepareImage } from '../lib/cropImage';

// The cropper needs real layout and the crop helpers need a canvas; both are replaced so the editor's own logic is tested.
vi.mock('react-easy-crop', () => ({
  default: ({ zoom, rotation, onCropComplete }) => (
    <div data-testid="cropper" data-zoom={zoom} data-rotation={rotation}>
      <button onClick={() => onCropComplete({ x: 0, y: 0 }, { x: 10, y: 20, width: 100, height: 100 })}>report crop</button>
    </div>
  ),
}));
vi.mock('react-easy-crop/react-easy-crop.css', () => ({}));
vi.mock('../lib/cropImage', () => ({
  prepareImage: vi.fn(),
  cropToBlob: vi.fn(),
}));

const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
const revoke = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  prepareImage.mockResolvedValue({ url: 'blob:preview', revoke });
  cropToBlob.mockResolvedValue(new Blob(['cropped'], { type: 'image/jpeg' }));
});

async function open(props = {}) {
  const onSave = props.onSave ?? vi.fn().mockResolvedValue(undefined);
  const onCancel = props.onCancel ?? vi.fn();
  const utils = render(<PhotoEditor file={file} onSave={onSave} onCancel={onCancel} />);
  await screen.findByTestId('cropper');
  return { onSave, onCancel, ...utils };
}

describe('<PhotoEditor>', () => {
  it('opens the chosen file and shows the controls', async () => {
    await open();
    expect(prepareImage).toHaveBeenCalledWith(file);
    expect(screen.getByLabelText('Zoom')).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Rotate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeDisabled(); // nothing to save until the cropper has reported a crop
  });

  it('passes zoom and quarter-turn rotation to the cropper, wrapping after a full turn', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2.5' } });
    expect(screen.getByTestId('cropper')).toHaveAttribute('data-zoom', '2.5');

    const rotate = screen.getByRole('button', { name: 'Rotate' });
    const turns = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.click(rotate);
      turns.push(screen.getByTestId('cropper').getAttribute('data-rotation'));
    }
    expect(turns).toEqual(['90', '180', '270', '0']);
  });

  it('saves the framed area with the chosen rotation and hands the picture to onSave', async () => {
    const { onSave } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Rotate' }));
    await userEvent.click(screen.getByRole('button', { name: 'report crop' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save photo' }));

    expect(cropToBlob).toHaveBeenCalledWith('blob:preview', { x: 10, y: 20, width: 100, height: 100 }, 90);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('shows the error and stays open when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue({ response: { data: { error: { message: 'Use a PNG, JPEG or WebP image' } } } });
    await open({ onSave });
    await userEvent.click(screen.getByRole('button', { name: 'report crop' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save photo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a PNG, JPEG or WebP image');
    expect(screen.getByRole('button', { name: 'Save photo' })).toBeEnabled(); // can try again
  });

  it('cancel calls onCancel without saving, and the preview is released on close', async () => {
    const { onSave, onCancel, unmount } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(revoke).toHaveBeenCalled();
  });

  it('explains when the file cannot be opened', async () => {
    prepareImage.mockRejectedValue(new Error('That image could not be opened. Try another file.'));
    render(<PhotoEditor file={file} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be opened');
    expect(screen.queryByTestId('cropper')).not.toBeInTheDocument();
  });
});
