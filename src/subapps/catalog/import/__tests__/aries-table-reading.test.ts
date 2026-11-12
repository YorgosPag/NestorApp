/**
 * Ε1–Ε5 πάνω στις **πραγματικές** σελίδες 85–86 της Aries, χωρίς AI (ADR-923 §5.5.1). Τι απάντησε το μοντέλο το ορίζει το test, και
 * δεν περιέχει ούτε μία τιμή: οι τιμές έρχονται μόνο από το PDF. Οι ισχυρισμοί στηρίζονται στα κριτήρια της δεύτερης δοκιμής, όπου
 * 0/140 πεδία επιβεβαιώθηκαν, 17/17 γραμμές βγήκαν `create` και 14/14 παραλλαγές είχαν `axisValueMissing`.
 */

import ARIES from '../../__tests__/fixtures/aries-page-structure.data.json';
import { schemaSnapshotOf } from '../../aggregate/edit-aggregate';
import { MFP_ASSETS, MFP_MODEL, MFP_SETTINGS } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { reconstructPageTables } from '@/lib/pdf-tables/reconstruct-page-tables';
import type { PageRule, PageTable } from '@/lib/pdf-tables/page-table-types';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { ExtractedCell, ExtractedGroup, ImportLineOverride, ImportPageUnmappedLine, ImportProposalField, ImportProposalRow } from '../../types/catalog-import';
import { applyLineOverrides, pendingUnmappedLines } from '../page-line-overrides';
import { buildAttributeRows, type AttributeProposalContext, type LiveHolder } from '../build-attribute-proposal';
import { EMPTY_LIVE_TRADE_IDENTITY } from '../trade-identity-fields';
import { judgeProposal } from '../judge-proposal';
import { evidenceFindings, type PageExtractionContext } from '../page-extraction';
import { pageMappingPrompt, pageMappingSchema, imageCheckCells, textLayerDoubted, type RawTableMapping } from '../page-table-mapping';
import { readPageTables, tableLineIdentities, type PageTableContext } from '../page-table-reading';
import { learnedDecisions, learnedEntry, memoryKeyOf, memoryOverridesFor, type LabelMemoryBook } from '../label-memory';
import { readPageWithDecisions } from '../page-decisions-reading';
import { anchorForCell, tokenizePage, unitPrintedBeside } from '../page-tokens';
import { corroborationsOf, selectOptionFor } from '../proposal-values';

type AriesPage = '85' | '86';

const schema = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const text = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };
const attributesByCode = new Map([...MFP_ATTRIBUTE_MAP].map(([id, attribute]) => [attribute.code, { ...attribute, id }]));

const tokensOf = (page: AriesPage) => tokenizePage(ARIES[page].items);
const tablesOf = (page: AriesPage): PageTable[] =>
  reconstructPageTables({ words: tokensOf(page), rules: ARIES[page].rules as readonly PageRule[], tagTables: ARIES[page].tagTables });

const contextOf = (page: AriesPage, tables = tablesOf(page)): PageTableContext => ({
  page: Number(page),
  tables,
  attributesByCode,
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  axisAttributeIds: ['size'],
});

const lineOf = (table: PageTable, printed: string): number => {
  const cell = table.cells.find((candidate) => candidate.text === printed);
  if (!cell) throw new Error(`ο πίνακας δεν τυπώνει «${printed}»`);
  return cell.row;
};

/** Η απάντηση ενός ειλικρινούς μοντέλου: μόνο «ποια γραμμή είναι τι», με αφετηρία κάποια τιμή της γραμμής. */
function variantsMapping(table: PageTable, lines: readonly (readonly [string, string])[], confidence = 0.95): RawTableMapping {
  return { table: table.key, role: 'variants', variantsIn: 'columns', imageCheck: [], lines: lines.map(([printed, attribute]) => ({ line: lineOf(table, printed), attribute, confidence })) };
}

const accessories = (table: PageTable): RawTableMapping => ({ table: table.key, role: 'accessories', variantsIn: 'rows', lines: [], imageCheck: [] });

const PAGE_85_LINES = [
  ['1800', 'cooling_h'], ['1458', 'cooling_m'], ['1134', 'cooling_l'],
  ['2700', 'heating_h'], ['1950', 'heating_m'], ['1290', 'heating_l'],
  ['340', 'airflow_h'], ['280', 'airflow_m'], ['180', 'airflow_l'],
  ['15,4', 'weight'],
] as const;

/** Στη σελ. 85 το «2700» τυπώνεται και στην ψύξη: η γραμμή θέρμανσης δείχνεται από τιμή που τυπώνεται μόνο εκεί. */
const page85Lines = PAGE_85_LINES.map(([printed, attribute]) => [attribute === 'heating_h' ? '13500' : printed, attribute] as const);
const PAGE_86_LINES = [['1000', 'cooling_h'], ['800', 'cooling_m'], ['14,5', 'weight']] as const;

function readPage(page: AriesPage, lines: readonly (readonly [string, string])[]) {
  const context = contextOf(page);
  const [main, parts] = context.tables;
  return readPageTables({ tables: [variantsMapping(main, lines), accessories(parts)] }, context);
}

const attributeOf = (cell: ExtractedCell): string | null => (cell.target.kind === 'attribute' ? cell.target.attributeId : null);
const cellsOf = (group: ExtractedGroup, attribute: string): readonly ExtractedCell[] => group.rows.flatMap((row) => row.cells).filter((cell) => attributeOf(cell) === attribute);

function liveOf(code: string, index: number): LiveHolder {
  return { id: `cpr_${index}`, revision: 1, values: { model_code: { '*': { '*': { type: 'text', text: code } } }, size: { '*': { '*': { type: 'select', optionCode: 'mfp_34' } } } }, noValueReasons: {}, trade: EMPTY_LIVE_TRADE_IDENTITY };
}

/** Ό,τι κάνει ο `matchRows` στον διακομιστή: ο κωδικός της γραμμής που κρατά ζωντανό SKU. */
function matchesOf(group: ExtractedGroup, codes: readonly string[]): AttributeProposalContext['matches'] {
  return new Map(group.rows.flatMap((row) => {
    const index = codes.findIndex((code) => row.cells.some((cell) => attributeOf(cell) === 'model_code' && cell.text === code));
    return index === -1 ? [] : [[row.rowKey, liveOf(codes[index], index)] as const];
  }));
}

const CODES_85 = ['099-01-001', '099-01-002', '099-01-003', '099-01-004', '099-01-005', '099-01-006', '099-01-007'];

function rowsAgainstLive(group: ExtractedGroup, codes: readonly string[]): readonly ImportProposalRow[] {
  const context: AttributeProposalContext = { schema, text, model: null, matches: matchesOf(group, codes), base: new Map() };
  return buildAttributeRows({ ...group, modelCode: MFP_MODEL.code }, context).filter((row) => row.holderKind === 'product');
}

const fieldOf = (row: ImportProposalRow, attribute: string): ImportProposalField | undefined =>
  row.fields.find((field) => field.target.kind === 'attribute' && field.target.attributeId === attribute);

describe('🔴 Το κριτήριο της δεύτερης δοκιμής', () => {
  const { groups, setAside, findings } = readPage('85', page85Lines);
  const [group] = groups;

  it('Ε2: 7/7 παραλλαγές ταυτίζονται με τα ζωντανά SKU, χωρίς το μοντέλο να αντιστοιχίσει καμία γραμμή κωδικών', () => {
    const rows = rowsAgainstLive(group, CODES_85);
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.action)).toEqual(Array(7).fill('update'));
    expect(rows.map((row) => row.label)).toEqual(CODES_85);
    expect(page85Lines.some(([, attribute]) => attribute === 'model_code')).toBe(false);
  });

  it('Ε1: κάθε τιμή επιβεβαιωμένη, με περιοχή, καμία απόφαση λόγω απόδειξης', () => {
    const cells = group.rows.flatMap((row) => row.cells);
    expect(cells.length).toBeGreaterThan(70);
    expect(cells.every((cell) => cell.anchor?.kind === 'page' && cell.anchor.verified === true && cell.anchor.regions.length > 0)).toBe(true);
    expect(evidenceFindings(groups)).toEqual([]);
    const fields = rowsAgainstLive(group, CODES_85).flatMap((row) => row.fields);
    expect(fields.flatMap((field) => field.issues.map((issue) => issue.code))).not.toContain('unitUnconfirmed');
    expect(fields.flatMap((field) => field.issues.map((issue) => issue.code))).not.toContain('measurementUnitMissing');
  });

  it('Ε1: η μονάδα έρχεται από το κελί της γραμμής, και το ενωμένο m³/h φτάνει και στις τρεις', () => {
    expect(cellsOf(group, 'cooling_m')[0]).toMatchObject({ text: '1458', unitCode: 'W' });
    expect(cellsOf(group, 'weight')[1]).toMatchObject({ text: '18,00', unitCode: 'kg' });
    expect(['airflow_h', 'airflow_m', 'airflow_l'].map((attribute) => cellsOf(group, attribute)[6].unitCode)).toEqual(['m³/h', 'm³/h', 'm³/h']);
    const [first] = rowsAgainstLive(group, CODES_85);
    expect(fieldOf(first, 'cooling_m')?.incoming).toEqual({ type: 'measurement', amount: '1458', unitCode: 'W' });
  });

  it('Ε3: ο πίνακας εξαρτημάτων δεν γίνεται πρόταση, και μένει δηλωμένος', () => {
    expect(groups).toHaveLength(1);
    expect(setAside).toEqual([{ page: 85, table: 't1', role: 'accessories', rows: 5, label: 'ΚΩΔΙΚΟΣ · ΠΕΡΙΓΡΑΦΗ · ΤΙΜΗ (€)' }]);
    expect(JSON.stringify(groups)).not.toContain('099-01-010');
    expect(findings).toEqual([]);
  });

  it('Ε4: καμία παραλλαγή χωρίς άξονα, ακόμη κι όταν δεν υπάρχει ζωντανό SKU', () => {
    expect(cellsOf(group, 'size').map((cell) => cell.text)).toEqual(['MFP-34ΤΜ', 'MFP-51ΤΜ', 'MFP-68ΤΜ', 'MFP-85ΤΜ', 'MFP-102ΤΜ', 'MFP-136ΤΜ', 'MFP-170ΤΜ']);
    const rows = buildAttributeRows({ ...group, modelCode: 'mfp' }, { schema, text, model: null, matches: new Map(), base: new Map() });
    const verdict = judgeProposal({ rows, modelCode: 'mfp', familyId: 'fan_coil', categoryIds: [], holdings: { rootModel: null, products: new Map() }, schema, refs: { assets: MFP_ASSETS, categories: new Set(['cat_fan_coils']), references: new Map() } });
    expect(JSON.stringify(verdict.rows)).not.toContain('axisValueMissing');
  });
});

describe('🔴 Σελίδα 86: το σφάλμα ×1000', () => {
  const { groups } = readPage('86', PAGE_86_LINES);
  const [group] = groups;

  it('1000 με W από τη γραμμή του, ποτέ kW', () => {
    expect(cellsOf(group, 'cooling_h')[0]).toMatchObject({ text: '1000', unitCode: 'W' });
  });

  it('η γραμμή Btu/h μπαίνει χωρίς το μοντέλο, και η ανεξάρτητη διασταύρωση ασκείται', () => {
    expect(cellsOf(group, 'cooling_h').filter((cell) => cell.unitCode === 'BTU/h').map((cell) => cell.text)).toEqual(['3412', '6142', '8189', '10236']);
    const field = fieldOf(rowsAgainstLive(group, [])[0], 'cooling_h');
    expect(field).toMatchObject({ incoming: { amount: '1000', unitCode: 'W' }, issues: [] });
  });

  it('το 3412 που γίνεται 34120 πιάνεται: η δεύτερη μονάδα καταγγέλλει την πρώτη', () => {
    const [row] = group.rows;
    const doubled = { ...group, rows: [{ ...row, cells: row.cells.map((cell) => (cell.text === '3412' ? { ...cell, text: '34120' } : cell)) }] };
    expect(fieldOf(rowsAgainstLive(doubled, [])[0], 'cooling_h')?.issues.map((issue) => issue.code)).toEqual(['attributeRepeated']);
  });

  it('Ε7: η συμφωνία σε Btu/h φαίνεται στο πεδίο, χωρίς να ζητά απόφαση', () => {
    const field = fieldOf(rowsAgainstLive(group, [])[0], 'cooling_h');
    expect(field?.issues).toEqual([]);
    expect(field?.corroboratedBy).toHaveLength(1);
    expect(corroborationsOf(field ?? {})[0]?.text).toContain('3412');
  });

  it('§5.5.2 Β8 (α): η επιβεβαίωση κρατά τη θέση του κελιού της, όπως η εναλλακτική', () => {
    const cell = group.rows[0].cells.find((candidate) => candidate.text === '3412');
    const field = fieldOf(rowsAgainstLive(group, [])[0], 'cooling_h');
    const [corroboration] = corroborationsOf(field ?? {});
    expect(corroboration?.anchor?.kind).toBe('page');
    expect(corroboration?.anchor).toEqual(cell?.anchor);
  });

  it('Ε7: η διαφωνία δεν είναι επιβεβαίωση', () => {
    const [row] = group.rows;
    const doubled = { ...group, rows: [{ ...row, cells: row.cells.map((cell) => (cell.text === '3412' ? { ...cell, text: '34120' } : cell)) }] };
    expect(fieldOf(rowsAgainstLive(doubled, [])[0], 'cooling_h')?.corroboratedBy).toBeUndefined();
  });
});

describe('🔴 Ε7: καμία γραμμή με τιμές δεν χάνεται σιωπηλά (σελ. 86)', () => {
  const { unmappedLines } = readPage('86', PAGE_86_LINES);
  const valuesOf = (printed: string) => unmappedLines.find((entry) => entry.values.includes(printed));

  it('οι γραμμές χωρίς ιδιότητα δηλώνονται, με ετικέτα και τιμές', () => {
    expect(valuesOf('0,17')?.values).toEqual(['0,17', '0,26', '0,34', '0,43']);
    expect(valuesOf('0,17')?.label).not.toBe('');
    expect(valuesOf('574,74')).toBeDefined();
    expect(unmappedLines.every((entry) => entry.page === 86)).toBe(true);
  });

  it('ό,τι έγινε πεδίο, επιβεβαίωση ή υποψήφιος κωδικός δεν δηλώνεται ως χαμένο', () => {
    for (const printed of ['1000', '800', '14,5', '3412', '099-02-001']) expect(valuesOf(printed)).toBeUndefined();
  });

  it('ο πίνακας εξαρτημάτων μένει στην άκρη ολόκληρος, όχι γραμμή-γραμμή', () => {
    expect(valuesOf('126,00')).toBeUndefined();
  });

  it('κάθε γραμμή μία φορά', () => {
    const keys = unmappedLines.map((entry) => `${entry.table}:${entry.line}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('Ε1: η μονάδα κρίνεται με τη γραμμή της', () => {
  it('🔴 γραμμή αντιστοιχισμένη σε ποσότητα που δεν τυπώνει: χωρίς μονάδα, με εύρημα, ποτέ η μονάδα της ιδιότητας', () => {
    const { groups, findings } = readPage('85', [['1800', 'cooling_h'], ['37', 'cooling_m']]);
    expect(cellsOf(groups[0], 'cooling_m')[0]).toMatchObject({ unitCode: null });
    expect(findings).toEqual([expect.stringContaining('cooling_m')]);
  });

  it('χαμηλή βεβαιότητα αντιστοίχισης ζητά άνθρωπο, όσο σωστή κι αν είναι η τιμή', () => {
    const context = contextOf('85');
    const [main, parts] = context.tables;
    const { groups } = readPageTables({ tables: [variantsMapping(main, page85Lines, 0.5), accessories(parts)] }, context);
    expect(fieldOf(rowsAgainstLive(groups[0], [])[0], 'cooling_h')?.decision).toBe('pending');
  });

  it('τιμή που δεν ανέφερε το μοντέλο βρίσκεται από εμάς, και μόνο ολόκληρη', () => {
    const tokens = new Map(tokensOf('85').map((token) => [token.id, token]));
    expect(anchorForCell(85, '1458', [], tokens)).toMatchObject({ verified: true });
    expect(anchorForCell(85, '145', [], tokens)).toMatchObject({ verified: false, regions: [] });
  });

  it('🔴 μονάδα χωρίς κελί: μετρά η γραμμή ή η στήλη της τιμής, όχι το ότι υπάρχει στη σελίδα', () => {
    const tokens = new Map(tokensOf('85').map((token) => [token.id, token]));
    expect(unitPrintedBeside('W', '1458', tokens)).toBe(true);
    expect(unitPrintedBeside('Btu/h', '1458', tokens)).toBe(false);
    expect(unitPrintedBeside('Btu/h', '6142', tokens)).toBe(true);
  });
});

describe('Ε2 / Ε4: χωρίς μαντεψιές', () => {
  it('οι διαστάσεις δεν είναι κωδικός: τυπώνουν μονάδα', () => {
    const [group] = readPage('85', page85Lines).groups;
    expect(cellsOf(group, 'model_code').map((cell) => cell.text)).not.toContain('858x596x250');
  });

  it('κανένα ζωντανό SKU: ο άνθρωπος βλέπει και τις δύο σειρές κωδικών', () => {
    const [group] = readPage('85', page85Lines).groups;
    const [row] = rowsAgainstLive(group, []);
    expect(fieldOf(row, 'model_code')?.issues[0]).toMatchObject({ code: 'attributeRepeated' });
  });

  it('§5.5.2 Β8: η άλλη τιμή ταξιδεύει ΔΟΜΗΜΕΝΗ, με το κελί της — ίδιο κείμενο με το μήνυμα', () => {
    const [group] = readPage('85', page85Lines).groups;
    const field = fieldOf(rowsAgainstLive(group, [])[0], 'model_code');
    const codes = cellsOf(group, 'model_code').filter((cell) => cell.text !== field?.sourceText);
    expect(field?.alternatives?.map((alternative) => alternative.text)).toEqual([field?.issues[0]?.params?.others]);
    expect(field?.alternatives?.[0]?.anchor).toEqual(codes.find((cell) => cell.text === field?.alternatives?.[0]?.text)?.anchor);
  });

  it('§5.5.2 Β8: επιβεβαίωση (ίδιο μέγεθος σε δύο μονάδες) δεν είναι εναλλακτική', () => {
    expect(fieldOf(rowsAgainstLive(readPage('85', page85Lines).groups[0], [])[0], 'cooling_h')?.alternatives).toBeUndefined();
  });

  const size = attributesByCode.get('size');

  it('επιλογή με μονοσήμαντη αρχή, ανεξάρτητα από ελληνικό ή λατινικό Τ', () => {
    expect(size && selectOptionFor(size, 'MFP-34ΤΜ')).toBe('mfp_34');
    expect(size && selectOptionFor(size, 'MFP-34TM')).toBe('mfp_34');
    expect(size && selectOptionFor(size, 'MFP-20CM')).toBeNull();
  });

  it('το «MFP-3» δεν πιάνει το «MFP-34», ούτε το «MFP-1» το «MFP-102»', () => {
    const one = { ...size, config: { options: [{ code: 'mfp_3', labels: { el: 'MFP-3' } }] } } as NonNullable<typeof size>;
    expect(selectOptionFor(one, 'MFP-34ΤΜ')).toBeNull();
  });

  const optionsOf = (labels: readonly string[]) =>
    ({ ...size, config: { options: labels.map((label) => ({ code: label, labels: { el: label } })) } }) as NonNullable<typeof size>;

  it('σελ. 85: «3/4’’-3/4’’» (δύο U+2019, όπως στο text layer) → «3/4"»· το «1"» δεν πιάνει το «1-1/4"»', () => {
    const inches = optionsOf(['1/2"', '3/4"', '1"', '1-1/4"']);
    expect(ARIES['85'].items.some((item) => item.text ==='3/4’’-3/4’’')).toBe(true);
    expect(selectOptionFor(inches, '3/4’’-3/4’’')).toBe('3/4"');
    expect(selectOptionFor(inches, '1″')).toBe('1"');
    expect(selectOptionFor(inches, '1-1/4’’')).toBe('1-1/4"');
  });

  it('σελ. 85: «dn 20» → «DN 20», όχι «DN 2»', () => {
    expect(selectOptionFor(optionsOf(['DN 15', 'DN 2', 'DN 20', 'DN 25']), 'dn 20')).toBe('DN 20');
  });
});

describe('Ε3 / Ε5: η αντιστοίχιση που δεν στέκει', () => {
  it('πίνακας «παραλλαγών» χωρίς αντιστοιχίσεις μπαίνει στην άκρη, με ανατροφοδότηση', () => {
    const { groups, setAside, findings } = readPage('85', []);
    expect(groups).toEqual([]);
    expect(setAside.map((entry) => entry.role)).toEqual(['unmapped', 'accessories']);
    expect(findings).toEqual([expect.stringContaining('t0')]);
  });

  it('πίνακας χωρίς απάντηση ζητείται ξανά', () => {
    const context = contextOf('85');
    expect(readPageTables({ tables: [] }, context).findings).toHaveLength(2);
  });
});

describe('Το συμβόλαιο με το μοντέλο', () => {
  const [main] = tablesOf('85');

  it('🔴 το σχήμα δεν έχει πεδίο τιμής: ό,τι δεν γράφει, δεν το επινοεί', () => {
    const schemaText = JSON.stringify(pageMappingSchema(['cooling_h']));
    expect(schemaText).not.toContain('"value"');
    expect(schemaText).not.toContain('"unit"');
    expect(schemaText).toContain('"seen"');
  });

  it('η εντολή δίνει το πλέγμα με τις γραμμές και τα κελιά ελέγχου, όχι τη μονάδα της ιδιότητας', () => {
    const prompt = pageMappingPrompt([{ code: 'cooling_h', label: 'Ψύξη H', description: null, type: 'measurement', level: 'variant', unique: false, options: [] }], [main], []);
    expect(prompt).toContain('Table t0:');
    expect(prompt).toContain('1458');
    expect(prompt).toContain('Check cells:');
    expect(prompt).not.toContain('kW');
  });
});

describe('🚀 Η εικόνα ελέγχει τη στρώση κειμένου', () => {
  const [main] = tablesOf('85');
  const cells = imageCheckCells(main);
  const idOf = (row: number, col: number): string => `r${row}c${col}`;
  const answer = (seen: (printed: string, index: number) => string | null) => ({ imageCheck: cells.map((cell, index) => ({ cell: idOf(cell.row, cell.col), seen: seen(cell.text, index) })) });

  it('διαλέγονται διασκορπισμένα κελιά, με σταθερή επιλογή', () => {
    expect(cells).toHaveLength(6);
    expect(new Set(cells.map((cell) => cell.row)).size).toBeGreaterThan(3);
    expect(imageCheckCells(main)).toEqual(cells);
  });

  it('ίδια κελιά ⇒ καμία αμφιβολία, και ένα ολίσθημα ανάγνωσης δεν κρίνει τη στρώση', () => {
    expect(textLayerDoubted(main, answer((printed) => printed))).toBe(false);
    expect(textLayerDoubted(main, answer((printed, index) => (index === 0 ? '999' : printed)))).toBe(false);
  });

  it('🔴 χαλασμένη κωδικοποίηση: η μαζική διαφωνία εγκαταλείπει τη διαδρομή', () => {
    const context = contextOf('85');
    const mapping = { ...variantsMapping(context.tables[0], page85Lines), ...answer(() => '7') };
    expect(readPageTables({ tables: [mapping, accessories(context.tables[1])] }, context).doubted).toBe(true);
  });

  it('ό,τι δεν διαβάστηκε στην εικόνα δεν είναι διαφωνία', () => {
    expect(textLayerDoubted(main, answer(() => null))).toBe(false);
  });
});

describe('Ο δεύτερος μάρτυρας', () => {
  it('🔴 διαφωνία ετικετών: κάθε τιμή του πίνακα ζητά άνθρωπο', () => {
    const tables = reconstructPageTables({ words: tokensOf('85'), rules: ARIES['85'].rules as readonly PageRule[], tagTables: [{ rows: [['ΚΩΔΙΚΟΣ', '1458']] }] });
    expect(tables[0].witness).toBe('disputed');
    const context = contextOf('85', tables);
    const { groups } = readPageTables({ tables: [variantsMapping(tables[0], page85Lines), accessories(tables[1])] }, context);
    expect(fieldOf(rowsAgainstLive(groups[0], [])[0], 'cooling_h')).toMatchObject({ decision: 'pending', issues: [expect.objectContaining({ code: 'tableStructureDisputed' })] });
  });
});

describe('Η όραση μένει ζώνη ασφαλείας (Ε5)', () => {
  const context: PageExtractionContext = { page: 85, tokens: new Map(), attributesByCode };
  const unproved = (verified: boolean | null): ExtractedCell => ({ target: { kind: 'modelCode' }, text: 'x', confidence: 0.6, anchor: { kind: 'page', page: context.page, regions: [], verified }, unitCode: null, flags: [] });
  const groupOf = (cells: readonly ExtractedCell[]): ExtractedGroup => ({ groupKey: 'g', modelCode: null, sharedCells: [], rows: [{ rowKey: 'r', cells }], pages: [85] });

  it('🔴 κατάρρευση επιβεβαίωσης είναι λόγος επανάληψης', () => {
    expect(evidenceFindings([groupOf(Array(8).fill(unproved(false)))])).toHaveLength(1);
  });

  it('σαρωμένη σελίδα ή λίγα πεδία δεν κρίνονται', () => {
    expect(evidenceFindings([groupOf(Array(8).fill(unproved(null)))])).toEqual([]);
    expect(evidenceFindings([groupOf(Array(2).fill(unproved(false)))])).toEqual([]);
  });
});

describe('🚀 §5.5.2 Β3: η απόφαση γραμμής ξαναδιαβάζει τον πίνακα χωρίς AI (σελ. 85)', () => {
  const context = contextOf('85');
  const [main, parts] = context.tables;
  /** Το μοντέλο «ξέχασε» την παροχή αέρα M: ακριβώς το εύρημα του Giorgio στη Fan coil. */
  const answer = variantsMapping(main, page85Lines.filter(([, attribute]) => attribute !== 'airflow_m'));
  const before = readPageTables({ tables: [answer, accessories(parts)] }, context);
  const codeById = new Map([...MFP_ATTRIBUTE_MAP].map(([id, attribute]) => [id, attribute.code]));
  const known = new Set(codeById.values());

  function airflowM(): ImportPageUnmappedLine {
    const line = before.unmappedLines.find((entry) => entry.line === lineOf(main, '280'));
    if (!line) throw new Error('η γραμμή «280» έπρεπε να μείνει χωρίς πεδίο');
    return line;
  }

  const decided = (decision: ImportLineOverride['decision']): ImportLineOverride =>
    ({ page: 85, table: main.key, line: airflowM().line, decision, by: 'usr_1', at: '2026-11-08T10:00:00.000Z' });

  it('χωρίς απόφαση: η γραμμή μένει χωρίς πεδίο, με τιμές και περιοχές για το PDF', () => {
    expect(airflowM().values).toContain('280');
    expect(airflowM().regions?.length ?? 0).toBeGreaterThan(0);
    expect(cellsOf(before.groups[0], 'airflow_m')).toHaveLength(0);
  });

  it('🔴 αντιστοίχιση ⇒ οι τιμές έρχονται από τον πίνακα, με βεβαιότητα 1 και μονάδα από τη γραμμή — και η γραμμή φεύγει από τις χωρίς πεδίο', () => {
    const { mapping } = applyLineOverrides(answer, [decided({ kind: 'attribute', attributeId: 'airflow_m' })], codeById, known);
    const after = readPageTables({ tables: [mapping, accessories(parts)] }, context);
    const cells = cellsOf(after.groups[0], 'airflow_m');
    expect(cells).toHaveLength(CODES_85.length);
    expect(cells.every((cell) => cell.confidence === 1 && cell.unitCode !== null)).toBe(true);
    expect(after.unmappedLines.some((entry) => entry.line === airflowM().line)).toBe(false);
  });

  it('ίδια απάντηση + ίδια απόφαση ⇒ ίδιο αποτέλεσμα (ντετερμινιστικό)', () => {
    const run = () => readPageTables({ tables: [applyLineOverrides(answer, [decided({ kind: 'attribute', attributeId: 'airflow_m' })], codeById, known).mapping, accessories(parts)] }, context);
    expect(run()).toEqual(run());
  });

  it('η αγνόηση δεν αλλάζει τίποτα στην ανάγνωση: μόνο βγάζει τη γραμμή από την εκκρεμότητα', () => {
    const ignored = decided({ kind: 'ignore' });
    expect(applyLineOverrides(answer, [ignored], codeById, known).mapping).toEqual(answer);
    expect(pendingUnmappedLines(before.unmappedLines, [ignored]).some((entry) => entry.line === airflowM().line)).toBe(false);
  });
});

describe('🚀 §5.5.2 Β4: η τιμή από την ίδια ανάγνωση της σελίδας (σελ. 86, «ΤΙΜΗ €»)', () => {
  const PRICE_TEXT = '574,74';

  function readPriced(edit: (tables: PageTable[], line: number) => PageTable[] = (tables) => tables) {
    const original = tablesOf('86');
    const line = lineOf(original[0], PRICE_TEXT);
    const tables = edit(original, line);
    const context: PageTableContext = { ...contextOf('86', tables), priceLinesByTable: new Map([[tables[0].key, [{ line, unitCode: 'pcs' }]]]) };
    return { line, reading: readPageTables({ tables: [variantsMapping(tables[0], PAGE_86_LINES), accessories(tables[1])] }, context) };
  }

  const priceCellsOf = (group: ExtractedGroup, field: 'netPrice' | 'unitCode'): readonly ExtractedCell[] =>
    group.rows.flatMap((row) => row.cells).filter((cell) => cell.target.kind === 'price' && cell.target.field === field);

  /** Αλλάζει ένα κελί του κύριου πίνακα, χωρίς να αγγίζει τα υπόλοιπα. */
  const withCell = (tables: PageTable[], pick: (cell: PageTable['cells'][number]) => boolean, change: (cell: PageTable['cells'][number]) => PageTable['cells'][number] | null): PageTable[] => {
    const [main, ...rest] = tables;
    const cells = main.cells.flatMap((cell) => (pick(cell) ? (change(cell) ?? []) : [cell]));
    return [{ ...main, cells }, ...rest];
  };

  it('🔴 δεύτερη πρόταση `priceLines` με τα ΙΔΙΑ `rowKey` με την πρόταση ιδιοτήτων: η τιμή ξέρει ποιο SKU είναι', () => {
    const { groups } = readPriced().reading;
    expect(groups.map((group) => [group.groupKey, group.purpose])).toEqual([['page:86:t0', undefined], ['page:86:t0:prices', 'priceLines']]);
    const [attributes, prices] = groups;
    expect(prices.rows.map((row) => row.rowKey)).toEqual(attributes.rows.map((row) => row.rowKey));
  });

  it('το ποσό έρχεται από το PDF με επιβεβαιωμένη περιοχή, η μονάδα από τον άνθρωπο, και το € του καταλόγου δεν είναι σύγκρουση', () => {
    const [, prices] = readPriced().reading.groups;
    const [first] = priceCellsOf(prices, 'netPrice');
    expect(first).toMatchObject({ text: PRICE_TEXT, flags: [], anchor: { kind: 'page', page: 86, verified: true } });
    expect(priceCellsOf(prices, 'unitCode').map((cell) => cell.text)).toEqual(Array(prices.rows.length).fill('pcs'));
  });

  it('🔴 η γραμμή τιμής δεν δηλώνεται ως χαμένη, ούτε γίνεται ιδιότητα', () => {
    const { reading } = readPriced();
    expect(reading.unmappedLines.some((entry) => entry.values.includes(PRICE_TEXT))).toBe(false);
    const attributeTexts = reading.groups[0].rows.flatMap((row) => row.cells).map((cell) => cell.text);
    expect(attributeTexts).not.toContain(PRICE_TEXT);
  });

  it('χωρίς απόφαση τιμής: καμία πρόταση τιμών, και η γραμμή μένει στις χωρίς πεδίο', () => {
    const { groups, unmappedLines } = readPage('86', PAGE_86_LINES);
    expect(groups.some((group) => group.purpose === 'priceLines')).toBe(false);
    expect(unmappedLines.some((entry) => entry.values.includes(PRICE_TEXT))).toBe(true);
  });

  it('🔴 ξένο νόμισμα στην ετικέτα ⇒ `currencyConflict`: η τιμή δεν μετατρέπεται ποτέ σιωπηλά', () => {
    const { reading } = readPriced((tables, line) => withCell(tables, (cell) => cell.row === line && cell.text.includes('€'), (cell) => ({ ...cell, text: cell.text.replace('€', '$') })));
    const [, prices] = reading.groups;
    expect(priceCellsOf(prices, 'netPrice')[0].flags).toEqual([{ code: 'currencyConflict', path: 'netPrice', params: { currency: '$', expected: 'EUR' } }]);
  });

  it('🔴 ενωμένο κελί τιμής (μία τιμή για δύο παραλλαγές) ⇒ `misaligned`, ποτέ σιωπηλό μοίρασμα', () => {
    const { reading } = readPriced((tables, line) => {
      const anchor = tables[0].cells.find((cell) => cell.text === PRICE_TEXT);
      if (!anchor) throw new Error(`ο πίνακας δεν τυπώνει «${PRICE_TEXT}»`);
      return withCell(tables, (cell) => cell.row === line && (cell.col === anchor.col || cell.col === anchor.col + 1), (cell) => (cell.col === anchor.col ? { ...cell, colSpan: 2 } : null));
    });
    const [, prices] = reading.groups;
    const merged = priceCellsOf(prices, 'netPrice').filter((cell) => cell.text === PRICE_TEXT);
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.every((cell) => cell.flags.some((flag) => flag.code === 'misaligned'))).toBe(true);
  });
});

describe('🚀 §5.5.2 Β5: η μνήμη του προμηθευτή, όλος ο κύκλος πάνω στη σελ. 85', () => {
  const context = contextOf('85');
  const [main, parts] = context.tables;
  const answer = variantsMapping(main, page85Lines.filter(([, attribute]) => attribute !== 'airflow_m'));
  const codeById = new Map([...MFP_ATTRIBUTE_MAP].map(([id, attribute]) => [id, attribute.code]));
  const schemaCodes = { codeById, knownCodes: new Set(codeById.values()) };
  const scope = { supplierContactId: 'cont_aries', familyId: 'cfam_fancoil' };
  const identities = tableLineIdentities(main, 'columns', PLATFORM_MEASUREMENT_REGISTRY);
  const airflowMLine = lineOf(main, '280');
  const stamp = { by: 'usr_1', at: '2026-11-09T10:00:00.000Z' };

  /** Ό,τι μαθαίνει η έγκριση από την απόφαση του ανθρώπου για την «παροχή αέρα M». */
  function taught(decision: ImportLineOverride['decision']) {
    const identity = identities.get(airflowMLine);
    if (!identity) throw new Error('η γραμμή «280» έπρεπε να έχει ταυτότητα');
    const human: ImportLineOverride = { page: 85, table: main.key, line: airflowMLine, decision, ...stamp, identity };
    const entry = learnedEntry(null, scope, { ...human, identity }, { batchId: 'cibat_old', ...stamp });
    return { identity, book: new Map([[entry.code, { id: 'cilm_1', decisions: entry.decisions }]]) };
  }

  const application = (book: LabelMemoryBook) => ({ scope, book, knownAttributeIds: new Set(codeById.keys()), pricesEnabled: false, stamp });

  it('η ταυτότητα της γραμμής χωρίς πεδίο είναι η ΙΔΙΑ με του κανόνα, και δεν περιέχει τη μονάδα', () => {
    const before = readPageTables({ tables: [answer, accessories(parts)] }, context);
    const line = before.unmappedLines.find((entry) => entry.line === airflowMLine);
    expect(line?.identity).toEqual(identities.get(airflowMLine));
    expect(line?.identity?.label).not.toBe('');
    expect(line?.identity?.unitCode).not.toBeNull();
  });

  it('🔴 οι τρεις παροχές αέρα (H · M · L) είναι τρία διαφορετικά κλειδιά: η μνήμη δεν τις μπερδεύει', () => {
    const keys = ['340', '280', '180'].map((printed) => {
      const identity = identities.get(lineOf(main, printed));
      if (!identity) throw new Error(`η γραμμή «${printed}» έπρεπε να έχει ταυτότητα`);
      return memoryKeyOf(scope, identity);
    });
    expect(new Set(keys).size).toBe(3);
  });

  it('🔴 νέα ανάγνωση με μνήμη ⇒ η «παροχή αέρα M» που ξέχασε το μοντέλο γίνεται 7 πεδία, χωρίς άνθρωπο', () => {
    const { book } = taught({ kind: 'attribute', attributeId: 'airflow_m' });
    const memory = memoryOverridesFor({ page: 85, table: main.key, identities }, [], application(book));
    expect(memory).toEqual([expect.objectContaining({ line: airflowMLine, origin: expect.objectContaining({ kind: 'memory', memoryId: 'cilm_1', count: 1 }) })]);
    const { reading } = readPageWithDecisions({ tables: [answer, accessories(parts)] }, context, memory, schemaCodes);
    expect(cellsOf(reading.groups[0], 'airflow_m')).toHaveLength(CODES_85.length);
    expect(reading.unmappedLines.some((entry) => entry.line === airflowMLine)).toBe(false);
  });

  it('🔴 σύγκρουση στο ιστορικό ⇒ τίποτα: η γραμμή μένει χωρίς πεδίο, για τον άνθρωπο', () => {
    const { identity, book } = taught({ kind: 'attribute', attributeId: 'airflow_m' });
    const [[key, entry]] = [...book];
    const conflicted = new Map([[key, { ...entry, decisions: learnedDecisions(entry.decisions, { kind: 'ignore' }, { batchId: 'cibat_2', ...stamp }) }]]);
    expect(memoryKeyOf(scope, identity)).toBe(key);
    expect(memoryOverridesFor({ page: 85, table: main.key, identities }, [], application(conflicted))).toEqual([]);
  });

  it('🔴 ανθρώπινη απόφαση στη γραμμή ⇒ η μνήμη δεν την αγγίζει', () => {
    const { book } = taught({ kind: 'attribute', attributeId: 'airflow_m' });
    const human: ImportLineOverride = { page: 85, table: main.key, line: airflowMLine, decision: { kind: 'ignore' }, ...stamp };
    expect(memoryOverridesFor({ page: 85, table: main.key, identities }, [human], application(book))).toEqual([]);
  });

  it('ιδιότητα που δεν υπάρχει πια στο σχήμα ⇒ η μνήμη δεν εφαρμόζεται (ποτέ δεν γεννά ούτε δένει ιδιότητα)', () => {
    const { book } = taught({ kind: 'attribute', attributeId: 'airflow_m' });
    const withoutIt = { ...application(book), knownAttributeIds: new Set([...codeById.keys()].filter((id) => id !== 'airflow_m')) };
    expect(memoryOverridesFor({ page: 85, table: main.key, identities }, [], withoutIt)).toEqual([]);
  });

  it('η ίδια λογική με το ξαναχτίσιμο: απόφαση ανθρώπου και απόφαση μνήμης δίνουν την ίδια ανάγνωση', () => {
    const { book } = taught({ kind: 'attribute', attributeId: 'airflow_m' });
    const memory = memoryOverridesFor({ page: 85, table: main.key, identities }, [], application(book));
    const human = memory.map(({ page, table, line, decision, by, at }) => ({ page, table, line, decision, by, at }));
    const read = (overrides: readonly ImportLineOverride[]) => readPageWithDecisions({ tables: [answer, accessories(parts)] }, context, overrides, schemaCodes).reading.groups;
    expect(read(memory)).toEqual(read(human));
  });
});
