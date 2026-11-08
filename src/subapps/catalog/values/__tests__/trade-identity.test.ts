/**
 * ADR-934 Σ1β — οι καθαρές πράξεις της ταυτότητας εμπορίου: GTIN και «χωρίς GTIN» δεν συνυπάρχουν ΑΠΟ ΚΑΤΑΣΚΕΥΗΣ.
 */
import type { CatalogProductDefinition } from '../../types/product';
import {
  EMPTY_TRADE_IDENTITY,
  brandOf,
  brandOfChain,
  gtinInputOf,
  tradeIdentityOf,
  writeBrand,
  writeGtin,
  writeMpn,
  writeNoGtinReason,
} from '../trade-identity';

const EAN13 = '4006381333931';
const sku: CatalogProductDefinition = { values: {}, noValueReasons: {}, categoryIds: [], brand: null, modelId: null, familyId: 'fam', ...EMPTY_TRADE_IDENTITY };

describe('ανάγνωση με ασφαλή προεπιλογή (έγγραφα πριν από το Σ1β)', () => {
  it('λείπουν τα πεδία ⇒ null, ποτέ undefined', () => {
    expect(tradeIdentityOf({})).toEqual(EMPTY_TRADE_IDENTITY);
    expect(brandOf({})).toBeNull();
    expect(brandOfChain([])).toBeNull();
  });
});

describe('gtinInputOf', () => {
  it('διαχωριστικά μόνο στην είσοδο · μη ψηφία μένουν ως έχουν (για να πει ο επικυρωτής ΤΙ φταίει) · κενό ⇒ null', () => {
    expect(gtinInputOf(' 400-6381 333931 ')).toBe(EAN13);
    expect(gtinInputOf('ABC123')).toBe('ABC123');
    expect(gtinInputOf('   ')).toBeNull();
  });
});

describe('πράξεις', () => {
  it('GTIN σβήνει το «χωρίς GTIN»· «χωρίς GTIN» σβήνει το GTIN', () => {
    const declared = writeNoGtinReason(sku, 'notApplicable', null);
    expect(declared).toMatchObject({ gtin: null, noGtinReason: 'notApplicable' });
    expect(writeGtin(declared, EAN13)).toMatchObject({ gtin: EAN13, noGtinReason: null });
  });

  it('🔑 η άρση του «χωρίς GTIN» ΕΠΑΝΑΦΕΡΕΙ το αποθηκευμένο GTIN (ο διακόπτης αντιστρέφεται)', () => {
    const saved = { ...sku, gtin: EAN13 };
    const declared = writeNoGtinReason(saved, 'unknown', saved);
    expect(writeNoGtinReason(declared, null, saved)).toMatchObject({ gtin: EAN13, noGtinReason: null });
  });

  it('κείμενο χωρίς περιττά κενά · κενό ⇒ null', () => {
    expect(writeBrand(sku, '  Daikin ').brand).toBe('Daikin');
    expect(writeBrand(sku, '   ').brand).toBeNull();
    expect(writeMpn(sku, ' FTXM25R ').mpn).toBe('FTXM25R');
  });
});
