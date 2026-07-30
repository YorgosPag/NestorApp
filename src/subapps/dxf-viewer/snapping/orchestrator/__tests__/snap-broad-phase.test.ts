/**
 * ADR-728 Φ2 — μονάδες του broad phase (`snap-broad-phase.ts`).
 *
 * ## Τι καρφώνεται εδώ και γιατί
 *
 * Το broad phase είναι **φίλτρο ορθότητας μεταμφιεσμένο σε βελτιστοποίηση**: αν κόψει μια
 * οντότητα που κάποια engine θα δεχόταν, το snap κουμπώνει **αλλού** — παλινδρόμηση ορθότητας,
 * όχι απόδοσης (ADR-728 §6, τελευταία γραμμή του πίνακα κριτηρίων). Άρα τα tests δεν ρωτούν
 * «είναι γρήγορο;» αλλά **«κόβει ποτέ κάτι που δεν έπρεπε;»**.
 *
 * Τέσσερις οικογένειες:
 *  1. **Συμπερίληψη/αποκλεισμός** — εντός/εκτός aperture box.
 *  2. **Fail-open** — άγνωστα bounds, exception σε provider, μη πεπερασμένα bounds, αποτυχία
 *     ερωτήματος: ⇒ η οντότητα περνά **πάντα**. Υπερ-εκτίμηση ασφαλής, υπο-εκτίμηση όχι.
 *  3. **Σειρά σκηνής** — οι engines κόβουν στο `maxCandidates`· άλλη σειρά ⇒ άλλος νικητής.
 *  4. **Aperture** — το κουτί ορίζεται από τον **πιο ανεκτικό** ενεργό τύπο, όχι από κάποιον.
 *
 * Ημερομηνία: 2026-07-30.
 */

import {
  buildSnapBroadPhase,
  resolveBroadPhaseAperture,
  selectBroadPhaseCandidates,
  type SnapBroadPhase,
} from '../snap-broad-phase';
import { ExtendedSnapType, type Entity } from '../../extended-types';
import type { Point2D } from '../../../rendering/types/Types';

// ── Βοηθοί σκηνής ───────────────────────────────────────────────────────────

/** Γραμμή με πραγματική γεωμετρία — ο `resolveEntityBounds` έχει provider για `line`. */
function line(id: string, x1: number, y1: number, x2: number, y2: number): Entity {
  return { id, type: 'line', layerId: 'lyr', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as unknown as Entity;
}

/** Κύκλος — provider `circle`, AABB = κέντρο ± ακτίνα. */
function circle(id: string, cx: number, cy: number, r: number): Entity {
  return { id, type: 'circle', layerId: 'lyr', center: { x: cx, y: cy }, radius: r } as unknown as Entity;
}

const ids = (entities: readonly Entity[]): string[] => entities.map(e => e.id);

/** Σταθερή ακτίνα ανά τύπο — απομονώνει το broad phase από τη λογική του viewport. */
function fixedAperture(radius: number) {
  return { worldRadiusAt: () => radius, worldRadiusForType: () => radius };
}

function buildOrFail(entities: readonly Entity[]): SnapBroadPhase {
  const bp = buildSnapBroadPhase(entities);
  if (!bp) throw new Error('αναμενόταν χτισμένο broad phase για αυτή τη σκηνή');
  return bp;
}

// ── 1. Συμπερίληψη / αποκλεισμός ────────────────────────────────────────────

describe('ADR-728 Φ2 — τι μπαίνει και τι μένει έξω από το aperture box', () => {
  const scene = [
    line('near', 0, 0, 10, 0),
    line('far', 5000, 5000, 5010, 5000),
    circle('mid', 500, 0, 20),
  ];

  it('κρατά ΜΟΝΟ τις οντότητες που τέμνουν το κουτί γύρω από τον κέρσορα', () => {
    const bp = buildOrFail(scene);
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 5, y: 0 }, 20))).toEqual(['near']);
  });

  it('οντότητα ΕΚΤΟΣ κουτιού λείπει — αυτό ΕΙΝΑΙ το κέρδος', () => {
    const bp = buildOrFail(scene);
    const kept = selectBroadPhaseCandidates(bp, scene, { x: 5000, y: 5000 }, 20);
    expect(ids(kept)).toEqual(['far']);
    expect(kept.length).toBeLessThan(scene.length);
  });

  it('κέρσορας σε απόλυτα κενή περιοχή ⇒ κανένας υποψήφιος', () => {
    const bp = buildOrFail(scene);
    expect(selectBroadPhaseCandidates(bp, scene, { x: 2500, y: 2500 }, 5)).toHaveLength(0);
  });

  it('το κουτί είναι CROSSING, όχι WINDOW: αρκεί να ΤΕΜΝΕΤΑΙ το AABB (AutoCAD APERTURE, §4.1)', () => {
    // Γραμμή 0→1000: το AABB της είναι τεράστιο σε σχέση με το κουτί, αλλά τέμνεται.
    const long = [line('long', 0, 0, 1000, 0)];
    const bp = buildOrFail(long);
    expect(ids(selectBroadPhaseCandidates(bp, long, { x: 500, y: 0 }, 3))).toEqual(['long']);
  });
});

// ── 2. Fail-open — κάθε αβεβαιότητα λύνεται υπέρ της συμπερίληψης ────────────

describe('ADR-728 §Φ2.1 — fail-open: υπερ-εκτίμηση ναι, υπο-εκτίμηση ΠΟΤΕ', () => {
  it('τύπος ΧΩΡΙΣ bounds provider περνά πάντα, όσο μακριά κι αν είναι ο κέρσορας', () => {
    // `viewport-marker` δεν υπάρχει στο ENTITY_BOUNDS_PROVIDERS ⇒ resolver → null.
    const unknown = { id: 'noBounds', type: 'viewport-marker', layerId: 'lyr' } as unknown as Entity;
    const scene = [line('anchor', 0, 0, 10, 0), unknown];
    const bp = buildOrFail(scene);

    expect(bp.alwaysInclude.has('noBounds')).toBe(true);
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 9000, y: 9000 }, 10))).toEqual(['noBounds']);
  });

  it('provider που ΠΕΤΑΕΙ exception δεν ρίχνει το χτίσιμο — η οντότητα πάει στο «πάντα μέσα»', () => {
    // `line` χωρίς `start`/`end`: ο provider κάνει `e.start.x` ⇒ TypeError.
    const broken = { id: 'broken', type: 'line', layerId: 'lyr' } as unknown as Entity;
    const scene = [line('anchor', 0, 0, 10, 0), broken];

    const bp = buildOrFail(scene);
    expect(bp.alwaysInclude.has('broken')).toBe(true);
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 9000, y: 9000 }, 10))).toEqual(['broken']);
  });

  it('μη πεπερασμένα bounds (NaN) δεν δηλητηριάζουν το ευρετήριο — πάνε στο «πάντα μέσα»', () => {
    const nan = line('nan', Number.NaN, 0, 10, 0);
    const scene = [line('anchor', 0, 0, 10, 0), nan];
    const bp = buildOrFail(scene);

    expect(bp.alwaysInclude.has('nan')).toBe(true);
    // Και το ευρετήριο κράτησε φυσιολογικά bounds για την υγιή οντότητα.
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 5, y: 0 }, 5))).toEqual(['anchor', 'nan']);
  });

  it('σκηνή όπου ΚΑΜΙΑ οντότητα δεν έχει bounds ⇒ null ⇒ ο καλών δουλεύει σε pass-through', () => {
    const scene = [
      { id: 'a', type: 'line', layerId: 'lyr' } as unknown as Entity,
      { id: 'b', type: 'line', layerId: 'lyr' } as unknown as Entity,
    ];
    expect(buildSnapBroadPhase(scene)).toBeNull();
  });

  it('άδεια σκηνή ⇒ null (δεν χτίζεται ευρετήριο για το τίποτα)', () => {
    expect(buildSnapBroadPhase([])).toBeNull();
  });

  it('εκφυλισμένη σκηνή μηδενικής έκτασης (όλα σε ΕΝΑ σημείο) ⇒ null, όχι πλέγμα χωρίς κλίμακα', () => {
    const scene = [line('p1', 7, 7, 7, 7), line('p2', 7, 7, 7, 7)];
    expect(buildSnapBroadPhase(scene)).toBeNull();
  });

  it('μη πεπερασμένο aperture ή κέρσορας ⇒ περνά ΟΛΗ η σκηνή (fail-open, όχι fail-closed)', () => {
    const scene = [line('a', 0, 0, 10, 0), line('b', 900, 0, 910, 0)];
    const bp = buildOrFail(scene);

    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 0, y: 0 }, Number.NaN))).toEqual(['a', 'b']);
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 0, y: 0 }, Number.POSITIVE_INFINITY))).toEqual(['a', 'b']);
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 0, y: 0 }, 0))).toEqual(['a', 'b']);
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: Number.NaN, y: 0 }, 10))).toEqual(['a', 'b']);
  });

  it('αποτυχία του ίδιου του ερωτήματος ⇒ περνά ΟΛΗ η σκηνή', () => {
    const scene = [line('a', 0, 0, 10, 0), line('b', 900, 0, 910, 0)];
    const bp = buildOrFail(scene);
    const exploding: SnapBroadPhase = {
      ...bp,
      index: { ...bp.index, queryBounds: () => { throw new Error('index κατέρρευσε'); } } as typeof bp.index,
    };

    expect(ids(selectBroadPhaseCandidates(exploding, scene, { x: 0, y: 0 }, 5))).toEqual(['a', 'b']);
  });
});

// ── 3. Σειρά σκηνής — ορθότητα, όχι αισθητική ────────────────────────────────

describe('ADR-728 Φ2 — η σειρά της σκηνής διατηρείται (οι engines κόβουν στο maxCandidates)', () => {
  it('το αποτέλεσμα ακολουθεί τη σειρά του ΑΡΧΙΚΟΥ πίνακα, όχι την απόσταση από τον κέρσορα', () => {
    // Σκόπιμα ανάποδα: το πρώτο στοιχείο του πίνακα είναι το ΠΙΟ ΜΑΚΡΙΝΟ από τον κέρσορα.
    // Ένα ερώτημα ευρετηρίου επιστρέφει ταξινομημένα κατά απόσταση (BaseSpatialIndex.
    // finalizeResults) ⇒ αν το broad phase κρατούσε ΕΚΕΙΝΗ τη σειρά, εδώ θα έβγαινε ανάποδα.
    const scene = [
      line('third', 30, 0, 31, 0),
      line('second', 20, 0, 21, 0),
      line('first', 10, 0, 11, 0),
    ];
    const bp = buildOrFail(scene);

    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 10, y: 0 }, 100)))
      .toEqual(['third', 'second', 'first']);
  });

  it('η σειρά διατηρείται και όταν αναμειγνύονται ευρετηριασμένες με «πάντα μέσα»', () => {
    const unknown = { id: 'noBounds', type: 'viewport-marker', layerId: 'lyr' } as unknown as Entity;
    const scene = [line('far', 900, 0, 910, 0), unknown, line('near', 0, 0, 5, 0)];
    const bp = buildOrFail(scene);

    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 2, y: 0 }, 10))).toEqual(['noBounds', 'near']);
  });

  it('διπλός id δεν εξαφανίζει εγγραφή — το Set φιλτράρει, δεν αποδιπλασιάζει τον πίνακα', () => {
    const scene = [line('dup', 0, 0, 5, 0), line('dup', 1, 0, 6, 0)];
    const bp = buildOrFail(scene);
    expect(selectBroadPhaseCandidates(bp, scene, { x: 2, y: 0 }, 10)).toHaveLength(2);
  });
});

// ── 4. Aperture — το κουτί το ορίζει ο πιο ανεκτικός ενεργός τύπος ───────────

describe('ADR-728 §Φ2.1 — «το aperture δεν είναι ένα»: επιλέγεται το ΜΕΓΙΣΤΟ', () => {
  const cursor: Point2D = { x: 0, y: 0 };

  /** Ανοχή ανά τύπο, όπως το πραγματικό `perModePxTolerance` (10 / 12 / 30 …). */
  function perType(map: Partial<Record<ExtendedSnapType, number>>, fallback: number) {
    return {
      worldRadiusAt: () => fallback,
      worldRadiusForType: (_p: Point2D, t: ExtendedSnapType) => map[t] ?? fallback,
    };
  }

  it('ο πιο ανεκτικός ΕΝΕΡΓΟΣ τύπος καθορίζει το κουτί', () => {
    const resolver = perType(
      { [ExtendedSnapType.ENDPOINT]: 10, [ExtendedSnapType.BIM_WALL_FACE]: 30 },
      10,
    );
    const enabled = new Set([ExtendedSnapType.ENDPOINT, ExtendedSnapType.BIM_WALL_FACE]);
    const tight = new Set([ExtendedSnapType.ENDPOINT]);

    expect(resolveBroadPhaseAperture(cursor, enabled, resolver))
      .toBeGreaterThan(resolveBroadPhaseAperture(cursor, tight, resolver));
  });

  it('ο ανεκτικός τύπος ΕΚΤΟΣ enabledTypes ΔΕΝ διευρύνει το κουτί (μετράει το ενεργό, όχι το δυνατό)', () => {
    const resolver = perType({ [ExtendedSnapType.BIM_WALL_FACE]: 30 }, 10);
    const withoutIt = new Set([ExtendedSnapType.ENDPOINT, ExtendedSnapType.MIDPOINT]);
    expect(resolveBroadPhaseAperture(cursor, withoutIt, resolver))
      .toBe(resolveBroadPhaseAperture(cursor, new Set([ExtendedSnapType.ENDPOINT]), resolver));
  });

  it('το βασικό `worldRadiusAt` είναι ΔΑΠΕΔΟ — τύπος χωρίς εγγραφή ανοχής πέφτει πίσω σε αυτό', () => {
    const resolver = perType({}, 25);
    expect(resolveBroadPhaseAperture(cursor, new Set(), resolver)).toBeGreaterThanOrEqual(25);
  });

  it('το κουτί είναι ΠΛΑΤΥΤΕΡΟ από την ανοχή — οι engines πολλαπλασιάζουν (Perpendicular 1,5× / Parallel 2×)', () => {
    // Χωρίς αυτό, η Perpendicular θα έχανε πόδια καθέτου που σήμερα βρίσκει.
    const resolver = perType({}, 10);
    expect(resolveBroadPhaseAperture(cursor, new Set([ExtendedSnapType.PERPENDICULAR]), resolver))
      .toBeGreaterThanOrEqual(10 * 1.5);
  });

  it('η μεγαλύτερη ανοχή φέρνει ΠΕΡΙΣΣΟΤΕΡΟΥΣ υποψήφιους — όχι διαφορετικούς', () => {
    const scene = [line('a', 0, 0, 5, 0), line('b', 60, 0, 65, 0)];
    const bp = buildOrFail(scene);

    const tight = selectBroadPhaseCandidates(bp, scene, { x: 2, y: 0 }, 10);
    const wide = selectBroadPhaseCandidates(bp, scene, { x: 2, y: 0 }, 100);

    expect(ids(tight)).toEqual(['a']);
    expect(ids(wide)).toEqual(['a', 'b']);
    expect(ids(wide)).toEqual(expect.arrayContaining(ids(tight)));
  });
});

// ── 5. Το ίδιο το ευρετήριο ─────────────────────────────────────────────────

describe('ADR-728 Φ2 — δομή του ευρετηρίου', () => {
  it('χτίζεται με τον ΥΠΑΡΧΟΝΤΑ spatial SSoT και περιέχει κάθε ευρετηριάσιμη οντότητα', () => {
    const scene = [line('a', 0, 0, 5, 0), circle('b', 100, 100, 3), line('c', 200, 0, 205, 0)];
    const bp = buildOrFail(scene);

    expect(bp.indexedCount).toBe(3);
    expect(bp.alwaysInclude.size).toBe(0);
  });

  it('οντότητα που καλύπτει σχεδόν όλο το σχέδιο ΔΕΝ ευρετηριάζεται — μπαίνει στο «πάντα μέσα»', () => {
    // Πλαίσιο σχεδίου: το AABB του καλύπτει κάθε κελί ⇒ φράγμα κόστους εισαγωγής.
    const scene = [
      line('frame', -10_000, -10_000, 10_000, 10_000),
      ...Array.from({ length: 100 }, (_, i) => line(`e${i}`, i * 10, 0, i * 10 + 1, 0)),
    ];
    const bp = buildOrFail(scene);

    expect(bp.alwaysInclude.has('frame')).toBe(true);
    // Και επιστρέφεται κανονικά — η παράκαμψη είναι υπερ-εκτίμηση, ποτέ απώλεια.
    expect(ids(selectBroadPhaseCandidates(bp, scene, { x: 5, y: 0 }, 3))).toContain('frame');
  });
});
