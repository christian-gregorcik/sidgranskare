import { lookup } from 'node:dns/promises';

import { isPrivateAddress } from './addresses.js';

export class UnsafeUrlError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/** @param {string} hostname */
async function resolveAll(hostname) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

/**
 * Parses a URL and confirms every address it resolves to is on the public
 * internet.
 *
 * Rejects if any address is private rather than if all of them are. A name
 * that resolves to one public and one private address is a known way to slip
 * past a check that only looks at the first record.
 *
 * @param {string} input
 * @param {{ resolve?: (hostname: string) => Promise<string[]> }} [options]
 * @returns {Promise<{ url: URL, addresses: string[] }>}
 */
export async function resolvePublicUrl(input, options = {}) {
  const resolve = options.resolve ?? resolveAll;

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError(`Not a URL: ${input}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Only http and https are allowed, got ${url.protocol}`);
  }

  if (url.username !== '' || url.password !== '') {
    throw new UnsafeUrlError('Credentials in the URL are not allowed.');
  }

  let addresses;
  try {
    addresses = await resolve(url.hostname);
  } catch (cause) {
    throw new UnsafeUrlError(`${url.hostname} does not resolve.`, { cause });
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError(`${url.hostname} does not resolve.`);
  }

  const blocked = addresses.filter(isPrivateAddress);
  if (blocked.length > 0) {
    throw new UnsafeUrlError(`${url.hostname} resolves to a non-public address: ${blocked[0]}`);
  }

  return { url, addresses };
}
