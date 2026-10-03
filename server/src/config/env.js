import 'dotenv/config';

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  storageDriver: process.env.STORAGE_DRIVER ?? 'local',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxResumeMb: Number(process.env.MAX_RESUME_MB ?? 5),
  // Only used when STORAGE_DRIVER=s3 (AWS S3, Cloudflare R2, Supabase Storage, MinIO, ...)
  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION ?? 'auto',
  s3Endpoint: process.env.S3_ENDPOINT,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
};
