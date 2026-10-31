/**
 * ADR-923 §5.6 — ο συνθέτης πάνω στην πραγματική οικογένεια MFP (σελ. 60): σειρά αξόνων, γραμμή τιμών, ευρετήριο κωδικών,
 * ντετερμινισμός, και 🔒 το αν φτάνει τιμή σε κατάλογο χωρίς τιμές.
 */
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_VARIANTS, mfpVariantId } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { PublicationRecipeDefinition } from '../../types/publication';
import type { InheritanceLink } from '../../values/resolve-inherited';
import { codeIndexEntries, composePublication, previewRecipeOf, type PublicationCompositionInput } from '../compose-publication';
import { collectLayoutAssetIds, countLayoutSections, type LayoutBlock, type LayoutTable } from '../layout-model';
import { variantModelEntry, type PublicationChapter, type VariantEntryInput, type VariantModelEntry } from '../publication-entries';
import { publicationInputHash, type PublicationInputs } from '../publication-input-hash';

const attributeById = new Map([...MFP_ATTRIBUTE_MAP].map(([id, attribute]) => [id, { ...attribute, id }]));
const words = { text: (value: Partial<Record<string, string>> | undefined, fallback?: string) => value?.el ?? fallback ?? '', yes: 'Ναι', no: 'Όχι', sample: 'δείγμα', price: 'Τιμή €', askForQuote: 'Ζητήστε προσφορά' };
const codec = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };
const modelLink: InheritanceLink = { id: MFP_MODEL_ID, kind: 'productModel', revision: 1, holder: MFP_MODEL };
const variants = MFP_VARIANTS.map((variant, index) => ({
  id: mfpVariantId(index),
  chain: [modelLink, { id: mfpVariantId(index), kind: 'product' as const, revision: 1, holder: variant }],
  identifier: `CODE-${index + 1}`,
  label: `MFP ${index + 1}`,
}));
const scheme = MFP_FAMILY.variantSchemes.find((candidate) => candidate.code === 'by_size')!;

const entryInput = (priceOf: VariantEntryInput['priceOf']): VariantEntryInput => ({
  id: 'mfp', family: MFP_FAMILY, scheme, model: modelLink, variants, attributeById, registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el', words, codec, priceOf,
});

const recipe: PublicationRecipeDefinition = {
  code: 'general',
  labels: { el: 'Γενικός' },
  title: { el: 'Κατάλογος' },
  scope: { kind: 'all' },
  pricing: { kind: 'none' },
  language: 'el',
  theme: { fontCode: 'liberationSans', logoAssetId: 'logo', primary: { rgb: '#003366', cmyk: [100, 70, 0, 40] }, accent: { rgb: '#cc0000', cmyk: [0, 100, 100, 10] } },
  templates: { enabled: ['cover', 'toc', 'chapterDivider', 'codeIndex', 'backCover'], groupStyle: 'rail', gridColumns: 3 },
  profiles: ['print', 'screen'],
  paper: 'a4',
  footerNote: {},
};

const chapter = (entry: VariantModelEntry): PublicationChapter => ({ id: 'fan-coils', title: 'Fan coils', entries: [entry] });
const composeInput = (entry: VariantModelEntry): PublicationCompositionInput => ({
  recipe, title: 'Κατάλογος', footer: 'Τιμές έκδοσης 3', chapters: [chapter(entry)],
  words: { contents: 'Περιεχόμενα', codeIndex: 'Ευρετήριο', tablePart: (part, parts) => `Μέρος ${part} από ${parts}` },
});
const entryOf = (priceOf: VariantEntryInput['priceOf']): VariantModelEntry => {
  const entry = variantModelEntry(entryInput(priceOf));
  if (!entry) throw new Error('MFP has a table spec');
  return entry;
};
const tablesOf = (blocks: readonly LayoutBlock[]): LayoutTable[] => blocks.flatMap((block) => (block.kind === 'table' ? [block.table] : []));

describe('variantModelEntry', () => {
  it('μία στήλη ανά παραλλαγή, με τη σειρά του άξονα', () => {
    const entry = entryOf(null);
    expect(entry.preview.columns).toHaveLength(MFP_VARIANTS.length);
  });

  it('🔑 η σειρά των στηλών δεν εξαρτάται από τη σειρά ανάγνωσης', () => {
    const shuffled = entryInput(null);
    const reversed = variantModelEntry({ ...shuffled, variants: [...shuffled.variants].reverse() });
    expect(reversed?.codes).toEqual(entryOf(null).codes);
  });

  it('🔒 χωρίς `priceOf` δεν υπάρχει καν γραμμή τιμής', () => {
    expect(entryOf(null).preview.rows.some((row) => row.id === 'publication-price')).toBe(false);
  });

  it('γραμμή τιμής ανά στήλη· παραλλαγή χωρίς τιμή ⇒ «Ζητήστε προσφορά», ποτέ κενό', () => {
    const entry = entryOf((id) => (id === mfpVariantId(0) ? '1.234,56' : null));
    const row = entry.preview.rows.find((candidate) => candidate.id === 'publication-price');
    expect(row?.kind === 'attribute' && row.cells?.[0]).toBe('1.234,56');
    expect(row?.kind === 'attribute' && row.cells?.[1]).toBe('Ζητήστε προσφορά');
  });

  it('`null` όταν η οικογένεια δεν δηλώνει πίνακα', () => {
    expect(variantModelEntry({ ...entryInput(null), family: { ...MFP_FAMILY, tableSpec: null } })).toBeNull();
  });
});

describe('composePublication', () => {
  const document = composePublication(composeInput(entryOf(null)));

  it('σειρά προτύπων: εξώφυλλο · περιεχόμενα · διαχωριστικό · οικογένεια · ευρετήριο · οπισθόφυλλο', () => {
    expect(document.sections.map((section) => section.template)).toEqual(['cover', 'toc', 'chapterDivider', 'family', 'codeIndex', 'backCover']);
    expect(countLayoutSections(document)).toBe(6);
  });

  it('χωρίς προαιρετικά πρότυπα μένει μόνο το σώμα', () => {
    const bare = composePublication({ ...composeInput(entryOf(null)), recipe: { ...recipe, templates: { ...recipe.templates, enabled: [] } } });
    expect(bare.sections.map((section) => section.template)).toEqual(['family']);
  });

  it('🔑 ντετερμινιστικό: δύο συνθέσεις = ίδιο JSON', () => {
    expect(JSON.stringify(composePublication(composeInput(entryOf(null))))).toBe(JSON.stringify(document));
  });

  it('το ευρετήριο δείχνει στην άγκυρα της ενότητας που τυπώνεται', () => {
    const family = document.sections.find((section) => section.template === 'family');
    const anchor = family?.blocks[0];
    const index = document.sections.find((section) => section.template === 'codeIndex')?.blocks[1];
    expect(anchor?.kind === 'anchor' && index?.kind === 'codeIndex' && index.entries[0].anchor === anchor.anchor).toBe(true);
  });

  it('συλλέγει το λογότυπο για τον φάκελο εργασίας, μία φορά', () => {
    expect(collectLayoutAssetIds(document).filter((id) => id === 'logo')).toEqual(['logo']);
  });

  it('🔒 τεχνικός κατάλογος: κανένα κελί ρόλου `price` σε ολόκληρο το έγγραφο', () => {
    const cells = document.sections.flatMap((section) => tablesOf(section.blocks)).flatMap((table) => table.rows).flatMap((row) => row.cells);
    expect(cells.some((cell) => cell.role === 'price')).toBe(false);
  });
});

describe('previewRecipeOf', () => {
  it('η πρώτη κατά κωδικό, ανεξάρτητα από τη σειρά ανάγνωσης · καμία ⇒ null', () => {
    expect(previewRecipeOf([{ code: 'b' }, { code: 'a' }])?.code).toBe('a');
    expect(previewRecipeOf([])).toBeNull();
  });
});

describe('στήλες που χωρούν στη σελίδα', () => {
  const eight = Array.from({ length: 8 }, () => new Map<string, string>());
  const grouped: VariantModelEntry = {
    ...entryOf(null),
    preview: { columns: eight, hiddenColumns: 0, rows: [{ kind: 'groupHeader', id: 'g', label: 'Ψύξη' }, { kind: 'attribute', id: 'kw', label: 'Ισχύς', unit: null, filter: null, merge: 'none', cells: eight.map(() => '1') }] },
  };
  const partsWith = (groupStyle: 'rail' | 'band'): number => {
    const composed = composePublication({ ...composeInput(grouped), recipe: { ...recipe, templates: { ...recipe.templates, groupStyle } } });
    return composed.sections.flatMap((section) => tablesOf(section.blocks)).length;
  };

  it('🔴 η στήλη `rail` τρώει πλάτος: οι 8 στήλες χωρούν σε `band`, όχι όμως δίπλα σε στήλη ομάδας', () => {
    expect(partsWith('band')).toBe(1);
    expect(partsWith('rail')).toBe(2);
  });
});

describe('codeIndexEntries', () => {
  it('φυσική σειρά: ο κωδικός 9 πριν από τον 10', () => {
    const entry = { ...entryOf(null), codes: [{ code: 'A-10', label: 'x' }, { code: 'A-9', label: 'y' }] };
    expect(codeIndexEntries([chapter(entry)], 'el').map((item) => item.code)).toEqual(['A-9', 'A-10']);
  });
});

describe('publicationInputHash — κλειδί ιδεμποτίας', () => {
  const inputs: PublicationInputs = {
    companyId: 'c1', recipe, data: [{ key: 'product:a', revision: 1 }, { key: 'product:b', revision: 2 }],
    audienceKey: 'customerGroup:w', pricing: [{ key: 'version:v', revision: 1 }], renderVersion: 'r1',
  };

  it('🔑 ανεξάρτητο από τη σειρά ανάγνωσης', () => {
    expect(publicationInputHash({ ...inputs, data: [...inputs.data].reverse() })).toBe(publicationInputHash(inputs));
  });

  it.each([
    ['αναθεώρηση δεδομένου', { data: [{ key: 'product:a', revision: 2 }, { key: 'product:b', revision: 2 }] }],
    ['🔒 κοινό', { audienceKey: 'customerGroup:r' }],
    ['έκδοση τιμών', { pricing: [{ key: 'version:v2', revision: 1 }] }],
    ['έκδοση απόδοσης', { renderVersion: 'r2' }],
    ['🔒 χώρος', { companyId: 'c2' }],
    ['γλώσσα συνταγής', { recipe: { ...recipe, language: 'en' as const } }],
  ])('αλλάζει με: %s', (_name, change) => {
    expect(publicationInputHash({ ...inputs, ...change })).not.toBe(publicationInputHash(inputs));
  });
});
