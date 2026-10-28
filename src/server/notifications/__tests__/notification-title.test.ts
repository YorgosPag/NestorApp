/**
 * @jest-environment node
 *
 * @fileoverview Ο τίτλος ειδοποίησης από ΕΝΑ κλειδί, στη γλώσσα του παραλήπτη (ADR-327, 2026-10-28).
 *
 * Ν1 el/en από το ίδιο κλειδί · Ν2 άγνωστο κλειδί ⇒ `null` (ο καλών κρατά την εφεδρεία), ποτέ το ωμό κλειδί ·
 * Ν3 «άγνωστος προμηθευτής» ⇒ δικό του κλειδί, ποτέ ωμό id / κενό όνομα ·
 * Ν4 🔴 κάθε κυριολεκτικό `titleKey` (και ζεύγος known/unknown) των καλούντων του server λύνεται σε el ΚΑΙ en, μέσα
 *    στο ΚΛΕΙΣΤΟ σύνολο namespaces — ένα νέο namespace ή κλειδί που λείπει κοκκινίζει εδώ, αντί να γίνει σιωπηλά
 *    ελληνικό θέμα email ·
 * Ν5 τα προεπιλεγμένα κείμενα ειδοποίησης προμηθευτή υπάρχουν σε el/en και είναι ICU (`{x}`, όχι `{{x}}`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  NOTIFICATION_TITLE_NAMESPACES,
  notificationFallbackTitle,
  renderNotificationTitle,
} from '../notification-title';
import { vendorNotificationTitle } from '@/subapps/procurement/utils/quote-vendor-identity';
import { VENDOR_NOTIFICATION_TEMPLATE_KEYS } from '@/subapps/procurement/templates/vendorNotificationDefaults';

const KEY = 'common-shared:quoteNotifications.vendorDeclined';
const REPO = path.resolve(__dirname, '..', '..', '..', '..');

describe('renderNotificationTitle', () => {
  it('Ν1 — ίδιο κλειδί, γλώσσα του παραλήπτη', () => {
    const params = { vendorName: 'ACME', rfqTitle: 'OIK-1' };
    expect(renderNotificationTitle(KEY, params, 'en')).toBe('Vendor ACME declined RFQ OIK-1');
    expect(renderNotificationTitle(KEY, params, 'el')).toContain('ACME');
    expect(renderNotificationTitle(KEY, params, 'el')).not.toBe(renderNotificationTitle(KEY, params, 'en'));
  });

  it('Ν2 — χωρίς/άγνωστο κλειδί ⇒ null · η εφεδρεία δεν είναι ποτέ σιωπηλό κενό', () => {
    expect(renderNotificationTitle(undefined, {}, 'el')).toBeNull();
    expect(renderNotificationTitle('common-shared:nope.missing', {}, 'el')).toBeNull();
    expect(notificationFallbackTitle('common-shared:nope.missing')).toBe('common-shared:nope.missing');
  });
});

describe('vendorNotificationTitle', () => {
  const keys = { known: 'k.known', unknown: 'k.unknown' };
  it('Ν3 — γνωστό όνομα ⇒ known + vendorName · κενό/null ⇒ unknown χωρίς vendorName', () => {
    expect(vendorNotificationTitle(' ACME ', keys, { rfqTitle: 'R' })).toEqual({ titleKey: 'k.known', titleParams: { rfqTitle: 'R', vendorName: 'ACME' } });
    expect(vendorNotificationTitle('', keys, { rfqTitle: 'R' })).toEqual({ titleKey: 'k.unknown', titleParams: { rfqTitle: 'R' } });
    expect(vendorNotificationTitle(null, keys).titleKey).toBe('k.unknown');
  });
});

describe('Ν4 — κάθε titleKey των καλούντων λύνεται (el + en)', () => {
  const CALLERS = [
    'src/app/api/quotes/scan/process.ts',
    'src/app/api/vendor/quote/route.ts',
    'src/app/api/vendor/quote/decline/route.ts',
  ];
  const KEY_LITERAL = /(?:titleKey|known|unknown):\s*'([a-z-]+:[\w.]+)'/g;
  const keys = CALLERS.flatMap((rel) => [...fs.readFileSync(path.join(REPO, rel), 'utf8').matchAll(KEY_LITERAL)].map((m) => m[1]));

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: βρέθηκαν κλειδιά', () => {
    expect(keys.length).toBeGreaterThanOrEqual(7);
  });

  it.each(['el', 'en'] as const)('[%s] όλα λύνονται, όλα σε δηλωμένο namespace', (lang) => {
    const params = { vendorName: 'V', rfqTitle: 'R' };
    const unresolved = keys.filter((key) => renderNotificationTitle(key, params, lang) === null);
    const foreign = keys.filter((key) => !(NOTIFICATION_TITLE_NAMESPACES as readonly string[]).includes(key.split(':')[0]));
    expect({ unresolved, foreign }).toEqual({ unresolved: [], foreign: [] });
  });
});

describe('Ν5 — προεπιλεγμένα κείμενα προς προμηθευτή', () => {
  it.each(['el', 'en'] as const)('[%s] υπάρχουν, ICU μονές αγκύλες', (lang) => {
    const quotes = JSON.parse(fs.readFileSync(path.join(REPO, `src/i18n/locales/${lang}/quotes.json`), 'utf8')) as Record<string, unknown>;
    const at = (key: string) => key.split('.').reduce<unknown>((node, seg) => (node as Record<string, unknown> | undefined)?.[seg], quotes);
    for (const pair of Object.values(VENDOR_NOTIFICATION_TEMPLATE_KEYS)) {
      for (const key of Object.values(pair)) {
        const text = at(key);
        expect(typeof text).toBe('string');
        expect(text as string).not.toContain('{{');
        expect(text as string).toContain('{rfqTitle}');
      }
    }
  });
});
