/**
 * Rules turn a measurement into findings.
 *
 * Each rule carries a weight between 0 and 100. The weight answers one
 * question: how much is this costing the owner? A page that cannot be read on
 * a phone outranks a stale year in the footer, however tidy the footer is.
 *
 * `applies` exists so a rule can stand aside when the measurement cannot
 * support it. A rule that cannot tell "no" from "not measured" will eventually
 * report a fault that is not there.
 */

/** @typedef {{id: string, weight: number, applies?: (m: any) => boolean, test: (m: any) => boolean, describe: (m: any) => string}} Rule */

/** @type {Rule[]} */
export const DEFAULT_RULES = [
  {
    id: 'no-https',
    weight: 95,
    test: (m) => !m.https,
    describe: () => 'Served over http. Browsers mark the page as not secure.',
  },
  {
    id: 'placeholder-text',
    weight: 90,
    test: (m) => m.placeholders.length > 0,
    describe: (m) => `Template text was never replaced: ${m.placeholders.join(', ')}.`,
  },
  {
    id: 'no-contact-route',
    weight: 92,
    test: (m) => m.mailto.length === 0 && m.tel.length === 0 && m.forms === 0,
    describe: () => 'No email link, phone link or form. A visitor cannot make contact.',
  },
  {
    id: 'not-mobile-ready',
    weight: 85,
    test: (m) => !m.hasViewport || m.overflowPx > 20,
    describe: (m) =>
      m.hasViewport
        ? `The page is ${m.overflowPx} px wider than the screen, so it scrolls sideways on a phone.`
        : 'No viewport tag. The page is rendered at desktop width on a phone.',
  },
  {
    id: 'very-heavy-page',
    weight: 88,
    test: (m) => m.weightKb > 8000,
    describe: (m) => `The page weighs ${(m.weightKb / 1024).toFixed(1)} MB.`,
  },
  {
    id: 'broken-images',
    weight: 80,
    applies: (m) => m.brokenImages !== null,
    test: (m) => m.brokenImages > 0,
    describe: (m) => `${m.brokenImages} image(s) fail to load.`,
  },
  {
    id: 'obsolete-technology',
    weight: 78,
    test: (m) => m.platforms.includes('flash') || m.platforms.includes('tableLayout'),
    describe: () => 'The page is built on technology browsers no longer support well.',
  },
  {
    id: 'stale-copyright',
    weight: 70,
    applies: (m) => m.copyrightYear !== null,
    test: (m) => new Date().getFullYear() - m.copyrightYear >= 2,
    describe: (m) => `The footer still says ${m.copyrightYear}.`,
  },
  {
    id: 'heavy-page',
    weight: 60,
    test: (m) => m.weightKb > 3000 && m.weightKb <= 8000,
    describe: (m) => `The page weighs ${(m.weightKb / 1024).toFixed(1)} MB.`,
  },
  {
    id: 'oversized-images',
    weight: 55,
    test: (m) => m.heavyImageCount > 0,
    describe: (m) => `${m.heavyImageCount} image(s) are over half a megabyte each.`,
  },
  {
    id: 'no-title',
    weight: 50,
    test: (m) => m.titleLength === 0,
    describe: () => 'The page has no title, so search results and browser tabs show the address.',
  },
  {
    id: 'thin-content',
    weight: 40,
    test: (m) => m.wordCount < 80,
    describe: (m) => `Only ${m.wordCount} words on the page.`,
  },
];

/**
 * Applies the rules and returns the findings, worst first.
 *
 * `floor` drops findings too minor to act on. Reporting everything a scanner
 * can see trains the reader to ignore the report; the default of 50 keeps it
 * to things worth someone's afternoon.
 *
 * @param {any} measurement
 * @param {{rules?: Rule[], floor?: number}} [options]
 */
export function findings(measurement, options = {}) {
  const rules = options.rules ?? DEFAULT_RULES;
  const floor = options.floor ?? 50;

  return rules
    .filter((rule) => (rule.applies ? rule.applies(measurement) : true))
    .filter((rule) => rule.weight >= floor)
    .filter((rule) => rule.test(measurement))
    .map((rule) => ({ id: rule.id, weight: rule.weight, detail: rule.describe(measurement) }))
    .sort((a, b) => b.weight - a.weight);
}
