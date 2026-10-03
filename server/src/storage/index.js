import { env } from '../config/env.js';
import { createLocalDriver } from './localDriver.js';

let instance;

// Returns the configured driver: { put(key, buffer, contentType), get(key) -> stream, delete(key) }
export async function getStorage() {
  if (instance) return instance;
  if (env.storageDriver === 's3') {
    if (!env.s3Bucket) throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET');
    const { createS3Driver, createS3ClientFromEnv } = await import('./s3Driver.js'); // loaded only when needed
    instance = createS3Driver({ client: createS3ClientFromEnv(env), bucket: env.s3Bucket });
  } else if (env.storageDriver === 'local') {
    instance = createLocalDriver(env.uploadDir);
  } else {
    throw new Error(`Unknown STORAGE_DRIVER "${env.storageDriver}"`);
  }
  return instance;
}
