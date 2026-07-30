/**
 * integrity + engine-version — ΑΝΑΠΑΡΑΓΩΓΙΜΟΤΗΤΑ
 *
 * ADR-734 §6.3 κανόνας 2: ίδιες είσοδοι + ίδια `engineVersion` ⇒ ίδιο hash.
 * Το ενδιαφέρον μέρος είναι το **αντίστροφο**: κάθε αλλαγή εισόδου ΠΡΕΠΕΙ να
 * αλλάζει το hash, αλλιώς ο φάκελος υπόσχεται αναπαραγωγιμότητα που δεν ισχύει.
 */

import { buildIntegrityRecord, computeInputsHash, type IntegrityInputs } from '../integrity';
import { computeEngineFingerprint, resolveEngineVersion, VQE_ENGINE_SEMVER } from '../engine-version';
import { makeItem } from './vqe-test-fixtures';

const BASE_INPUTS: IntegrityInputs = {
  engineVersion: '1.0.0+abcdef123456',
  computedBy: 'cost-engine.computeBuildingSummary',
  sourceItems: [makeItem({ id: 'boq-1' }), makeItem({ id: 'boq-2' })],
  params: undefined,
};

function hashWith(overrides: Partial<IntegrityInputs>): string {
  return computeInputsHash({ ...BASE_INPUTS, ...overrides });
}

describe('computeInputsHash — σταθερότητα', () => {
  it('παράγει sha256 hex 64 χαρακτήρων', () => {
    expect(hashWith({})).toMatch(/^[0-9a-f]{64}$/);
  });

  it('είναι σταθερό σε επαναλαμβανόμενες κλήσεις', () => {
    expect(hashWith({})).toBe(hashWith({}));
  });

  it('είναι ανεξάρτητο της σειράς άφιξης των items', () => {
    const reversed = [...BASE_INPUTS.sourceItems].reverse();
    expect(hashWith({ sourceItems: reversed })).toBe(hashWith({}));
  });

  it('δεν μεταβάλλει τον πίνακα εισόδου', () => {
    const items = [makeItem({ id: 'z' }), makeItem({ id: 'a' })];
    computeInputsHash({ ...BASE_INPUTS, sourceItems: items });
    expect(items.map((item) => item.id)).toEqual(['z', 'a']);
  });
});

describe('computeInputsHash — ευαισθησία', () => {
  it('αλλάζει όταν αλλάζει ποσότητα item', () => {
    const changed = [makeItem({ id: 'boq-1', estimatedQuantity: 101 }), makeItem({ id: 'boq-2' })];
    expect(hashWith({ sourceItems: changed })).not.toBe(hashWith({}));
  });

  it('αλλάζει όταν αλλάζει η έκδοση μηχανής', () => {
    expect(hashWith({ engineVersion: '1.0.0+000000000000' })).not.toBe(hashWith({}));
  });

  it('αλλάζει όταν αλλάζει η δραστηριότητα', () => {
    expect(hashWith({ computedBy: 'cost-engine.computeItemCost' })).not.toBe(hashWith({}));
  });

  it('αλλάζει όταν αλλάζουν τα params — ακόμη και μέσα σε Map', () => {
    const first = new Map<string, string>([['OIK-2', 'alpha']]);
    const second = new Map<string, string>([['OIK-2', 'beta']]);
    expect(hashWith({ params: first })).not.toBe(hashWith({ params: second }));
    expect(hashWith({ params: first })).not.toBe(hashWith({}));
  });

  it('αλλάζει όταν το ίδιο item μετρηθεί δύο φορές', () => {
    const doubled = [...BASE_INPUTS.sourceItems, makeItem({ id: 'boq-1' })];
    expect(hashWith({ sourceItems: doubled })).not.toBe(hashWith({}));
  });

  it('διακρίνει κενό σύνολο από σύνολο με items', () => {
    expect(hashWith({ sourceItems: [] })).not.toBe(hashWith({}));
  });
});

describe('buildIntegrityRecord', () => {
  it('μεταφέρει αυτούσια την έκδοση μηχανής', () => {
    const record = buildIntegrityRecord(BASE_INPUTS);
    expect(record.engineVersion).toBe(BASE_INPUTS.engineVersion);
    expect(record.inputsHash).toBe(computeInputsHash(BASE_INPUTS));
  });
});

describe('engine fingerprint', () => {
  it('έχει τη μορφή <semver>+<12 hex>', () => {
    expect(resolveEngineVersion()).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{12}$/);
    expect(resolveEngineVersion().startsWith(`${VQE_ENGINE_SEMVER}+`)).toBe(true);
  });

  it('είναι μνημονευμένο — ίδια τιμή σε επαναλαμβανόμενες κλήσεις', () => {
    expect(computeEngineFingerprint()).toBe(computeEngineFingerprint());
    expect(resolveEngineVersion()).toBe(resolveEngineVersion());
  });

  /**
   * Η καρδιά του ελέγχου: το `computeBuildingSummary()` γράφει
   * `lastUpdated: nowISO()`. Αν διέρρεε στο δείγμα, η «έκδοση μηχανής» θα άλλαζε
   * με τον χρόνο. Ξαναφορτώνουμε το module με **μετακινημένο ρολόι συστήματος**
   * ώστε ο υπολογισμός να γίνει από την αρχή σε άλλη χρονική στιγμή.
   */
  it('δεν αλλάζει όταν μετακινηθεί το ρολόι του συστήματος', async () => {
    const before = computeEngineFingerprint();

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2030-06-15T10:20:30.000Z'));
    jest.resetModules();
    const reloaded = await import('../engine-version');
    const after = reloaded.computeEngineFingerprint();
    jest.useRealTimers();

    expect(after).toBe(before);
  });
});
