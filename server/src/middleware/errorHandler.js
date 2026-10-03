import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// Every error leaves the API in one shape: { error: { code, message, details? } }
export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err); // e.g. a download failed midway: let Express close the connection
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Referenced resource does not exist' } });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Value violates a constraint' } });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed identifier' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
