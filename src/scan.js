import { isPrivateAddress } from './addresses.js';
import { MEASURE_SOURCE } from './measure.js';
import { findings } from './rules.js';
import { resolvePublicUrl, UnsafeUrlError } from './safe-url.js';

/**
 * Visits one page and reports what is wrong with it.
 *
 * The caller supplies the browser. This package never launches one, so it adds
 * no dependency and works with whatever Playwright build the caller already
 * has.
 *
 * @param {string} target
 * @param {{
 *   browser: { newPage(): Promise<any> },
 *   timeoutMs?: number,
 *   floor?: number,
 *   rules?: import('./rules.js').Rule[],
 *   resolve?: (hostname: string) => Promise<string[]>,
 * }} options
 */
export async function scan(target, options) {
  const { url } = await resolvePublicUrl(target, { resolve: options.resolve });
  const timeout = options.timeoutMs ?? 20000;

  const page = await options.browser.newPage();
  try {
    await guardRequests(page);
    await page.goto(url.href, { waitUntil: 'load', timeout });

    // Images that are still in flight make the broken-image count meaningless.
    // A short settle is cheaper than a wrong finding.
    await page.waitForTimeout(1500);

    const measurement = await page.evaluate(MEASURE_SOURCE);
    return {
      url: url.href,
      measurement,
      findings: findings(measurement, { floor: options.floor, rules: options.rules }),
    };
  } finally {
    await page.close();
  }
}

/**
 * Blocks any request that leaves for a non-public address.
 *
 * Checking the address before navigating is not enough on its own. A redirect,
 * an iframe or a script can point anywhere, and the first check never sees it.
 * The guard runs on every request the page makes.
 *
 * @param {any} page
 */
async function guardRequests(page) {
  if (typeof page.route !== 'function') {
    return;
  }

  await page.route('**/*', async (route, request) => {
    let hostname;
    try {
      hostname = new URL(request.url()).hostname;
    } catch {
      await route.abort('blockedbyclient');
      return;
    }

    // A bare address needs no lookup, and is the common way this is attacked.
    if (isAddressLiteral(hostname) && isPrivateAddress(stripBrackets(hostname))) {
      await route.abort('blockedbyclient');
      return;
    }

    try {
      await resolvePublicUrl(request.url());
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        await route.abort('blockedbyclient');
        return;
      }
      throw error;
    }

    await route.continue();
  });
}

function stripBrackets(hostname) {
  return hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
}

function isAddressLiteral(hostname) {
  return hostname.startsWith('[') || /^[0-9.]+$/.test(hostname);
}
