/**
 * The function that runs inside the page, after it has loaded.
 *
 * It only measures. Every judgement about what a measurement means lives in
 * rules.js, so the two can be changed independently: a new rule never requires
 * another visit to the site, and a measurement fix never silently moves a
 * threshold.
 */
export function measureInPage() {
  const doc = document;
  const root = doc.documentElement;
  const text = (doc.body && doc.body.innerText) || '';
  const html = (root.outerHTML || '').slice(0, 400000);
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const resources = performance.getEntriesByType('resource') || [];
  const all = (selector) => doc.querySelectorAll(selector);

  const footerText = [...all('footer, .footer, #footer, [class*=copyright]')]
    .map((el) => el.innerText || '')
    .join(' ');
  let copyrightYear = 0;
  const yearHunt = footerText + ' ' + text.slice(-4000);
  const YEAR = /(?:©|&copy;|copyright)[^0-9]{0,24}((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)\d{2}))?/gi;
  for (const match of yearHunt.matchAll(YEAR)) {
    copyrightYear = Math.max(copyrightYear, Number(match[2] || match[1]));
  }

  const PLATFORMS = {
    wix: /wix\.com|wixstatic/i,
    squarespace: /squarespace|sqsp\.net/i,
    wordpress: /wp-content|wp-includes|wp-json/i,
    shopify: /cdn\.shopify|shopifycloud/i,
    webflow: /webflow/i,
    godaddy: /godaddy|secureserver/i,
    joomla: /joomla/i,
    drupal: /drupal/i,
    flash: /\.swf\b|application\/x-shockwave/i,
    tableLayout: /<table[^>]*(width|cellpadding|border)=/i,
  };
  const platforms = Object.keys(PLATFORMS).filter((key) => PLATFORMS[key].test(html));

  const PLACEHOLDERS = {
    lorem: /lorem ipsum/i,
    yourCompany: /\byour (company|business|name|logo|text here)\b/i,
    comingSoon: /coming soon|under construction/i,
    exampleMail: /@(example|domain|yourdomain)\.(com|org|net)/i,
    demoContent: /\bdemo ?(text|content)\b/i,
  };
  const placeholders = Object.keys(PLACEHOLDERS).filter(
    (key) => PLACEHOLDERS[key].test(text) || PLACEHOLDERS[key].test(html),
  );

  const images = [...all('img')];
  const stillLoading = images.filter((img) => !img.complete).length;

  /**
   * Counting broken images before the document is finished reports images that
   * are merely still on their way. An earlier version of this measurement
   * called four working sites broken for that reason. When the page is not
   * settled the count is null, and the rule that depends on it cannot fire.
   */
  const settled = doc.readyState === 'complete' && stillLoading === 0;
  const brokenImages = settled
    ? images.filter((img) => img.complete && img.naturalWidth === 0 && !!img.getAttribute('src')).length
    : null;

  const transferred =
    resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) + (nav.transferSize || 0);
  const heavyImages = resources.filter(
    (r) => /image/i.test(r.initiatorType) && r.transferSize > 500000,
  );

  const mailto = [...new Set([...all('a[href^="mailto:"]')].map((a) => a.href.slice(7).split('?')[0]))];
  const tel = [...new Set([...all('a[href^="tel:"]')].map((a) => a.href.slice(4)))];
  const forms = [...all('form')].filter((f) =>
    f.querySelector('input[type=text],input[type=email],textarea'),
  ).length;

  const title = (doc.title || '').trim();
  const viewport = (doc.querySelector('meta[name=viewport]') || {}).content || '';

  return {
    url: location.href,
    host: location.hostname,
    https: location.protocol === 'https:',
    title,
    titleLength: title.length,
    descriptionLength: ((doc.querySelector('meta[name=description]') || {}).content || '').trim()
      .length,
    lang: (root.getAttribute('lang') || '').slice(0, 8),
    headings: all('h1').length,
    hasViewport: Boolean(viewport),
    overflowPx: Math.max(0, (root.scrollWidth || 0) - (window.innerWidth || 0)),
    copyrightYear: copyrightYear || null,
    platforms,
    placeholders,
    forms,
    mailto: mailto.slice(0, 3),
    tel: tel.slice(0, 3),
    imageCount: images.length,
    heavyImageCount: heavyImages.length,
    brokenImages,
    settled,
    weightKb: Math.round(transferred / 1024),
    requestCount: resources.length,
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    measuredAt: new Date().toISOString(),
  };
}

/** The same function as a string, ready for page.evaluate or a CDP call. */
export const MEASURE_SOURCE = `(${measureInPage.toString()})()`;
