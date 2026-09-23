/**
 * ADR-777 §8.72 — «είναι άνθρωπος;» και «από πού ήρθε;»: τα δύο φθηνά φίλτρα του μετρητή προβολών.
 */

import { isAutomatedUserAgent, isPrefetchRequest } from '../automated-request';
import { clientIpOf } from '../client-ip';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

describe('isAutomatedUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/129.0 Safari/537.36',
    'facebookexternalhit/1.1',
    'curl/8.4.0',
    'python-requests/2.32',
  ])('αυτοδηλωμένος αυτοματισμός ⇒ true: %s', (ua) => {
    expect(isAutomatedUserAgent(ua)).toBe(true);
  });

  it('κενός ή απών UA ⇒ true (κανένας φυλλομετρητής δεν στέλνει κενό)', () => {
    expect(isAutomatedUserAgent(null)).toBe(true);
    expect(isAutomatedUserAgent('   ')).toBe(true);
  });

  it.each([CHROME, SAFARI_IOS])('πραγματικός φυλλομετρητής ⇒ false', (ua) => {
    expect(isAutomatedUserAgent(ua)).toBe(false);
  });
});

describe('isPrefetchRequest', () => {
  it('Sec-Purpose: prefetch / Purpose: prefetch ⇒ δεν είναι προβολή', () => {
    expect(isPrefetchRequest(new Headers({ 'sec-purpose': 'prefetch;prerender' }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ purpose: 'prefetch' }))).toBe(true);
  });

  it('κανονικό αίτημα ⇒ false', () => {
    expect(isPrefetchRequest(new Headers())).toBe(false);
  });
});

describe('clientIpOf — ένα SSoT για τρεις (τώρα τέσσερις) καταναλωτές', () => {
  it('το ΠΡΩΤΟ στοιχείο του x-forwarded-for είναι ο πελάτης', () => {
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('εφεδρεία x-real-ip, μετά «unknown» — ποτέ κενό', () => {
    expect(clientIpOf(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIpOf(new Headers())).toBe('unknown');
    expect(clientIpOf(new Headers({ 'x-forwarded-for': ' ' }))).toBe('unknown');
  });
});
