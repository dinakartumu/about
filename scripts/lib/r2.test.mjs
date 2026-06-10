import { describe, it, expect } from 'vitest';
import { uploadIfMissing } from './r2.mjs';

const body = Buffer.from('hello'); // 5 bytes

const notFoundError = () =>
  Object.assign(new Error('Not Found'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });

/** Stub S3 client: `head` is the HEAD response, an Error to throw, or undefined for 404. */
function stubClient({ head } = {}) {
  const calls = { head: 0, put: 0, putInputs: [] };
  return {
    calls,
    send: async (cmd) => {
      const name = cmd.constructor.name;
      if (name === 'HeadObjectCommand') {
        calls.head += 1;
        if (head === undefined) throw notFoundError();
        if (head instanceof Error) throw head;
        return head;
      }
      if (name === 'PutObjectCommand') {
        calls.put += 1;
        calls.putInputs.push(cmd.input);
        return {};
      }
      throw new Error(`Unexpected command: ${name}`);
    },
  };
}

describe('uploadIfMissing', () => {
  it('uploads when the object is missing (HEAD 404/NotFound)', async () => {
    const client = stubClient();
    const result = await uploadIfMissing(client, 'photos', 'photos/x/a.jpg', body);
    expect(result).toBe('uploaded');
    expect(client.calls.put).toBe(1);
    expect(client.calls.putInputs[0]).toMatchObject({
      Bucket: 'photos',
      Key: 'photos/x/a.jpg',
      ContentType: 'image/jpeg',
    });
  });

  it('skips when the object exists with the same size', async () => {
    const client = stubClient({ head: { ContentLength: body.length } });
    const result = await uploadIfMissing(client, 'photos', 'photos/x/a.jpg', body);
    expect(result).toBe('skipped');
    expect(client.calls.put).toBe(0);
  });

  it('reports a mismatch when the object exists with a different size', async () => {
    const client = stubClient({ head: { ContentLength: body.length + 100 } });
    const result = await uploadIfMissing(client, 'photos', 'photos/x/a.jpg', body);
    expect(result).toBe('mismatch');
    expect(client.calls.put).toBe(0);
  });

  it('uploads unconditionally with force, even when the object exists', async () => {
    const client = stubClient({ head: { ContentLength: body.length + 100 } });
    const result = await uploadIfMissing(client, 'photos', 'photos/x/a.jpg', body, { force: true });
    expect(result).toBe('uploaded');
    expect(client.calls.put).toBe(1);
    expect(client.calls.head).toBe(0); // plain PUT, no existence check
  });

  it('rethrows non-404 HEAD errors', async () => {
    const denied = Object.assign(new Error('Access Denied'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    });
    const client = stubClient({ head: denied });
    await expect(uploadIfMissing(client, 'photos', 'photos/x/a.jpg', body)).rejects.toThrow('Access Denied');
    expect(client.calls.put).toBe(0);
  });
});
