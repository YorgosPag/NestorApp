/**
 * ADR-923 §5.6.1 απόφαση 76 — το υποσέλιδο λέει ποια έκδοση τιμών τυπώθηκε, από πότε, και έως πότε όταν την έχει κόψει
 * επόμενη δημοσιευμένη. Το «έως» βγαίνει από τη μία χρονογραμμή, όπως στην οθόνη των εκδόσεων.
 */
import type { PriceVersionRef } from '../../pricing/version-timeline';
import { priceEditionLine, publicationPriceEdition, type PriceEditionWords } from '../publication-price-edition';

// Μεσάνυχτα Ελλάδας σε UTC (EEST +3 ως 25/10, EET +2 μετά): η μέρα του χαρτιού είναι η ελληνική.
const OCT_1 = '2026-09-30T21:00:00.000Z';
const NOV_1 = '2026-10-31T22:00:00.000Z';
const DEC_1 = '2026-11-30T22:00:00.000Z';

const version = (id: string, number: number, status: PriceVersionRef['status'], validFrom: string | null): PriceVersionRef => ({ id, number, status, validFrom });
const v1 = { ...version('v1', 1, 'superseded', OCT_1), validFrom: OCT_1 };
const v2 = { ...version('v2', 2, 'published', NOV_1), validFrom: NOV_1 };

const WORDS: PriceEditionWords = {
  open: (number, from) => `open ${number} ${from}`,
  closed: (number, from, until) => `closed ${number} ${from} ${until}`,
};

describe('publicationPriceEdition: το «έως» από τη χρονογραμμή', () => {
  it('η τρέχουσα έκδοση δεν έχει «έως»', () => {
    expect(publicationPriceEdition(v2, [v1, v2])).toEqual({ versionNumber: 2, validFrom: NOV_1, validUntil: null });
  });

  it('η αντικατεστημένη έκδοση κλείνει στην αρχή της επόμενης', () => {
    expect(publicationPriceEdition(v1, [v1, v2])).toEqual({ versionNumber: 1, validFrom: OCT_1, validUntil: NOV_1 });
  });

  it('η σειρά ανάγνωσης δεν μετρά: κρίνει ο αριθμός έκδοσης', () => {
    expect(publicationPriceEdition(v1, [v2, v1]).validUntil).toBe(NOV_1);
  });

  it('δημοσιευμένη μελλοντική έκδοση κλείνει ήδη την τρέχουσα', () => {
    const v3 = version('v3', 3, 'published', DEC_1);
    expect(publicationPriceEdition(v2, [v1, { ...v2, status: 'superseded' }, v3]).validUntil).toBe(DEC_1);
  });

  it('πρόχειρη ή απορριφθείσα επόμενη δεν κλείνει τίποτα', () => {
    const draft = version('v3', 3, 'draft', DEC_1);
    const discarded = version('v4', 4, 'discarded', DEC_1);
    expect(publicationPriceEdition(v2, [v1, v2, draft, discarded]).validUntil).toBeNull();
  });

  it('η έκδοση κλείνει από τη δική της επόμενη, όχι από όποια τύχει', () => {
    const v3 = version('v3', 3, 'published', DEC_1);
    expect(publicationPriceEdition(v1, [v1, { ...v2, status: 'superseded' }, v3]).validUntil).toBe(NOV_1);
  });

  it('έκδοση εκτός χρονογραμμής δεν παίρνει «έως» ξένης', () => {
    expect(publicationPriceEdition({ ...v1, id: 'other' }, [v1, v2]).validUntil).toBeNull();
  });
});

describe('priceEditionLine: η γραμμή του υποσέλιδου', () => {
  it('ανοιχτή έκδοση: μόνο «από», με την ελληνική μέρα', () => {
    expect(priceEditionLine({ versionNumber: 2, validFrom: NOV_1, validUntil: null }, 'el', WORDS)).toBe('open 2 1/11/2026');
  });

  it('κλειστή έκδοση: «από» και «έως», στη γλώσσα της έκδοσης', () => {
    expect(priceEditionLine({ versionNumber: 1, validFrom: OCT_1, validUntil: NOV_1 }, 'en', WORDS)).toBe('closed 1 01/10/2026 01/11/2026');
  });

  it('το «έως» είναι η ημερομηνία της επόμενης, όχι του «από»', () => {
    expect(priceEditionLine({ versionNumber: 1, validFrom: OCT_1, validUntil: DEC_1 }, 'el', WORDS)).toBe('closed 1 1/10/2026 1/12/2026');
  });
});
