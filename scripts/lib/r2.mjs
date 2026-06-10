import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export function r2Client({ accountId, accessKeyId, secretAccessKey }) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/** Upload body to bucket/key unless it already exists. Returns 'uploaded' or 'skipped'. */
export async function uploadIfMissing(client, bucket, key, body) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return 'skipped';
  } catch (err) {
    if (err.$metadata?.httpStatusCode !== 404 && err.name !== 'NotFound') throw err;
  }
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/jpeg' })
  );
  return 'uploaded';
}
