/**
 * ΑΓΚΥΡΕΣ — **ποσό ΜΑΖΙ με μονάδα** (ADR-835 §4.4 · ADR-777 §8.60).
 *
 * 🔴 Φυλάει το περιστατικό 2026-09-17: κατάλυμα 50 €/νύχτα διαβαζόταν «50 €» σε κάρτα,
 * φούσκα, δείκτη άκρης και πινακίδα χάρτη — με την όψη τιμής πώλησης.
 *
 * ⚠️ Το `t` εκτελεί **τα πραγματικά ελληνικά locales** (ICU `{price}`), όχι ψεύτικα
 * κλειδιά: η υπόσχεση είναι ότι **η οθόνη** γράφει «/νύχτα», και αυτή την υπόσχεση την
 * κρατά το locale, όχι ο κώδικας.
 */

import type { TFunction } from 'i18next';
import el from '@/i18n/locales/el/common.json';
import elResults from '@/i18n/locales/el/search-results.json';
import en from '@/i18n/locales/en/common.json';
import {
  displayPriceLabel,
  headlinePriceLabel,
  priceStandingLabel,
  resolvedPriceLabel,
} from '../listing-price-label';
import { PRICE_AMOUNT_KEY, PRICE_STANDING_KEY } from '../listing-price-keys';
import type { DisplayPrice, PriceRole, PriceStanding } from '@/lib/properties/price-resolver';

jest.mock('@/lib/intl-formatting', () => ({
  formatCurrency: (amount: number) => `${amount} €`,
}));

type Locale = Record<string, unknown>;

/** `ns:a.b.c` → τιμή του locale, με απλή αντικατάσταση `{param}`. */
function tFrom(locale: Locale): TFunction {
  const t = (key: string, params?: Record<string, string>) => {
    const path = key.split(':')[1] ?? key;
    const value = path.split('.').reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      locale,
    );
    if (typeof value !== 'string') return key;
    return value.replace(/\{(\w+)\}/g, (_m, name: string) => params?.[name] ?? `{${name}}`);
  };
  return t as unknown as TFunction;
}

/** Κάθε namespace στο δικό του αρχείο — όπως στην εφαρμογή. */
function tFromNamespaces(namespaces: Record<string, Locale>): TFunction {
  const t = (key: string, params?: Record<string, string>) => {
    const [ns, path] = key.includes(':') ? key.split(':') : ['', key];
    return (tFrom(namespaces[ns] ?? {}) as unknown as (k: string, p?: Record<string, string>) => string)(
      `${ns}:${path}`, params);
  };
  return t as unknown as TFunction;
}

const tEl = tFromNamespaces({ common: el as Locale, 'search-results': elResults as Locale });
const tEn = tFromNamespaces({ common: en as Locale });

describe('resolvedPriceLabel — η μονάδα ακολουθεί τον ρόλο', () => {
  it.each([
    ['sale', 170000, '170000 €'],
    ['rent', 900, '900 €/μήνα'],
    ['nightly', 50, '50 €/νύχτα'],
  ] as const)('%s → «%s» γράφεται «%s»', (role, amount, expected) => {
    expect(resolvedPriceLabel(tEl, { role, amount })).toBe(expected);
  });

  it('η τιμή ανά νύχτα ΔΕΝ γράφεται ποτέ σαν τιμή πώλησης', () => {
    expect(resolvedPriceLabel(tEl, { role: 'nightly', amount: 50 }))
      .not.toBe(resolvedPriceLabel(tEl, { role: 'sale', amount: 50 }));
  });

  it('κάθε ρόλος έχει κλειδί που ΛΥΝΕΤΑΙ και στις δύο γλώσσες', () => {
    for (const role of Object.keys(PRICE_AMOUNT_KEY) as PriceRole[]) {
      for (const t of [tEl, tEn]) {
        const text = resolvedPriceLabel(t, { role, amount: 1 });
        expect(text).not.toContain('common:');
        expect(text).toContain('1 €');
      }
    }
  });
});

describe('displayPriceLabel — ποσό ή αιτία απουσίας', () => {
  it('τιμολογημένη ετυμηγορία ⇒ η κύρια τιμή με μονάδα', () => {
    expect(displayPriceLabel(tEl, {
      kind: 'priced',
      headline: { role: 'nightly', amount: 50, source: 'commercial.nightlyRate' },
      secondary: null,
      standing: 'in-effect',
    })).toBe('50 €/νύχτα');
  });

  it('απουσία ⇒ η ΑΙΤΙΑ, ποτέ «0 €»', () => {
    expect(displayPriceLabel(tEl, { kind: 'missing', reason: 'nightly-rate-missing' }))
      .toBe(elResults.listing.priceMissing.nightlyRateMissing);
  });
});

/**
 * 🔴 ADR-329 §3.9 (Ν3 → κάρτες χώρων, 2026-10-08): η λέξη ενός ποσού που ΔΕΝ είναι προσφορά ζούσε
 * ιδιωτικά στην κάρτα ακινήτου. Θέσεις, αποθήκες και κάρτες πωλήσεων διάβαζαν την ΙΔΙΑ ετυμηγορία
 * και έγραφαν «Τιμή» στο πράσινο. Ένας πίνακας, ένας αναγνώστης — για κάθε επιφάνεια.
 */
describe('priceStandingLabel — πώς λέγεται ποσό που ΔΕΝ είναι προσφορά', () => {
  const priced = (standing: PriceStanding): DisplayPrice => ({
    kind: 'priced',
    headline: { role: 'sale', amount: 12000, source: 'commercial.askingPrice' },
    secondary: null,
    standing,
  });

  it('🔴 εκτός αγοράς ⇒ «Τιμή ζήτησης» · αποσυρμένο ⇒ «Τελευταία τιμή»', () => {
    expect(priceStandingLabel(tEl, priced('off-market'))).toBe('Τιμή ζήτησης');
    expect(priceStandingLabel(tEl, priced('retired'))).toBe('Τελευταία τιμή');
  });

  it('προσφορά ⇒ `null`: ο καλών κρατά τη δική του λέξη ΚΑΙ το χρώμα της', () => {
    expect(priceStandingLabel(tEl, priced('in-effect'))).toBeNull();
  });

  it('χωρίς ποσό ⇒ `null` (δεν υπάρχει τίποτα να ονομαστεί)', () => {
    expect(priceStandingLabel(tEl, { kind: 'missing', reason: 'not-listed' })).toBeNull();
  });

  it('κάθε στάθμη εκτός προσφοράς έχει κλειδί που ΛΥΝΕΤΑΙ και στις δύο γλώσσες', () => {
    for (const standing of Object.keys(PRICE_STANDING_KEY) as Exclude<PriceStanding, 'in-effect'>[]) {
      for (const t of [tEl, tEn]) {
        const text = priceStandingLabel(t, priced(standing));
        expect(text).not.toBeNull();
        expect(text).not.toContain('common:');
      }
    }
  });
});

describe('σύνολο διαμονής — «150 € · 3 νύχτες» (§8.60.12)', () => {
  const spy = jest.fn((key: string, params?: Record<string, unknown>) => `${key}|${JSON.stringify(params)}`);
  const tSpy = spy as unknown as TFunction;
  const TOTAL = { totalMinor: 16500, nights: 3 };

  beforeEach(() => spy.mockClear());

  it('το σύνολο προηγείται της τιμής ανά νύχτα', () => {
    const text = displayPriceLabel(tSpy, {
      kind: 'priced',
      headline: { role: 'nightly', amount: 50, source: 'commercial.nightlyRate' },
      secondary: null,
      standing: 'in-effect',
    }, TOTAL);
    expect(text).toBe('common:priceAmount.stayTotal|{"price":"165 €","nights":3}');
  });

  it('και όταν η κύρια τιμή λείπει, αν ο διακομιστής τιμολόγησε τη διαμονή', () => {
    expect(displayPriceLabel(tSpy, { kind: 'missing', reason: 'nightly-rate-missing' }, TOTAL))
      .toContain('common:priceAmount.stayTotal');
  });

  it('η πινακίδα χωρίς σύνολο μένει στο ποσό με μονάδα', () => {
    expect(headlinePriceLabel(tSpy, { role: 'nightly', amount: 50 }, null))
      .toBe('common:priceAmount.nightly|{"price":"50 €"}');
    expect(headlinePriceLabel(tSpy, { role: 'nightly', amount: 50 }, TOTAL))
      .toContain('common:priceAmount.stayTotal');
  });

  it('το locale κλίνει τη νύχτα με ICU plural και στις δύο γλώσσες', () => {
    expect(el.priceAmount.stayTotal).toMatch(/\{nights, plural, one \{# νύχτα\} other \{# νύχτες\}\}/);
    expect(en.priceAmount.stayTotal).toMatch(/\{nights, plural, one \{# night\} other \{# nights\}\}/);
  });
});
