/**
 * ADR-923 §5.5.2 Β3 Γ13 — **μία γραμμή → περισσότερες ιδιότητες** (ARIES σελ. 85: «ΣΥΝΔΕΣΕΙΣ ΕΙΣΑΓ.-ΕΠΙΣΤΡΟΦΗ» → διάμετρος ψύξης
 * **και** θέρμανσης μονάδας 2 σωλήνων). Καθαρό: καμία κλήση, καμία ανάγνωση.
 */

import { setImportLineBodySchema } from '../../schema/zod/catalog-import.schema';
import type { ImportLineDecision, ImportLineOverride, ImportProposalRow } from '../../types/catalog-import';
import { IMPORT_LINE_MAX_TARGETS } from '../../vocabulary/catalog-import';
import { canAddLineTarget, decidedToolLineOf, type DecidedLine } from '../decided-lines';
import { sameLineDecision } from '../label-memory';
import { applyLineOverrides, decisionAttributeIds, stepAttributeIdOf, withAlsoAttribute } from '../page-line-overrides';
import type { RawTableMapping } from '../page-table-mapping';

const STAMP = { by: 'usr_1', at: '2026-11-12T10:00:00.000Z' } as const;
const COOLING = 'cattr_nominal_diameter_cooling';
const HEATING = 'cattr_nominal_diameter_heating';
const both: ImportLineDecision = { kind: 'attribute', attributeId: COOLING, alsoAttributeIds: [HEATING] };

const answer: RawTableMapping = { table: 't0', role: 'variants', variantsIn: 'columns', imageCheck: [], lines: [{ line: 14, attribute: 'weight', confidence: 0.4 }] };
const codeById = new Map([[COOLING, 'nominal_diameter_cooling'], [HEATING, 'nominal_diameter_heating'], ['cattr_weight', 'weight']]);
const known = new Set(codeById.values());
const override = (line: number, decision: ImportLineDecision): ImportLineOverride => ({ page: 85, table: 't0', line, decision, ...STAMP });

describe('Γ13 — όλοι οι στόχοι από έναν δρόμο', () => {
  it('η κύρια πρώτη, μετά οι υπόλοιπες· αποθηκευμένη απόφαση χωρίς λίστα = μία ιδιότητα', () => {
    expect(decisionAttributeIds(both)).toEqual([COOLING, HEATING]);
    expect(decisionAttributeIds({ kind: 'attribute', attributeId: COOLING })).toEqual([COOLING]);
    expect(decisionAttributeIds({ kind: 'axis', attributeId: COOLING })).toEqual([COOLING]);
    expect(decisionAttributeIds({ kind: 'ignore' })).toEqual([]);
  });

  it('«και αυτή» προσθέτει· ίδιος στόχος δεύτερη φορά = ίδια απόφαση· χωρίς αντιστοίχιση = τίποτα', () => {
    const added = withAlsoAttribute({ kind: 'attribute', attributeId: COOLING }, HEATING);
    expect(added).toEqual(both);
    expect(withAlsoAttribute(both, HEATING)).toBe(both);
    expect(withAlsoAttribute(both, COOLING)).toBe(both);
    expect(withAlsoAttribute({ kind: 'ignore' }, HEATING)).toBeNull();
    expect(withAlsoAttribute(null, HEATING)).toBeNull();
  });

  it('το βήμα (δέσιμο + αναίρεση) ονομάζει ό,τι πρόσθεσε η πράξη, όχι την κύρια', () => {
    expect(stepAttributeIdOf({ kind: 'attribute', attributeId: COOLING }, both)).toBe(HEATING);
    expect(stepAttributeIdOf(null, both)).toBe(COOLING);
    expect(stepAttributeIdOf(both, null)).toBeNull();
  });
});

describe('Γ13 — η απόφαση πάνω στην απάντηση του μοντέλου', () => {
  it('🔴 μία γραμμή ⇒ ένα δέσιμο ανά στόχο, με βεβαιότητα 1, αντί για ό,τι είχε πει το μοντέλο', () => {
    const { mapping, unknownAttributeIds } = applyLineOverrides(answer, [override(14, both)], codeById, known);
    expect(mapping.lines.filter((entry) => entry.line === 14)).toEqual([
      { line: 14, attribute: 'nominal_diameter_cooling', confidence: 1 },
      { line: 14, attribute: 'nominal_diameter_heating', confidence: 1 },
    ]);
    expect(unknownAttributeIds).toEqual([]);
  });

  it('🔴 δεύτερος στόχος έξω από το σχήμα ⇒ δηλώνεται (ο πυρήνας αρνείται όλη την απόφαση), όχι σιωπηλή μισή εφαρμογή', () => {
    const { unknownAttributeIds } = applyLineOverrides(answer, [override(14, { ...both, alsoAttributeIds: ['cattr_gone'] })], codeById, known);
    expect(unknownAttributeIds).toEqual(['cattr_gone']);
  });
});

describe('Γ13 — μνήμη του προμηθευτή', () => {
  it('ίδιοι στόχοι με άλλη σειρά = ίδια απόφαση· άλλη κύρια ή λιγότεροι στόχοι = άλλη', () => {
    const three: ImportLineDecision = { kind: 'attribute', attributeId: COOLING, alsoAttributeIds: [HEATING, 'cattr_x'] };
    expect(sameLineDecision(three, { ...three, alsoAttributeIds: ['cattr_x', HEATING] })).toBe(true);
    expect(sameLineDecision(both, { kind: 'attribute', attributeId: HEATING, alsoAttributeIds: [COOLING] })).toBe(false);
    expect(sameLineDecision(both, { kind: 'attribute', attributeId: COOLING })).toBe(false);
    expect(sameLineDecision({ kind: 'attribute', attributeId: COOLING }, { kind: 'axis', attributeId: COOLING })).toBe(false);
  });
});

describe('Γ13 — σχήμα του αιτήματος', () => {
  const body = (decision: unknown) => ({ page: 85, table: 't0', line: 14, decision, bind: null });
  const valid = 'cattr_' + 'a'.repeat(20);
  const other = 'cattr_' + 'b'.repeat(20);

  it('δέχεται δεύτερο στόχο', () => {
    expect(setImportLineBodySchema.safeParse(body({ kind: 'attribute', attributeId: valid, alsoAttributeIds: [other] })).success).toBe(true);
  });

  it('🔴 αρνείται διπλότυπο, την κύρια ξανά, κενή λίστα και πάνω από το όριο', () => {
    expect(setImportLineBodySchema.safeParse(body({ kind: 'attribute', attributeId: valid, alsoAttributeIds: [other, other] })).success).toBe(false);
    expect(setImportLineBodySchema.safeParse(body({ kind: 'attribute', attributeId: valid, alsoAttributeIds: [valid] })).success).toBe(false);
    expect(setImportLineBodySchema.safeParse(body({ kind: 'attribute', attributeId: valid, alsoAttributeIds: [] })).success).toBe(false);
    const many = Array.from({ length: IMPORT_LINE_MAX_TARGETS }, (_, index) => `cattr_${String(index).repeat(20)}`);
    expect(setImportLineBodySchema.safeParse(body({ kind: 'attribute', attributeId: valid, alsoAttributeIds: many })).success).toBe(false);
  });
});

describe('Γ13 — η αποφασισμένη γραμμή ως είσοδος του εργαλείου', () => {
  const entry: DecidedLine = { page: 85, table: 't0', line: 14, label: 'ΣΥΝΔΕΣΕΙΣ ΕΙΣΑΓ.-ΕΠΙΣΤΡΟΦΗ', values: [], decision: { kind: 'attribute', attributeId: COOLING }, origin: null };
  const field = (attributeId: string, sourceText: string) => ({ target: { kind: 'attribute', attributeId, channel: '*', locale: '*' }, sourceText });
  const rows = [
    { rowKey: 'v0', fields: [field(COOLING, '3/4’’-3/4’’'), field('cattr_weight', '24')] },
    { rowKey: 'v1', fields: [field(COOLING, '3/4’’-3/4’’')] },
  ] as unknown as readonly ImportProposalRow[];

  it('οι τιμές έρχονται από τα πεδία της κύριας, στη σειρά των παραλλαγών', () => {
    expect(decidedToolLineOf(entry, rows)).toEqual({ page: 85, table: 't0', line: 14, label: 'ΣΥΝΔΕΣΕΙΣ ΕΙΣΑΓ.-ΕΠΙΣΤΡΟΦΗ', values: ['3/4’’-3/4’’', '3/4’’-3/4’’'] });
  });

  it('χωρίς ετικέτα ή χωρίς αντιστοίχιση ⇒ κανένα εργαλείο· στο όριο στόχων ⇒ καμία προσθήκη', () => {
    expect(decidedToolLineOf({ ...entry, label: null }, rows)).toBeNull();
    expect(decidedToolLineOf({ ...entry, decision: { kind: 'ignore' } }, rows)).toBeNull();
    expect(canAddLineTarget(both)).toBe(true);
    expect(canAddLineTarget({ kind: 'price', unitCode: 'pce' })).toBe(false);
    const full = Array.from({ length: IMPORT_LINE_MAX_TARGETS - 1 }, (_, index) => `cattr_${index}`);
    expect(canAddLineTarget({ kind: 'attribute', attributeId: COOLING, alsoAttributeIds: full })).toBe(false);
  });
});
