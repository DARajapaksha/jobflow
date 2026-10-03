import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '../utils/AppError.js';

// Production driver for any S3-compatible bucket. The bucket must stay private:
// files are only ever served through the API after an access check.
export function createS3Driver({ client, bucket }) {
  return {
    async put(key, buffer, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    },
    async get(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return out.Body; // a Node.js Readable stream
      } catch (err) {
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) throw AppError.notFound('File not found');
        throw err;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

export function createS3ClientFromEnv(env) {
  return new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint || undefined,
    forcePathStyle: env.s3ForcePathStyle,
    credentials: env.s3AccessKeyId
      ? { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey }
      : undefined,
  });
}
