/**
 * ADR-923 §5.2 / §5.6 / §22 — τι μπαίνει σε μια έκδοση: εύρος, φρένο πληρότητας, κεφάλαια, ραφή `listingKind`, προέλεγχος,
 * μητρώο γραμματοσειρών, επικύρωση συνταγής.
 */
import { readFileSync } from 'node:fs';

import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_VARIANTS, mfpVariantId } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { PublicationRecipeDefinition } from '../../types/publication';
import { selectPublicationContent, type PublicationDataSet, type StoredProduct } from '../publication-chapters';
import { PUBLICATION_FONTS } from '../publication-fonts';
import { placedDpi, preflightPrintImages } from '../publication-preflight';
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

  it('εύρος `selection`: ό,τι δεν επιλέχθηκε μένει απέξω', () => {
    expect(selectPublicationContent({ ...base, scope: { kind: 'selection', entries: [{ kind: 'productModel', id: 'other' }] } }).chapters).toEqual([]);
    expect(selectPublicationContent({ ...base, scope: { kind: 'selection', entries: [{ kind: 'productModel', id: MFP_MODEL_ID }] } }).chapters).toHaveLength(1);
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
});
