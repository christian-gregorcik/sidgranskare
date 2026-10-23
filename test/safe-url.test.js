import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePublicUrl, UnsafeUrlError } from '../src/safe-url.js';

const publicDns = async () => ['93.184.216.34'];
const loopbackDns = async () => ['127.0.0.1'];
const mixedDns = async () => ['93.184.216.34', '10.0.0.5'];

test('accepts an ordinary https address', async () => {
  const { url, addresses } = await resolvePublicUrl('https://example.com/page', {
    resolve: publicDns,
  });
  assert.equal(url.hostname, 'example.com');
  assert.deepEqual(addresses, ['93.184.216.34']);
});

test('rejects a name that resolves to loopback', async () => {
  await assert.rejects(
    resolvePublicUrl('https://localtest.me', { resolve: loopbackDns }),
    UnsafeUrlError,
  );
});

test('rejects when only one of several addresses is private', async () => {
  await assert.rejects(
    resolvePublicUrl('https://split-horizon.example', { resolve: mixedDns }),
    (error) => {
      assert.ok(error instanceof UnsafeUrlError);
      assert.match(error.message, /10\.0\.0\.5/);
      return true;
    },
  );
});

test('rejects schemes other than http and https', async () => {
  for (const input of ['file:///etc/passwd', 'ftp://example.com', 'gopher://example.com']) {
    await assert.rejects(resolvePublicUrl(input, { resolve: publicDns }), UnsafeUrlError);
  }
});

test('rejects credentials in the URL', async () => {
  await assert.rejects(
    resolvePublicUrl('https://user:pass@example.com', { resolve: publicDns }),
    /Credentials/,
  );
});

test('rejects text that is not a URL', async () => {
  await assert.rejects(resolvePublicUrl('not a url', { resolve: publicDns }), UnsafeUrlError);
});

test('rejects a name that does not resolve', async () => {
  const empty = async () => [];
  await assert.rejects(resolvePublicUrl('https://example.com', { resolve: empty }), /resolve/);
});

test('rejects when the resolver itself fails', async () => {
  const broken = async () => {
    throw new Error('ENOTFOUND');
  };
  await assert.rejects(resolvePublicUrl('https://example.com', { resolve: broken }), UnsafeUrlError);
});

test('blocks the cloud metadata address', async () => {
  const metadata = async () => ['169.254.169.254'];
  await assert.rejects(resolvePublicUrl('http://metadata.internal', { resolve: metadata }), UnsafeUrlError);
});
