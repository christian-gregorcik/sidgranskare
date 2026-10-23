# sidgranskare

Visits a public web page, measures it, and reports what is actually wrong with
it, worst first. Written because a list of forty observations is useless and a
list of the three that cost the owner money is not.

No runtime dependencies. You bring the browser.

## Why the request guard matters

A scanner that fetches a URL someone else chose is a request forgery engine
unless something stops it. `https://internal.example` can resolve to
`127.0.0.1`. `http://metadata.internal` can resolve to `169.254.169.254` and
hand back cloud credentials. Checking the hostname proves nothing, because the
owner of a name decides where it points.

So the check runs on the resolved address, not the name, and it runs on every
request the page makes rather than only the first:

- A name that resolves to any non-public address is refused. Not *all* of them
  private, *any*: one public and one private record is a known way past a check
  that only looks at the first answer.
- Loopback, the private ranges, carrier-grade NAT, link-local including the
  metadata address, multicast, reserved space, and the IPv6 equivalents down to
  IPv4 addresses wearing an IPv6 coat (`::ffff:127.0.0.1`).
- An address that will not parse is treated as private. Unparseable is not the
  same as proven safe.
- Redirects, iframes and scripts go through the same guard, because the first
  check never sees where they lead.
- Only http and https. Credentials in the URL are refused.

## Use

```js
import { chromium } from 'playwright';
import { scan } from 'sidgranskare';

const browser = await chromium.launch();
const report = await scan('https://example.com', { browser });
await browser.close();

for (const finding of report.findings) {
  console.log(finding.weight, finding.id, finding.detail);
}
```

Run against a page with a stale footer, a broken image and leftover template
text, the output is:

```
95  no-https  Served over http. Browsers mark the page as not secure.
92  no-contact-route  No email link, phone link or form. A visitor cannot make contact.
90  placeholder-text  Template text was never replaced: lorem.
85  not-mobile-ready  No viewport tag. The page is rendered at desktop width on a phone.
80  broken-images  1 image(s) fail to load.
70  stale-copyright  The footer still says 2019.
```

## Measuring and judging are separate

`measure.js` runs in the page and only measures. `rules.js` decides what a
measurement means. Keeping them apart means a new rule needs no second visit to
the site, and a fix to a measurement cannot quietly move a threshold.

The weights answer one question: how much is this costing the owner? A page
that cannot be read on a phone outranks a stale year in the footer, however
untidy the footer is. Findings below `floor` are dropped, 50 by default,
because a report nobody finishes is a report nobody acts on.

Rules are plain objects, so you can pass your own:

```js
const report = await scan(url, { browser, rules: [...DEFAULT_RULES, myRule], floor: 70 });
```

## The null that matters

`brokenImages` is `null` when the page has not settled, and the rule that reads
it stands aside rather than guessing.

That is there because an earlier version counted images before the document
finished and called three to five images broken on four sites where every image
worked. A rule that cannot tell "no" from "not measured" will eventually report
a fault that is not there, and one false finding costs more trust than ten real
ones earn.

## Development

```
npm test
```

Forty-five tests, no network. The address classifier is checked against the
edges of every blocked range; the rules are checked against a healthy
measurement with one thing changed at a time.

## License

MIT
