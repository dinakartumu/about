import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export function r2Client({ accountId, accessKeyId, secretAccessKey }) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Upload body to bucket/key unless it already exists with the same size.
 * Returns 'uploaded', 'skipped' (exists, same size), or 'mismatch' (exists but
 * the remote size differs from the local body — likely a re-exported edit).
 * Pass { force: true } to skip the existence check and PUT unconditionally.
 */
export async function uploadIfMissing(client, bucket, key, body, { force = false } = {}) {
  if (!force) {
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return head.ContentLength === body.length ? 'skipped' : 'mismatch';
    } catch (err) {
      if (err.$metadata?.httpStatusCode !== 404 && err.name !== 'NotFound') throw err;
    }
  }
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/jpeg' })
  );
  return 'uploaded';
}
