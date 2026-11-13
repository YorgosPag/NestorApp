/**
 * ADR-923 §21.6 — η γραμμή σύνθετης ένδειξης στον ΕΝΑ builder του πίνακα: δείγμα (προεπισκόπηση οικογένειας), πραγματικές
 * τιμές (πίνακας μοντέλου + εκδότης), και η διέλευσή της αυτούσια από τη διάταξη σελίδας (ό,τι δείχνει η οθόνη τυπώνεται).
 */
import { FULL_SUPPLY, SUPPLY, SUPPLY_ATTRIBUTES, supplyCodec } from '../../__tests__/fixtures/power-supply.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { layoutTables, type LayoutTableOptions } from '../../publishing/layout-table';
import { ZERO_WIDTH_SPACE } from '../../publishing/layout-text';
import type { CatalogFamilyDefinition, FamilyTableRow } from '../../types/family';
import { ANY_SLOT, type AttributeValue } from '../../types/product';
import { buildTablePreview, realTableColumn, type PreviewWords } from '../catalog-table';

const words: PreviewWords = { text: (value, fallback) => value?.el ?? fallback ?? '', yes: 'Ναι', no: 'Όχι', sample: 'τιμή' };

const compositeRow = (compositeId: string): FamilyTableRow => ({ kind: 'composite', id: `r_${compositeId}`, compositeId, labelOverride: null, merge: 'none' });

const family = (rows: readonly FamilyTableRow[]): CatalogFamilyDefinition => ({
  code: 'fan_coil', labels: { el: 'Fan coil' }, description: {},
  attributes: [...SUPPLY_ATTRIBUTES.keys()].map((attributeId) => ({ attributeId, requiredChannels: [] })),
  labelAttributeId: null, imageAttributeId: null,
  variantSchemes: [{ code: 's', labels: {}, levels: [{ axisAttributeIds: [], attributeIds: [...SUPPLY_ATTRIBUTES.keys()] }] }],
  tableSpec: { variantSchemeCode: 's', rows },
  consistencyRules: [], compositeDisplays: [SUPPLY],
});

const column = (values: Readonly<Record<string, AttributeValue>>) => realTableColumn({
  slotsOf: (id) => (values[id] ? { [ANY_SLOT]: { [ANY_SLOT]: values[id] } } : undefined),
  scheme: null,
  attributeById: SUPPLY_ATTRIBUTES,
  scope: { channel: 'print', locale: 'el' },
  codec: supplyCodec(),
});

const build = (rows: readonly FamilyTableRow[], values: readonly Readonly<Record<string, AttributeValue>>[] | null) =>
  buildTablePreview(family(rows), SUPPLY_ATTRIBUTES, PLATFORM_MEASUREMENT_REGISTRY, words, values ? values.map(column) : null);

describe('§21.6 γραμμή σύνθετης ένδειξης στον πίνακα', () => {
  it('πραγματικές τιμές: γραμμή τιμών χωρίς μονάδα στην κεφαλίδα (οι μονάδες είναι μέσα στην ένδειξη)', () => {
    const { voltage: _omit, ...partial } = FULL_SUPPLY;
    const [row] = build([compositeRow('cd_supply')], [FULL_SUPPLY, partial, {}])?.rows ?? [];
    expect(row).toEqual({
      kind: 'attribute', id: 'r_cd_supply', label: 'Ηλεκτρική παροχή', unit: null, filter: null, merge: 'none',
      // 🔑 μέρος που λείπει ⇒ «—», ποτέ σύμπτυξη· λείπουν όλα ⇒ κενό κελί
      cells: ['1~ 230 V 50 Hz', '1~ — 50 Hz', ''],
    });
  });

  it('ετικέτα γραμμής που διαφέρει από της ένδειξης', () => {
    const row: FamilyTableRow = { kind: 'composite', id: 'r', compositeId: 'cd_supply', labelOverride: { el: 'Παροχή' }, merge: 'all' };
    expect(build([row], [FULL_SUPPLY])?.rows[0]).toMatchObject({ label: 'Παροχή', merge: 'all' });
  });

  it('δείγμα (προεπισκόπηση οικογένειας): κελιά `null`, όπως κάθε γραμμή ιδιότητας', () => {
    expect(build([compositeRow('cd_supply')], null)?.rows[0]).toMatchObject({ kind: 'attribute', unit: null, cells: null });
  });

  it('ένδειξη που δεν υπάρχει ⇒ καμία γραμμή (την ονομάζει η επικύρωση), ποτέ κενή γραμμή στο χαρτί', () => {
    expect(build([compositeRow('cd_gone')], [FULL_SUPPLY])?.rows).toEqual([]);
  });

  it('η διάταξη σελίδας την τυπώνει αυτούσια: ετικέτα χωρίς «()» και κελί με την ένδειξη', () => {
    const preview = build([compositeRow('cd_supply')], [FULL_SUPPLY])!;
    const options: LayoutTableOptions = { id: 't', caption: 'c', groupStyle: 'band', maxValueColumns: 4, maxTransposedColumns: 4, overflow: 'continue', labelColumnMm: 50, railColumnMm: 10, priceRowIds: new Set() };
    const [table] = layoutTables(preview, options);
    expect(table.rows[0].cells.map((cell) => cell.text.replaceAll(ZERO_WIDTH_SPACE, ''))).toEqual(['Ηλεκτρική παροχή', '1~ 230 V 50 Hz']);
  });
});
