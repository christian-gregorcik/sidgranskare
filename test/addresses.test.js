import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPrivateAddress } from '../src/addresses.js';

const PRIVATE = [
  '127.0.0.1',
  '127.1.2.3',
  '10.0.0.1',
  '172.16.0.1',
  '172.31.255.255',
  '192.168.1.1',
  '169.254.169.254',
  '100.64.0.1',
  '0.0.0.0',
  '224.0.0.1',
  '255.255.255.255',
  '::1',
  '::',
  'fd00::1',
  'fe80::1',
  '::ffff:127.0.0.1',
  '::ffff:10.0.0.1',
];

const PUBLIC = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.255.255', '93.184.216.34', '2606:2800:220:1::1'];

for (const address of PRIVATE) {
  test(`${address} is treated as private`, () => {
    assert.equal(isPrivateAddress(address), true);
  });
}

for (const address of PUBLIC) {
  test(`${address} is treated as public`, () => {
    assert.equal(isPrivateAddress(address), false);
  });
}

test('the edges of 172.16.0.0/12 are classified correctly', () => {
  assert.equal(isPrivateAddress('172.15.255.255'), false);
  assert.equal(isPrivateAddress('172.16.0.0'), true);
  assert.equal(isPrivateAddress('172.31.255.255'), true);
  assert.equal(isPrivateAddress('172.32.0.0'), false);
});

test('an unparseable address is not treated as public', () => {
  assert.equal(isPrivateAddress('banana'), true);
  assert.equal(isPrivateAddress('999.1.1.1'), true);
});
