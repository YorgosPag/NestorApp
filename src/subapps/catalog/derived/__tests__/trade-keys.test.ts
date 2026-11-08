/**
 * ADR-934 Σ1β — τα κλειδιά ταυτότητας εμπορίου: GTIN-14 · μάρκα από τη ΡΙΖΑ · MPN · κλίμακα ταύτισης · προειδοποιήσεις.
 */
import type { CatalogProductDefinition, CatalogValueHolder } from '../../types/product';
import type { InheritanceLink } from '../../values/resolve-inherited';
import { brandKeyOf } from '../../public/supplier-brand-claim-rules';
import { normalizeUniqueText } from '../../values/normalize-unique';
import {
  GTIN_RESERVATION_KEY,
  gtinReservationKeysOf,
  isPlatformReservationKey,
  storedGtinReservationKeysOf,
  tradeIdentifierBasis,
  tradeKeysOf,
  tradeWarningsOf,
} from '../trade-keys';

const EAN13 = '4006381333931';
const EAN13_INTERNAL = '2000000000008';
const GTIN14_CASE = '14006381333938';

const holder = (brand: string | null): CatalogValueHolder => ({ values: {}, noValueReasons: {}, categoryIds: [], brand });
const sku = (over: Partial<CatalogProductDefinition> = {}): CatalogProductDefinition => ({
  ...holder(null), modelId: 'cpm_root', familyId: 'fam', gtin: null, mpn: null, noGtinReason: null, ...over,
});
const link = (id: string, kind: InheritanceLink['kind'], value: CatalogValueHolder): InheritanceLink => ({ id, kind, revision: 1, holder: value });
const chainOf = (rootBrand: string | null, product: CatalogProductDefinition): InheritanceLink[] =>
  [link('cpm_root', 'productModel', holder(rootBrand)), link('cpr_1', 'product', product)];

describe('tradeKeysOf', () => {
  it('έγκυρο EAN-13 ⇒ GTIN-14 με αριστερό μηδενικό · ταυτίσιμο · βάση «gtin»', () => {
    const product = sku({ gtin: EAN13 });
    const keys = tradeKeysOf(chainOf('Daikin', product), product);
    expect(keys.gtin14).toBe(`0${EAN13}`);
    expect(keys.gtinMatchable).toBe(true);
    expect(keys.gtinPrefixClass).toBe('global');
    expect(keys.gtinIndicator).toBe('base');
    expect(keys.identifierBasis).toBe('gtin');
  });

  it('🔑 η μάρκα έρχεται από τη ΡΙΖΑ (Δ1) — ίδιο κλειδί με την κατοχή μάρκας · MPN με τον κανόνα των κωδικών', () => {
    const product = sku({ mpn: ' FTXM-25R ' });
    const keys = tradeKeysOf(chainOf('  Daikin ', product), product);
    expect(keys.brandKey).toBe(brandKeyOf('  Daikin '));
    expect(keys.mpnKey).toBe(normalizeUniqueText(' FTXM-25R '));
    expect(keys.identifierBasis).toBe('brand-mpn');
  });

  it('εσωτερικός κωδικός (200–299): κρατιέται, ΔΕΝ ταυτίζει ⇒ πέφτει στο επόμενο σκαλί', () => {
    const product = sku({ gtin: EAN13_INTERNAL, mpn: 'X1' });
    const keys = tradeKeysOf(chainOf('Daikin', product), product);
    expect(keys.gtin14).toBe(`0${EAN13_INTERNAL}`);
    expect(keys.gtinMatchable).toBe(false);
    expect(keys.identifierBasis).toBe('brand-mpn');
  });

  it('άκυρο GTIN ⇒ κανένα κλειδί (ποτέ «διόρθωση») · χωρίς τίποτα ⇒ «none»', () => {
    const product = sku({ gtin: '4006381333932' });
    const keys = tradeKeysOf(chainOf(null, product), product);
    expect(keys.gtin14).toBeNull();
    expect(keys.identifierBasis).toBe('none');
  });

  it('🔴 παλιό έγγραφο χωρίς τα πεδία (πριν από το Σ1β) ⇒ ασφαλής προεπιλογή, κανένα σφάλμα', () => {
    const legacy = { values: {}, noValueReasons: {}, categoryIds: [] } as unknown as CatalogProductDefinition;
    const keys = tradeKeysOf([link('cpr_old', 'product', legacy)], legacy);
    expect(keys).toEqual({ gtin14: null, gtinMatchable: false, gtinPrefixClass: null, gtinIndicator: null, brandKey: null, mpnKey: null, identifierBasis: 'none' });
  });
});

describe('tradeIdentifierBasis — η κλίμακα Α5 σε ένα σημείο', () => {
  it('GTIN μόνο αν ταυτίσιμο · μάρκα + MPN μόνο ΜΑΖΙ', () => {
    expect(tradeIdentifierBasis({ gtin14: '0'.repeat(13) + '1', gtinMatchable: true, brandKey: null, mpnKey: null })).toBe('gtin');
    expect(tradeIdentifierBasis({ gtin14: null, gtinMatchable: false, brandKey: 'daikin', mpnKey: null })).toBe('none');
    expect(tradeIdentifierBasis({ gtin14: null, gtinMatchable: false, brandKey: null, mpnKey: 'x' })).toBe('none');
  });
});

describe('κράτηση @gtin', () => {
  it('κάθε έγκυρο GTIN (και το εσωτερικό) κρατιέται· άκυρο/κενό ⇒ τίποτα', () => {
    expect(gtinReservationKeysOf(sku({ gtin: EAN13 }))).toEqual({ [GTIN_RESERVATION_KEY]: `0${EAN13}` });
    expect(gtinReservationKeysOf(sku({ gtin: EAN13_INTERNAL }))).toEqual({ [GTIN_RESERVATION_KEY]: `0${EAN13_INTERNAL}` });
    expect(gtinReservationKeysOf(sku({ gtin: 'abc' }))).toEqual({});
    expect(gtinReservationKeysOf(sku())).toEqual({});
  });

  it('από τα αποθηκευμένα παράγωγα · `undefined` (παλιό έγγραφο) ⇒ {}', () => {
    expect(storedGtinReservationKeysOf({ gtin14: `0${EAN13}` })).toEqual({ [GTIN_RESERVATION_KEY]: `0${EAN13}` });
    expect(storedGtinReservationKeysOf(undefined)).toEqual({});
  });

  it('🔑 το κλειδί πλατφόρμας δεν μπερδεύεται με id ιδιότητας', () => {
    expect(isPlatformReservationKey(GTIN_RESERVATION_KEY)).toBe(true);
    expect(isPlatformReservationKey('cattr_0f8e2a')).toBe(false);
  });
});

describe('tradeWarningsOf — δεν μπλοκάρουν', () => {
  it('εσωτερικός κωδικός ⇒ gtinNotMatchable · κιβώτιο ⇒ gtinPackagingLevel · κανονικό ⇒ τίποτα', () => {
    expect(tradeWarningsOf(sku({ gtin: EAN13_INTERNAL })).map((issue) => issue.code)).toEqual(['gtinNotMatchable']);
    expect(tradeWarningsOf(sku({ gtin: GTIN14_CASE }))).toEqual([{ code: 'gtinPackagingLevel', path: 'gtin', params: { indicator: 'packaging' } }]);
    expect(tradeWarningsOf(sku({ gtin: EAN13 }))).toEqual([]);
  });
});
