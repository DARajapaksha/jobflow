import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// One file in memory (small, size-limited) that goes straight to the storage layer. Turns multer errors into API errors.
function singleUpload(field, maxMb, { tooLarge, other }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1, fields: 10 },
    defParamCharset: 'utf8', // browsers send filenames as UTF-8; the default (latin1) garbles e.g. Sinhala names
  });
  return (req, res, next) =>
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'FILE_TOO_LARGE', tooLarge));
        return next(AppError.badRequest(other));
      }
      next(err);
    });
}

// multipart/form-data with the PDF in the "resume" field
export const uploadResume = singleUpload('resume', env.maxResumeMb, {
  tooLarge: `Resume must be ${env.maxResumeMb} MB or smaller`,
  other: 'Upload failed: attach one PDF in the "resume" field',
});

// multipart/form-data with the picture in the "image" field
export const uploadImage = singleUpload('image', env.maxImageMb, {
  tooLarge: `Image must be ${env.maxImageMb} MB or smaller`,
  other: 'Upload failed: attach one image in the "image" field',
});
