import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const upload = multer({
  storage: multer.memoryStorage(), // small files (<= MAX_RESUME_MB) go straight to the storage driver
  limits: { fileSize: env.maxResumeMb * 1024 * 1024, files: 1, fields: 10 },
  defParamCharset: 'utf8', // browsers send filenames as UTF-8; the default (latin1) garbles e.g. Sinhala names
});

// Expects multipart/form-data with the file in the "resume" field. Turns multer errors into API errors.
export function uploadResume(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'FILE_TOO_LARGE', `Resume must be ${env.maxResumeMb} MB or smaller`));
      }
      return next(AppError.badRequest('Upload failed: attach one PDF in the "resume" field'));
    }
    next(err);
  });
}
