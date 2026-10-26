/**
 * ADR-923 §5.10.4 Β2 — κλειδί ταξινόμησης + αναγνωριστικό/ετικέτα της λίστας, πάνω στο πραγματικό MFP × 7.
 */
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_SETTINGS, MFP_VARIANTS, mfpChain } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { productChainDerived, rootModelDerived, subModelDerived, type CatalogSchemaSnapshot } from '../chain-derived';
import { ownHolderDerived } from '../holder-derived';
import { SORT_KEY_DIGITS, SORT_KEY_MAX_LENGTH, catalogSortKey } from '../sort-key';

const schema: CatalogSchemaSnapshot = {
  family: MFP_FAMILY,
  attributes: MFP_ATTRIBUTE_MAP,
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  settings: MFP_SETTINGS,
  scheme: MFP_FAMILY.variantSchemes[0],
};
const own = (holder: Parameters<typeof ownHolderDerived>[0]) => ownHolderDerived(holder, MFP_ATTRIBUTE_MAP, PLATFORM_MEASUREMENT_REGISTRY, []);
const sorted = (texts: string[]) => [...texts].sort((a, b) => (catalogSortKey(a) < catalogSortKey(b) ? -1 : 1));

describe('catalogSortKey', () => {
  it('φυσική σειρά αριθμών: MFP 9 < MFP 10 < MFP 100 (η Firestore χωρίς αυτό: 10 < 100 < 9)', () => {
    expect(sorted(['MFP 100', 'MFP 10', 'MFP 9'])).toEqual(['MFP 9', 'MFP 10', 'MFP 100']);
    expect(catalogSortKey('007')).toBe('7'.padStart(SORT_KEY_DIGITS, '0'));
  });

  it('τόνοι, πεζά/κεφαλαία, τελικό σίγμα: «Άλφα» ≡ «αλφα» · «Σωλήνας» ≡ «σωληνασ» (το SSoT της αναζήτησης)', () => {
    expect(catalogSortKey('Άλφα')).toBe(catalogSortKey('αλφα'));
    expect(catalogSortKey('ΣΩΛΗΝΑΣ')).toBe(catalogSortKey('σωλήνας'));
    expect(sorted(['Βάνα', 'άγκιστρο', 'Γωνία'])).toEqual(['άγκιστρο', 'Βάνα', 'Γωνία']);
  });

  it('απόν ⇒ \'\' (ΠΑΝΤΑ γραμμένο: το orderBy αποκλείει έγγραφα χωρίς πεδίο) · όριο μήκους', () => {
    expect(catalogSortKey(null)).toBe('');
    expect(catalogSortKey('')).toBe('');
    expect(catalogSortKey('x'.repeat(500))).toHaveLength(SORT_KEY_MAX_LENGTH);
  });
});

describe('παράγωγα λίστας πάνω στο MFP × 7', () => {
  it('SKU: αναγνωριστικό = η πρώτη unique ιδιότητα (κωδικός προμηθευτή) · sortKey από την ετικέτα', () => {
    const derived = productChainDerived(schema, mfpChain(MFP_VARIANTS[2], 2), own(MFP_VARIANTS[2]));
    const code = MFP_VARIANTS[2].values.model_code?.['*']?.['*'];
    expect(code?.type).toBe('text');
    expect(derived.identifier).toBe(code?.type === 'text' ? code.text : null);
    expect(derived.sortKey).toBe(catalogSortKey(derived.label ?? derived.identifier));
    expect(derived.sortKey).not.toBe('');
  });

  it('οι 7 παραλλαγές ταξινομούνται με τη ΣΕΙΡΑ του καταλόγου (σελ. 60), όχι λεξικογραφικά', () => {
    const keys = MFP_VARIANTS.map((variant, index) => productChainDerived(schema, mfpChain(variant, index), own(variant)).sortKey);
    expect([...keys].sort()).toEqual(keys);
  });

  it('μοντέλο: ετικέτα του ΕΠΙΠΕΔΟΥ του (η ιδιότητα-ετικέτα ανήκει στις παραλλαγές ⇒ null) · sortKey από τον κωδικό', () => {
    const root = { id: MFP_MODEL_ID, kind: 'productModel' as const, revision: 1, holder: MFP_MODEL, code: MFP_MODEL.code };
    const derived = rootModelDerived(schema, root, own(MFP_MODEL), {}, []);
    expect(derived.label).toBeNull();
    expect(derived.sortKey).toBe(catalogSortKey(MFP_MODEL.code));
    const sub = subModelDerived(schema, [root], own(MFP_MODEL), 'mfp_sub');
    expect(sub.sortKey).toBe(catalogSortKey('mfp_sub'));
  });
});
