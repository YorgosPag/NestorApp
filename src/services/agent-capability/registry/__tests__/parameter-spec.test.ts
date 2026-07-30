/**
 * Παράμετροι — μία δήλωση, δύο παράγωγα που ΔΕΝ επιτρέπεται να αποκλίνουν:
 * το JSON Schema που βλέπει το μοντέλο και ο έλεγχος που τρέχει στον handler.
 *
 * @module services/agent-capability/registry/__tests__/parameter-spec
 * @see ADR-734 §5.2, §5.4
 */

import { defineParams, paramsToJsonSchema, parseArgs } from '../index';

const PARAMS = defineParams({
  buildingId: { kind: 'string', description: 'Κτίριο.', maxLength: 8 },
  limit: { kind: 'number', description: 'Πλήθος.', integer: true, minimum: 1, maximum: 50, optional: true },
  status: { kind: 'enum', description: 'Κατάσταση.', values: ['draft', 'locked'], optional: true },
  includeCosts: { kind: 'boolean', description: 'Κόστη;', optional: true },
  itemIds: { kind: 'stringArray', description: 'Ids.', maxItems: 3, optional: true },
});

describe('JSON Schema — αναλλοίωτα του strict mode', () => {
  const schema = paramsToJsonSchema(PARAMS);

  it('κλειστό αντικείμενο με ΟΛΑ τα κλειδιά στο required', () => {
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['buildingId', 'limit', 'status', 'includeCosts', 'itemIds']);
  });

  it('η προαιρετικότητα εκφράζεται ως nullable τύπος, όχι ως απουσία από το required', () => {
    expect(schema.properties?.buildingId.type).toBe('string');
    expect(schema.properties?.limit.type).toEqual(['integer', 'null']);
    expect(schema.properties?.includeCosts.type).toEqual(['boolean', 'null']);
    expect(schema.properties?.itemIds.type).toEqual(['array', 'null']);
  });

  it('προαιρετικό enum παίρνει και null μέσα στις τιμές', () => {
    expect(schema.properties?.status.type).toEqual(['string', 'null']);
    expect(schema.properties?.status.enum).toEqual(['draft', 'locked', null]);
  });

  it('μεταφέρει τα όρια της προδιαγραφής στο σχήμα (δεν μένουν μόνο στον έλεγχο)', () => {
    expect(schema.properties?.buildingId.maxLength).toBe(8);
    expect(schema.properties?.limit.minimum).toBe(1);
    expect(schema.properties?.limit.maximum).toBe(50);
    expect(schema.properties?.itemIds.maxItems).toBe(3);
  });

  it('η σειρά κλειδιών ακολουθεί τη δήλωση — σταθερή έξοδος', () => {
    expect(Object.keys(schema.properties ?? {})).toEqual([
      'buildingId', 'limit', 'status', 'includeCosts', 'itemIds',
    ]);
  });
});

describe('έλεγχος εισόδου — fail-closed', () => {
  it('δέχεται πλήρη έγκυρα ορίσματα', () => {
    const result = parseArgs(PARAMS, {
      buildingId: 'bld-1',
      limit: 10,
      status: 'draft',
      includeCosts: true,
      itemIds: ['a', 'b'],
    });
    expect(result).toEqual({
      ok: true,
      value: { buildingId: 'bld-1', limit: 10, status: 'draft', includeCosts: true, itemIds: ['a', 'b'] },
    });
  });

  it('null σε προαιρετικό σημαίνει «απών» — έτσι το στέλνει το strict mode', () => {
    const result = parseArgs(PARAMS, { buildingId: 'bld-1', limit: null, status: null, includeCosts: null, itemIds: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ buildingId: 'bld-1' });
  });

  it('υποχρεωτικό που λείπει ⇒ INVALID_ARGUMENT', () => {
    const result = parseArgs(PARAMS, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_ARGUMENT');
    expect(result.error.details?.parameter).toBe('buildingId');
  });

  it('άγνωστη παράμετρος ⇒ απόρριψη (σιωπηλή αγνόηση φίλτρου = λάθος ποσότητα)', () => {
    const result = parseArgs(PARAMS, { buildingId: 'bld-1', companyId: 'co-hack' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details?.parameter).toBe('companyId');
    expect(result.error.details?.reason).toBe('unknown parameter');
  });

  it('κόβει κενά στα άκρα ώστε ίδια πρόθεση να δίνει ίδιο αποτύπωμα', () => {
    const result = parseArgs(PARAMS, { buildingId: '  bld-1  ' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.buildingId).toBe('bld-1');
  });

  it('κενή συμβολοσειρά μετά το trim ⇒ απόρριψη', () => {
    expect(parseArgs(PARAMS, { buildingId: '   ' }).ok).toBe(false);
  });

  it.each<[string, Record<string, unknown>]>([
    ['λάθος τύπος', { buildingId: 42 }],
    ['υπέρβαση maxLength', { buildingId: 'bld-12345678' }],
  ])('%s ⇒ απόρριψη', (_label, args) => {
    expect(parseArgs(PARAMS, args).ok).toBe(false);
  });

  it.each<[string, number]>([
    ['μη πεπερασμένος', Number.NaN],
    ['μη ακέραιος', 2.5],
    ['κάτω από το ελάχιστο', 0],
    ['πάνω από το μέγιστο', 51],
  ])('αριθμός: %s ⇒ απόρριψη', (_label, limit) => {
    expect(parseArgs(PARAMS, { buildingId: 'bld-1', limit }).ok).toBe(false);
  });

  it('τιμή εκτός enum ⇒ απόρριψη, με τις επιτρεπτές στο μήνυμα', () => {
    const result = parseArgs(PARAMS, { buildingId: 'bld-1', status: 'certified' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/draft, locked/);
  });

  it.each<[string, unknown]>([
    ['όχι πίνακας', 'a'],
    ['μη συμβολοσειρές', [1, 2]],
    ['κενή εγγραφή', ['a', '  ']],
    ['υπέρβαση maxItems', ['a', 'b', 'c', 'd']],
  ])('πίνακας: %s ⇒ απόρριψη', (_label, itemIds) => {
    expect(parseArgs(PARAMS, { buildingId: 'bld-1', itemIds }).ok).toBe(false);
  });
});
