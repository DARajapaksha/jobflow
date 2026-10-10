import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import meRoutes from './routes/meRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import userRoutes from './routes/userRoutes.js';

export const app = express();

app.set('trust proxy', env.trustProxy); // behind Render's proxy in production
app.use(
  helmet({
    contentSecurityPolicy: {
      // Defaults (same-origin scripts, styles, images, fonts and API calls) are exactly what the app needs.
      // upgrade-insecure-requests is dropped: it breaks plain-http localhost testing and nothing here loads over http.
      // blob: images are pictures the browser itself made from a file the user chose (the photo editor preview).
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'blob:'],
        'upgrade-insecure-requests': null,
      },
    },
  }),
);
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

// Health checks come before the rate limiter, so a monitor can never get locked out.
// Liveness never touches the database: a free serverless database must be allowed to sleep.
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health/ready', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'up' });
});

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', authRoutes);
app.use('/api', jobRoutes);
app.use('/api/me', meRoutes);
app.use('/api', applicationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);

if (env.serveClient) {
  const indexFile = path.join(env.clientDist, 'index.html');
  if (!fs.existsSync(indexFile)) throw new Error(`SERVE_CLIENT is on but ${indexFile} does not exist. Build the client first (cd client && npm run build).`);

  // Vite file names include a content hash, so /assets can be cached forever; everything else is revalidated.
  app.use(
    express.static(env.clientDist, {
      index: false,
      setHeaders: (res, file) =>
        res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'),
    }),
  );
  // React Router handles every other path in the browser, so deep links and refreshes must return the app shell.
  app.get(/^(?!\/api(\/|$)).*/, (_req, res) => res.sendFile(indexFile, { headers: { 'Cache-Control': 'no-cache' } }));
}

app.use(notFound);
app.use(errorHandler);
