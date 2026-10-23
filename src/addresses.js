/**
 * Address classification used to keep the scanner off the local network.
 *
 * A scanner that fetches a URL someone else chose is a request forgery engine
 * unless something stops it reaching 127.0.0.1, a private subnet, or a cloud
 * metadata endpoint. Hostname checks are not enough, because a public name can
 * resolve wherever its owner likes, so classification happens on the resolved
 * address.
 */

const BLOCKED_V4 = [
  ['0.0.0.0', 8], // this network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link local, includes cloud metadata at 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, includes the broadcast address
];

const BLOCKED_V4_RANGES = BLOCKED_V4.map(([base, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { network: (toV4Number(base) & mask) >>> 0, mask };
});

function toV4Number(address) {
  const parts = address.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function isPrivateV4(address) {
  const value = toV4Number(address);
  if (value === null) {
    return true; // unparseable is not provably public
  }
  return BLOCKED_V4_RANGES.some((range) => ((value & range.mask) >>> 0) === range.network);
}

function isPrivateV6(address) {
  const lower = address.toLowerCase().split('%')[0];

  // ::ffff:192.168.0.1 and ::ffff:c0a8:1 both carry an IPv4 address.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
  if (mapped) {
    return isPrivateV4(mapped[1]);
  }

  if (lower === '::' || lower === '::1') {
    return true;
  }

  const head = lower.split(':')[0] ?? '';
  const leading = Number.parseInt(head.padStart(4, '0').slice(0, 4), 16);
  if (Number.isNaN(leading)) {
    return true;
  }

  const isUniqueLocal = (leading & 0xfe00) === 0xfc00; // fc00::/7
  const isLinkLocal = (leading & 0xffc0) === 0xfe80; // fe80::/10
  const isMulticast = (leading & 0xff00) === 0xff00; // ff00::/8
  const isIpv4Mapped = lower.startsWith('::ffff:');

  return isUniqueLocal || isLinkLocal || isMulticast || isIpv4Mapped;
}

/** True for any address the scanner must not connect to. */
export function isPrivateAddress(address) {
  return address.includes(':') ? isPrivateV6(address) : isPrivateV4(address);
}
