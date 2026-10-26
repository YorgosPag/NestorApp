/**
 * ADR-920 Β4.8 Β3.5 — the breakline inventory: rows, #n, z-source, Z range, link health, conflict pairs.
 *
 * The conflict half is pinned AGAINST the QA check itself: the list must show the very flags the QA report shows (same
 * order, same message params, same severity) — a second derivation would drift the day either changes.
 */

import { buildBreaklineInventory, type BreaklineSurfaceInput } from '../topo-breakline-inventory';
import { checkBreaklineConflicts } from '../qa/check-breakline-conflicts';
import type { Breakline, BreaklineElevationConflict } from '../topo-types';

const EMPTY: BreaklineSurfaceInput = { breaklines: [], conflicts: [], origin: { x: 0, y: 0 }, unappliedResolutions: [] };
const ORIGIN = { x: 400_000, y: 4_500_000 };

const line = (id: string, extra: Partial<Breakline> = {}): Breakline => ({
  id,
  vertices: [{ x: 0, y: 0, z: 1_000 }, { x: 3_000, y: 4_000, z: 2_500 }],
  closed: false,
  ...extra,
});

const A = line('bl_a', { sourceEntityId: 'ent_a', elevationSource: 'elevation' });
const B = line('bl_b', { sourceEntityId: 'ent_gone', elevationSource: 'proximity' });
const C = line('bl_c'); // approved candidate / legacy: no source entity, no provenance

const CONFLICTS: readonly BreaklineElevationConflict[] = [
  { kind: 'crossing', x: 10, y: 20, keptZ: 1_000, overruledZ: 1_050, overruledBreaklineId: 'bl_b', keptBreaklineId: 'bl_a' },
  { kind: 'vertex-on-breakline', x: 30, y: 40, keptZ: 2_000, overruledZ: 3_000, overruledBreaklineId: 'bl_c' },
];

const existing: BreaklineSurfaceInput = { breaklines: [A, B, C], conflicts: CONFLICTS, origin: ORIGIN, unappliedResolutions: [] };

describe('buildBreaklineInventory', () => {
  const inventory = buildBreaklineInventory({
    surfaces: { existing, proposed: EMPTY },
    sceneEntityIds: new Set(['ent_a']),
  });

  it('μία γραμμή ανά ασυνέχεια, με τον αριθμό του QA (#1..#n) και την πηγή z σε λέξη', () => {
    expect(inventory.rows.map((r) => [r.label, r.source])).toEqual([
      [1, 'elevation'], [2, 'proximity'], [3, 'unknown'],
    ]);
  });

  it('μήκος κάτοψης, εύρος Ζ, πλήθος κορυφών', () => {
    const [first] = inventory.rows;
    expect(first?.lengthMm).toBeCloseTo(5_000);
    expect(first?.zRangeMm).toEqual({ min: 1_000, max: 2_500 });
    expect(first?.vertexCount).toBe(2);
  });

  it('υγεία δεσμού: ζωντανή · σβησμένη πηγή · χωρίς πηγή', () => {
    expect(inventory.rows.map((r) => r.link)).toEqual(['live', 'missing', 'none']);
  });

  it('χωρίς σκηνή ⇒ «δεν ξέρω» (null), ΠΟΤΕ ψευδές «σβήστηκε»', () => {
    const blind = buildBreaklineInventory({ surfaces: { existing, proposed: EMPTY }, sceneEntityIds: null });
    expect(blind.rows.map((r) => r.link)).toEqual([null, null, 'none']);
  });

  it('συγκρούσεις ανά ασυνέχεια — και από τις δύο πλευρές του ζεύγους', () => {
    expect(inventory.rows.map((r) => r.conflictCount)).toEqual([1, 1, 1]);
  });

  it('οι συγκρούσεις είναι ΤΑ ΙΔΙΑ flags με το QA (σειρά, μήνυμα, σοβαρότητα)', () => {
    const qa = checkBreaklineConflicts(CONFLICTS, [A, B, C], ORIGIN);
    expect(inventory.conflicts.map((c) => c.flag)).toEqual(qa);
  });

  it('το ζεύγος: ποια λύγισε, ποια κράτησε (null = σημείο αποτύπωσης)', () => {
    expect(inventory.conflicts.map((c) => [c.overruledBreaklineId, c.keptBreaklineId])).toEqual([
      ['bl_c', null], // Δz 1 m — πρώτη
      ['bl_b', 'bl_a'], // Δz 5 cm
    ]);
  });

  it('η σχεδιασμένη επιφάνεια αριθμείται χωριστά (ίδιο #n με το QA εκείνης)', () => {
    const both = buildBreaklineInventory({
      surfaces: { existing, proposed: { ...EMPTY, breaklines: [line('bl_p')] } },
      sceneEntityIds: null,
    });
    const proposed = both.rows.filter((r) => r.surfaceId === 'proposed');
    expect(proposed.map((r) => r.label)).toEqual([1]);
  });

  it('κορυφές χωρίς πεπερασμένο Ζ ⇒ εύρος null, όχι 0', () => {
    const flat = buildBreaklineInventory({
      surfaces: {
        existing: { ...EMPTY, breaklines: [line('bl_nan', { vertices: [{ x: 0, y: 0, z: Number.NaN }, { x: 1, y: 0, z: Number.NaN }] })] },
        proposed: EMPTY,
      },
      sceneEntityIds: null,
    });
    expect(flat.rows[0]?.zRangeMm).toBeNull();
  });

  it('Β3.6 — λυμένη σύγκρουση: ΟΧΙ στις ανοιχτές ούτε στο QA, ΝΑΙ στις λυμένες με τις δύο δηλώσεις και τον κανόνα', () => {
    const key = { ownerBreaklineId: 'bl_b', withBreaklineId: 'bl_a', x: 1, y: 2 };
    const resolvedConflict: BreaklineElevationConflict = {
      ...CONFLICTS[0]!, keptZ: 1_050, resolution: { rule: 'higher', keptLineZ: 1_000, key },
    };
    const conflicts = [resolvedConflict, CONFLICTS[1]!];
    const inv = buildBreaklineInventory({
      surfaces: { existing: { ...existing, conflicts }, proposed: EMPTY }, sceneEntityIds: null,
    });
    expect(inv.conflicts.map((c) => c.overruledBreaklineId)).toEqual(['bl_c']);
    expect(inv.conflicts.map((c) => c.flag)).toEqual(checkBreaklineConflicts(conflicts, [A, B, C], ORIGIN));
    expect(inv.resolved).toHaveLength(1);
    expect(inv.resolved[0]).toMatchObject({
      statements: { kept: 1_000, overruled: 1_050 }, surfaceZ: 1_050, resolution: { rule: 'higher' },
    });
    expect(inv.resolved[0]!.flag.messageKey).toBe('topography.qa.flag.breaklineResolved');
    // A decision is not a problem: the line counts only its OPEN conflicts.
    expect(inv.rows.map((r) => r.conflictCount)).toEqual([0, 0, 1]);
  });

  it('Β3.6 — αποφάσεις που δεν εφαρμόζονται: με #n, ή το ωμό id όταν ο εταίρος λείπει', () => {
    const inv = buildBreaklineInventory({
      surfaces: {
        existing: {
          ...existing,
          unappliedResolutions: [{ ownerBreaklineId: 'bl_b', withBreaklineId: 'bl_gone', x: 0, y: 0 }],
        },
        proposed: EMPTY,
      },
      sceneEntityIds: null,
    });
    expect(inv.unapplied.map((u) => [u.ownerLabel, u.withLabel])).toEqual([[2, 'bl_gone']]);
  });
});
