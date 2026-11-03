/**
 * Το άνοιγμα στις μηχανές αναζήτησης (ADR-923 §5.13 Ε2 · Σ5). Το middleware δεν τρέχει σε jest: εδώ κρίνονται το κατηγόρημα
 * και το περιεχόμενο του `robots.txt`. Το 200 για πραγματικό user-agent θέλει ζωντανή δοκιμή.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isSearchEngineOnOpenPath } from '../search-engine-access';

const GOOGLEBOT = 'mozilla/5.0 (compatible; googlebot/2.1; +http://www.google.com/bot.html)';
const robots = readFileSync(join(process.cwd(), 'public/robots.txt'), 'utf8');
const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');

const groupOf = (agent: string): string => robots.split(/\r?\n\r?\n/).find((block) => block.includes(`User-agent: ${agent}`)) ?? '';

describe('isSearchEngineOnOpenPath', () => {
  it.each(['googlebot/2.1', 'bingbot/2.0', 'duckduckbot/1.1', 'applebot/0.1'])('%s μπαίνει στη βιτρίνα', (agent) => {
    expect(isSearchEngineOnOpenPath('/suppliers/aries/p/x', agent)).toBe(true);
  });

  it.each(['/', '/pro/aries', '/listing/1', '/o/aries/catalog', '/api/catalog', '/suppliers'])('🔒 %s μένει κλειστό', (pathname) => {
    expect(isSearchEngineOnOpenPath(pathname, GOOGLEBOT)).toBe(false);
  });

  it.each(['semrushbot/7', 'ahrefsbot/7', 'gptbot/1.0', 'curl/8', 'mozilla/5.0'])('🔒 %s δεν κερδίζει πρόσβαση', (agent) => {
    expect(isSearchEngineOnOpenPath('/suppliers/aries', agent)).toBe(false);
  });
});

describe('το middleware ρωτά το κατηγόρημα', () => {
  it('η εξαίρεση βρίσκεται στον έλεγχο των bots', () => {
    expect(middleware).toMatch(/!isMachineEndpoint && !isSearchEngineOnOpenPath\(pathname, userAgent\) && userAgent/);
  });
});

describe('robots.txt', () => {
  it('🔑 ανοίγει μόνο τη βιτρίνα και τα στατικά που χρειάζεται η απόδοση', () => {
    const general = groupOf('*');
    expect(general).toMatch(/^Allow: \/suppliers\/$/m);
    expect(general).toMatch(/^Allow: \/_next\/static\/$/m);
    expect(general).toMatch(/^Disallow: \/$/m);
    expect(general.match(/^Allow:/gm)).toHaveLength(2);
  });

  it.each(['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'BLEXBot', 'PetalBot', 'ByteSpider'])('🔒 %s μένει κλειστός', (agent) => {
    expect(groupOf(agent)).toMatch(/^Disallow: \/$/m);
  });

  it('δηλώνει το sitemap της βιτρίνας', () => {
    expect(robots).toMatch(/^Sitemap: https:\/\/nestorconstruct\.gr\/suppliers\/sitemap\.xml$/m);
  });
});
