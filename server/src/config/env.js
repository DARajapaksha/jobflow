import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

// Fail at startup, not at the first login, if production is configured unsafely.
if (nodeEnv === 'production') {
  const secret = process.env.JWT_SECRET;
  if (secret.length < 32 || /^(change-?me|secret|password)/i.test(secret)) {
    throw new Error('JWT_SECRET must be a random string of at least 32 characters in production');
  }
  if ((process.env.STORAGE_DRIVER ?? 'local') === 'local') {
    console.warn('WARNING: STORAGE_DRIVER=local in production. Files are lost when the host restarts. Use STORAGE_DRIVER=s3.');
  }
}

// DATABASE_SSL: "true" verifies the server certificate (use for Neon and most hosts); "no-verify" accepts self-signed ones.
// When unset, the connection string decides (e.g. ?sslmode=require).
const sslSetting = { true: true, 'no-verify': { rejectUnauthorized: false } }[process.env.DATABASE_SSL];

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: sslSetting,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  // Production: one service serves the built React app and the API, so the browser only ever talks to one origin.
  serveClient: process.env.SERVE_CLIENT === 'true',
  clientDist: process.env.CLIENT_DIST ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../client/dist'),
  trustProxy: Number(process.env.TRUST_PROXY ?? 1), // number of reverse proxies in front of the app
  storageDriver: process.env.STORAGE_DRIVER ?? 'local',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxResumeMb: Number(process.env.MAX_RESUME_MB ?? 5),
  maxImageMb: Number(process.env.MAX_IMAGE_MB ?? 5),
  // Only used when STORAGE_DRIVER=s3 (AWS S3, Cloudflare R2, Supabase Storage, MinIO, ...)
  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION ?? 'auto',
  s3Endpoint: process.env.S3_ENDPOINT,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
};
