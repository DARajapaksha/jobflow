const MAX_SIDE = 2048; // larger photos are scaled down first; some phones refuse to draw very big canvases

export const rotatedSize = (width, height, degrees) =>
  Math.abs(degrees) % 180 === 90 ? { width: height, height: width } : { width, height };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be opened. Try another file.'));
    img.src = src;
  });
}

const toBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be prepared. Try another file.'))), type, quality));

// Opens the chosen file for the editor. Browsers apply a photo's rotation metadata when they draw it, so phone photos
// come out the right way up. Returns { url, revoke }.
export async function prepareImage(file) {
  const original = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(original);
  } catch (err) {
    URL.revokeObjectURL(original);
    throw err;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return { url: original, revoke: () => URL.revokeObjectURL(original) };

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(original);
  const small = URL.createObjectURL(await toBlob(canvas, 'image/jpeg', 0.92));
  return { url: small, revoke: () => URL.revokeObjectURL(small) };
}

// Produces the square picture the user framed. `area` is the crop rectangle in pixels of the (unrotated) image, as
// reported by the cropper; `rotation` is 0, 90, 180 or 270 degrees clockwise.
export async function cropToBlob(src, area, rotation = 0, size = 512) {
  const image = await loadImage(src);
  const { width: boxW, height: boxH } = rotatedSize(image.width, image.height, rotation);

  const rotated = document.createElement('canvas');
  rotated.width = boxW;
  rotated.height = boxH;
  const rctx = rotated.getContext('2d');
  rctx.translate(boxW / 2, boxH / 2);
  rctx.rotate((rotation * Math.PI) / 180);
  rctx.translate(-image.width / 2, -image.height / 2);
  rctx.drawImage(image, 0, 0);

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff'; // JPEG has no transparency
  octx.fillRect(0, 0, size, size);
  octx.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return toBlob(out, 'image/jpeg', 0.92);
}
