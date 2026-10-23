import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findings, DEFAULT_RULES } from '../src/rules.js';

/** A measurement of a page with nothing wrong with it. */
function healthy(overrides = {}) {
  return {
    https: true,
    placeholders: [],
    mailto: ['hello@example.com'],
    tel: [],
    forms: 1,
    hasViewport: true,
    overflowPx: 0,
    weightKb: 900,
    brokenImages: 0,
    settled: true,
    platforms: ['wordpress'],
    copyrightYear: new Date().getFullYear(),
    heavyImageCount: 0,
    titleLength: 42,
    wordCount: 600,
    ...overrides,
  };
}

test('a healthy page produces no findings', () => {
  assert.deepEqual(findings(healthy()), []);
});

test('findings come back worst first', () => {
  const result = findings(healthy({ https: false, titleLength: 0, wordCount: 10 }));
  const weights = result.map((f) => f.weight);
  assert.deepEqual(weights, [...weights].sort((a, b) => b - a));
  assert.equal(result[0].id, 'no-https');
});

test('an unsettled page cannot report broken images', () => {
  const result = findings(healthy({ brokenImages: null }));
  assert.equal(
    result.some((f) => f.id === 'broken-images'),
    false,
  );
});

test('a settled page with broken images reports them with a count', () => {
  const result = findings(healthy({ brokenImages: 3 }));
  const found = result.find((f) => f.id === 'broken-images');
  assert.ok(found);
  assert.match(found.detail, /3 image/);
});

test('a page with no copyright year is not called stale', () => {
  assert.equal(
    findings(healthy({ copyrightYear: null })).some((f) => f.id === 'stale-copyright'),
    false,
  );
});

test('a two-year-old footer is stale, last year is not', () => {
  const year = new Date().getFullYear();
  assert.equal(
    findings(healthy({ copyrightYear: year - 1 })).some((f) => f.id === 'stale-copyright'),
    false,
  );
  assert.equal(
    findings(healthy({ copyrightYear: year - 2 })).some((f) => f.id === 'stale-copyright'),
    true,
  );
});

test('the heavy and very heavy rules never fire together', () => {
  for (const weightKb of [2000, 4000, 9000]) {
    const ids = findings(healthy({ weightKb })).map((f) => f.id);
    assert.ok(!(ids.includes('heavy-page') && ids.includes('very-heavy-page')));
  }
});

test('a missing viewport and a sideways scroll both count as not mobile ready', () => {
  assert.match(
    findings(healthy({ hasViewport: false })).find((f) => f.id === 'not-mobile-ready').detail,
    /viewport/,
  );
  assert.match(
    findings(healthy({ overflowPx: 240 })).find((f) => f.id === 'not-mobile-ready').detail,
    /240 px/,
  );
});

test('a page reachable only by email still counts as contactable', () => {
  const ids = findings(healthy({ forms: 0, tel: [] })).map((f) => f.id);
  assert.equal(ids.includes('no-contact-route'), false);
});

test('the floor drops the lighter findings', () => {
  const measurement = healthy({ wordCount: 10, https: false });
  assert.equal(findings(measurement, { floor: 90 }).length, 1);
});

test('every rule has a distinct id and a weight within range', () => {
  const ids = DEFAULT_RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of DEFAULT_RULES) {
    assert.ok(rule.weight > 0 && rule.weight <= 100, rule.id);
  }
});
