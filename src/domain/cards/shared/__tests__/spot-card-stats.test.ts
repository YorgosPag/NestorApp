/**
 * Άγκυρες — η γραμμή τιμής στις κάρτες **θέσεων και αποθηκών** (ADR-329 §3.9 · Ν3, 2026-10-08).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το Ν3 διόρθωσε την κάρτα ακινήτου: ποσό εγγραφής που **δεν προσφέρεται** δεν
 * φορά το χρώμα της προσφοράς και δεν λέγεται «Τιμή». Το `priceStat` διάβαζε την **ίδια** ετυμηγορία
 * (`resolveDisplayPrice`, που φέρει τη στάθμη) και την πετούσε: θέση «Μη διαθέσιμη» έγραφε «Τιμή
 * 12.000 €» στο πράσινο. Ο φάκελος `domain/cards/shared` δεν είχε κανένα test.
 *
 * ⚠️ Κρίνονται **λέξη και χρώμα**, όχι ποσά: τα ποσά τα αποδεικνύει το `price-resolver.test.ts`.
 */
import { priceStat } from '@/domain/cards/shared/spot-card-stats';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';

/** Το `t` επιστρέφει το ίδιο το κλειδί — κρίνουμε ΠΟΙΟ κλειδί ζητήθηκε (και με ποιο ποσό). */
const t = (key: string, opts?: Record<string, unknown>): string =>
  opts && 'price' in opts ? `${key}:${String(opts.price)}` : key;

/** Η λέξη που δίνει η κάρτα για ποσό σε ισχύ (`parking:card.stats.price`, ήδη λυμένη). */
const CALLER_LABEL = 'Τιμή';

const space = (commercialStatus: string, extra: Partial<PricedPropertyLike> = {}): PricedPropertyLike => ({
  commercialStatus,
  commercial: { askingPrice: 12_000 },
  ...extra,
});

describe('priceStat — η λέξη και το χρώμα ακολουθούν τη στάθμη', () => {
  // Υπολογίζεται ΜΕΣΑ στο test: η γλώσσα του μορφοποιητή ποσών ορίζεται μετά τη φόρτωση του αρχείου.
  const offered = () => priceStat(space('for-sale'), CALLER_LABEL, t);

  it('προσφορά ⇒ η λέξη της κάρτας, με το χρώμα της τιμής', () => {
    expect(offered()?.label).toBe(CALLER_LABEL);
    expect(offered()?.valueColor).toBeDefined();
  });

  it('🔴 εκτός αγοράς ⇒ «Τιμή ζήτησης», το ποσό μένει, ΧΩΡΙΣ το χρώμα της προσφοράς', () => {
    const row = priceStat(space('unavailable'), CALLER_LABEL, t);
    expect(row?.label).toBe('common:priceStanding.offMarket');
    expect(row?.value).toBe(offered()?.value);
    expect(row?.valueColor).toBeUndefined();
    expect(row?.iconColor).not.toBe(offered()?.iconColor);
  });

  it('🔴 στον κάδο / στο αρχείο ⇒ «Τελευταία τιμή», ακόμη κι αν η κατάσταση λέει «προς πώληση»', () => {
    for (const status of ['deleted', 'archived']) {
      const row = priceStat(space('for-sale', { status }), CALLER_LABEL, t);
      expect(row?.label).toBe('common:priceStanding.retired');
      expect(row?.valueColor).toBeUndefined();
    }
  });

  it('κρατημένη / πωλημένη θέση ΕΙΝΑΙ συναλλαγή ⇒ η λέξη της κάρτας, με το χρώμα της', () => {
    for (const status of ['reserved', 'sold']) {
      const row = priceStat(space(status), CALLER_LABEL, t);
      expect(row?.label).toBe(CALLER_LABEL);
      expect(row?.valueColor).toBeDefined();
    }
  });

  it('θέση προς ενοικίαση κρατά τη μονάδα της («/μήνα») — η στάθμη δεν αγγίζει το ποσό', () => {
    const row = priceStat({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 } }, CALLER_LABEL, t);
    expect(String(row?.value)).toMatch(/^common:priceAmount\.rent:/);
  });

  it('χωρίς τιμή ⇒ καμία γραμμή', () => {
    expect(priceStat({ commercialStatus: 'unavailable' }, CALLER_LABEL, t)).toBeNull();
  });
});
