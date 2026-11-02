/**
 * ADR-923 §5.2 / §5.6 / §22 — τι μπαίνει σε μια έκδοση: εύρος, φρένο πληρότητας, κεφάλαια, ραφή `listingKind`, προέλεγχος,
 * μητρώο γραμματοσειρών, επικύρωση συνταγής.
 */
import { readFileSync } from 'node:fs';

import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_VARIANTS, mfpVariantId } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { PublicationRecipeDefinition } from '../../types/publication';
import type { LayoutTable } from '../layout-model';
import { selectPublicationContent, type PublicationDataSet, type StoredProduct } from '../publication-chapters';
import { PUBLICATION_FONTS } from '../publication-fonts';
import { countUntransposedTables, placedDpi, preflightPrintImages } from '../publication-preflight';
import { validatePublicationRecipe } from '../validate-publication-recipe';

const derived = (complete: boolean, index: number) => ({ identifier: `C-${index}`, label: `MFP ${index}`, completeChannels: complete ? ['print:el'] : [], sortKey: `k${index}` });
const products = (complete: (index: number) => boolean): StoredProduct[] => MFP_VARIANTS.map((variant, index) => ({ ...variant, id: mfpVariantId(index), revision: 1, derived: derived(complete(index), index) }));
const words = { text: (value: Partial<Record<string, string>> | undefined, fallback?: string) => value?.el ?? fallback ?? '', yes: 'Ναι', no: 'Όχι', sample: 'δ', price: 'Τιμή €', installationPrice: 'Τοποθέτηση €', askForQuote: 'Ζητήστε προσφορά', uncategorized: 'Λοιπά' };
const base: PublicationDataSet = {
  scope: { kind: 'all' }, language: 'el', categories: [],
  families: [{ ...MFP_FAMILY, id: 'fam', revision: 1 }],
  attributes: new Map([...MFP_ATTRIBUTE_MAP].map(([id, attribute]) => [id, { ...attribute, id, revision: 1 }])),
  models: [{ ...MFP_MODEL, id: MFP_MODEL_ID, familyId: 'fam', revision: 1 }],
  products: products(() => true).map((product) => ({ ...product, familyId: 'fam' })),
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  codec: { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el', assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' },
  words, priceOf: null, ignoreCompleteness: false,
};

describe('selectPublicationContent', () => {
  it('όλα ⇒ ένα κεφάλαιο «Λοιπά» με μία σελίδα οικογένειας', () => {
    const { chapters } = selectPublicationContent(base);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Λοιπά');
    expect(chapters[0].entries[0].kind).toBe('variantModel');
  });

  it('🔴 φρένο πληρότητας: SKU κάτω από το `print:el` δεν μπαίνει, και ΜΕΤΡΙΕΤΑΙ', () => {
    const { chapters, report } = selectPublicationContent({ ...base, products: products((index) => index > 0).map((product) => ({ ...product, familyId: 'fam' })) });
    const first = chapters[0].entries[0];
    expect(first.kind === 'variantModel' && first.preview.columns).toHaveLength(MFP_VARIANTS.length - 1);
    expect(report.incompleteSkuCount).toBe(1);
  });

  it('η προεπισκόπηση δεν φρενάρει: ο άνθρωπος βλέπει το ημιτελές', () => {
    const { chapters } = selectPublicationContent({ ...base, ignoreCompleteness: true, products: products(() => false).map((product) => ({ ...product, familyId: 'fam' })) });
    expect(chapters).toHaveLength(1);
  });

  it('εύρος `selection`: επιλογές που διαγράφηκαν μετά την αποθήκευση λέγονται στην αναφορά', () => {
    const entries = [{ kind: 'productModel', id: MFP_MODEL_ID }, { kind: 'productModel', id: 'gone' }, { kind: 'product', id: 'gone' }] as const;
    expect(selectPublicationContent({ ...base, scope: { kind: 'selection', entries } }).report.missingSelectionCount).toBe(2);
    expect(selectPublicationContent(base).report.missingSelectionCount).toBe(0);
  });

  it('εύρος `selection`: ό,τι δεν επιλέχθηκε μένει απέξω', () => {
    expect(selectPublicationContent({ ...base, scope: { kind: 'selection', entries: [{ kind: 'productModel', id: 'other' }] } }).chapters).toEqual([]);
    expect(selectPublicationContent({ ...base, scope: { kind: 'selection', entries: [{ kind: 'productModel', id: MFP_MODEL_ID }] } }).chapters).toHaveLength(1);
  });

  describe('εύρος `filter`', () => {
    const attributeId = [...base.attributes.values()].find((attribute) => attribute.type === 'select' || attribute.type === 'multiSelect' || attribute.type === 'boolean');
    const family = { ...base.families[0], attributes: attributeId ? [{ ...base.families[0].attributes[0], attributeId: attributeId.id }] : base.families[0].attributes };
    const withKeys = (keysOf: (index: number) => readonly string[]) => base.products.map((product, index) => ({ ...product, derived: { ...product.derived, facetKeys: keysOf(index) } }));
    const filterScope = (familyId: string | null, groups: readonly (readonly string[])[]) => ({ kind: 'filter' as const, filter: { familyId, facetGroups: groups.map((keys) => ({ keys })) } });
    const printed = (result: ReturnType<typeof selectPublicationContent>) => {
      const entry = result.chapters[0]?.entries[0];
      return entry?.kind === 'variantModel' ? entry.preview.columns.length : 0;
    };

    it('🔴 τυπώνει μόνο τις παραλλαγές που περνούν, όχι όλο το μοντέλο', () => {
      const products = withKeys((index) => (index === 0 ? ['a=1'] : ['a=2']));
      expect(printed(selectPublicationContent({ ...base, products, scope: filterScope('fam', [['a=1']]) }))).toBe(1);
    });

    it('OR μέσα στην ιδιότητα, AND ανάμεσα σε ιδιότητες, στο ΙΔΙΟ SKU', () => {
      const products = withKeys((index) => (index === 0 ? ['a=1', 'b=1'] : index === 1 ? ['a=2', 'b=1'] : ['a=1']));
      expect(printed(selectPublicationContent({ ...base, products, scope: filterScope('fam', [['a=1', 'a=2'], ['b=1']]) }))).toBe(2);
    });

    it('οικογένεια χωρίς φίλτρα ιδιοτήτων ⇒ όλη η οικογένεια · άλλη οικογένεια ⇒ τίποτα', () => {
      expect(printed(selectPublicationContent({ ...base, scope: filterScope('fam', []) }))).toBe(MFP_VARIANTS.length);
      expect(selectPublicationContent({ ...base, scope: filterScope('other', []) }).chapters).toEqual([]);
    });

    it('🔴 παλιό έγγραφο χωρίς `facetKeys` δεν περνά φίλτρο ιδιότητας, και το φρένο πληρότητας ισχύει', () => {
      expect(selectPublicationContent({ ...base, scope: filterScope('fam', [['a=1']]) }).chapters).toEqual([]);
      const products = withKeys(() => ['a=1']).map((product, index) => (index === 0 ? { ...product, derived: { ...product.derived, completeChannels: [] } } : product));
      expect(selectPublicationContent({ ...base, products, scope: filterScope('fam', [['a=1']]) }).report.incompleteSkuCount).toBe(1);
    });

    it('🔑 το κλειδί ιδεμποτίας βλέπει μόνο ό,τι πέρασε', () => {
      const products = withKeys((index) => (index === 0 ? ['a=1'] : []));
      const keys = selectPublicationContent({ ...base, products, scope: filterScope('fam', [['a=1']]) }).data.map((ref) => ref.key);
      expect(keys).toContain(`product:${mfpVariantId(0)}`);
      expect(keys).not.toContain(`product:${mfpVariantId(1)}`);
    });

    it('τιμή που δεν υπάρχει πια λέγεται στην αναφορά · σβησμένη οικογένεια μετρά μία', () => {
      const report = (familyId: string, keys: readonly string[]) => selectPublicationContent({ ...base, families: [family], products: withKeys(() => keys), scope: filterScope(familyId, [keys]) }).report.missingSelectionCount;
      expect(report('fam', ['gone=1', 'gone=2'])).toBe(2);
      expect(report('other', ['gone=1'])).toBe(1);
    });
  });

  it('🔑 κάθε έκδοση δεδομένων μπαίνει στο κλειδί ιδεμποτίας', () => {
    const keys = selectPublicationContent(base).data.map((ref) => ref.key);
    expect(keys).toEqual(expect.arrayContaining([`product:${mfpVariantId(0)}`, `model:${MFP_MODEL_ID}`, 'family:fam']));
  });

  it('μετρά τις παραλλαγές που βγήκαν «ζητήστε προσφορά»', () => {
    const { report } = selectPublicationContent({ ...base, priceOf: (id) => (id === mfpVariantId(0) ? '10,00' : null) });
    expect(report.unpricedSkuCount).toBe(MFP_VARIANTS.length - 1);
  });

  it('🔴 §22 Υ5: προϊόν + τοποθέτηση ⇒ ΔΥΟ γραμμές τιμής, ποτέ άθροισμα', () => {
    const family = { ...base.families[0], listingKind: 'productWithInstallation', installationAttributeId: 'install' };
    const installation = { ...[...base.attributes.values()][0], id: 'install', type: 'reference', config: {} } as never;
    const withReference = base.products.map((product, index) => (index === 0
      ? { ...product, values: { ...product.values, install: { '*': { '*': { type: 'reference' as const, targets: [{ kind: 'product' as const, id: 'labour' }] } } } } }
      : product));
    const priceOf = (id: string) => (id === 'labour' ? '99,00' : '10,00');
    const attributes = new Map([...base.attributes, ['install', installation]]);
    const { chapters } = selectPublicationContent({ ...base, families: [family], attributes, products: withReference, priceOf });
    const entry = chapters[0].entries[0];
    expect(entry.listingKind).toBe('productWithInstallation');
    if (entry.kind !== 'variantModel') throw new Error('expected a family page');
    const row = (id: string) => entry.preview.rows.find((candidate) => candidate.id === id);
    const cellsOf = (id: string) => { const found = row(id); return found?.kind === 'attribute' ? found.cells : null; };
    expect(cellsOf('publication-price')?.[0]).toBe('10,00');
    expect(cellsOf('publication-installation-price')?.[0]).toBe('99,00');
    expect(cellsOf('publication-installation-price')?.[1]).toBe('Ζητήστε προσφορά');
    expect(entry.priceRowIds.has('publication-installation-price')).toBe(true);
  });
});

describe('preflightPrintImages', () => {
  const document = { sections: [{ id: 's', template: 'family' as const, blocks: [{ kind: 'image' as const, image: { assetId: 'a', alt: '', widthMm: 100 } }, { kind: 'image' as const, image: { assetId: 'b', alt: '', widthMm: 100 } }] }] };

  it('μετρά dpi στο τυπωμένο μέγεθος και εικόνες που δεν είναι CMYK', () => {
    const facts = (id: string) => (id === 'a' ? { widthPx: 1200, colourModel: 'cmyk' } : { widthPx: 1000, colourModel: 'rgb' });
    expect(preflightPrintImages(document, facts)).toEqual({ lowResolutionImageCount: 1, nonCmykImageCount: 1 });
  });

  it('100 mm = 3,94″ ⇒ 1181 px για 300 dpi', () => {
    expect(placedDpi(1181, 100)).toBeCloseTo(300, 0);
  });
});

describe('countUntransposedTables', () => {
  const table = (part: number, transposeUnmet: boolean) => ({ kind: 'table' as const, table: { part, transposeUnmet } as LayoutTable });

  it('🔴 ο πίνακας μετρά μία φορά, όσα μέρη κι αν έχει', () => {
    const blocks = [table(1, true), table(2, true), table(3, true), table(1, false), table(2, false)];
    expect(countUntransposedTables({ sections: [{ id: 's', template: 'family', blocks }] })).toBe(1);
  });
});

describe('μητρώο γραμματοσειρών (CHECK 3.69)', () => {
  const registry = JSON.parse(readFileSync('.font-assets.json', 'utf8')) as { readonly assets: Readonly<Record<string, { readonly spdx: string; readonly family: string }>> };

  it('🔴 κάθε αρχείο του εκδότη είναι δηλωμένο, TTF/OTF, με την ίδια οικογένεια', () => {
    for (const font of Object.values(PUBLICATION_FONTS)) {
      for (const file of font.files) {
        expect(file).toMatch(/\.(ttf|otf)$/);
        expect(registry.assets[file]?.family).toBe(font.family);
        expect(registry.assets[file]?.spdx).toBeTruthy();
      }
    }
  });
});

describe('validatePublicationRecipe', () => {
  const recipe: PublicationRecipeDefinition = {
    code: 'general', labels: { el: 'Γ' }, title: { el: 'Τ' }, scope: { kind: 'all' }, pricing: { kind: 'none' }, language: 'el',
    theme: { fontCode: 'liberationSans', logoAssetId: null, primary: { rgb: '#003366', cmyk: [1, 2, 3, 4] }, accent: { rgb: '#cc0000', cmyk: [0, 0, 0, 0] } },
    templates: { enabled: [], groupStyle: 'band', gridColumns: 3 }, profiles: ['print'], paper: 'a4', footerNote: {},
  };
  const codes = (value: PublicationRecipeDefinition) => validatePublicationRecipe(value).map((issue) => issue.code);

  it('έγκυρη ⇒ κανένα εύρημα', () => expect(codes(recipe)).toEqual([]));
  it('🔴 γραμματοσειρά εκτός μητρώου', () => expect(codes({ ...recipe, theme: { ...recipe.theme, fontCode: 'comic' as never } })).toEqual(['publicationFontNotLicensed']));
  it('χρώμα εκτός ορίων', () => expect(codes({ ...recipe, theme: { ...recipe.theme, primary: { rgb: '#003366', cmyk: [101, 0, 0, 0] } } })).toEqual(['publicationColourInvalid']));
  it('τίτλος στη γλώσσα της έκδοσης', () => expect(codes({ ...recipe, language: 'en' })).toEqual(['publicationTitleRequired']));
  it('τουλάχιστον ένα προφίλ', () => expect(codes({ ...recipe, profiles: [] })).toEqual(['publicationProfileRequired']));
  it('κενό εύρος', () => expect(codes({ ...recipe, scope: { kind: 'categories', categoryIds: [] } })).toEqual(['publicationScopeEmpty']));
  it('φίλτρο χωρίς οικογένεια', () => expect(validatePublicationRecipe({ ...recipe, scope: { kind: 'filter', filter: { familyId: null, facetGroups: [] } } })).toEqual([{ code: 'publicationScopeEmpty', path: 'scope.filter.familyId' }]));
  it('φίλτρο με οικογένεια, χωρίς φίλτρα ιδιοτήτων', () => expect(codes({ ...recipe, scope: { kind: 'filter', filter: { familyId: 'fam', facetGroups: [] } } })).toEqual([]));
});
