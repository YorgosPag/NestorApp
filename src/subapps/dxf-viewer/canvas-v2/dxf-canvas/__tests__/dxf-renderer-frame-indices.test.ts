/**
 * ADR-743 Φ0 — `buildFrameIndices`: ΕΝΑ πέρασμα αντί για πέντε, ΧΩΡΙΣ αλλαγή αποτελέσματος.
 *
 * ## Τι φυλάει αυτό το αρχείο
 *
 * Ο `DxfRenderer.render` έκανε **πέντε πλήρεις O(n) σαρώσεις της σκηνής** πριν αγγίξει έστω μία
 * οντότητα (`buildDimensionLookup`, `buildSlabOpeningsBySlab`, `buildOpeningsByWall`,
 * `buildWallsById`, `buildColumnFootprints`) — και τις ξανάκανε σε **κάθε** re-raster. Η
 * συγχώνευση σε ένα `switch` είναι ασφαλής **μόνο** επειδή οι πέντε τύποι είναι ξένοι μεταξύ
 * τους· αν κάποιος μελλοντικός builder αρχίσει να διαβάζει έναν τύπο που ήδη διαβάζει άλλος, η
 * ισοδυναμία σπάει **σιωπηλά** και τα cutouts/λαβές/σοβάς αρχίζουν να λείπουν σε σπάνιες σκηνές.
 *
 * Άρα εδώ δεν ελέγχεται «τρέχει η νέα συνάρτηση». Ελέγχεται ότι παράγει **ΤΟ ΙΔΙΟ** με τους πέντε
 * αρχικούς builders, οι οποίοι μένουν εξαγόμενοι ακριβώς γι' αυτόν τον λόγο: είναι το **αναφορικό
 * συμβόλαιο**. Ένα test που έγραφε μόνες του τις προσδοκίες θα επικύρωνε τη νέα υλοποίηση με τον
 * εαυτό της (το ακριβώς ίδιο λάθος που έκανε τον έλεγχο του ADR-726 Φ3 να μη δει την
 * αντεστραμμένη Y — είχε αντιγράψει τον λάθος τύπο στη δική του διαβεβαίωση).
 */

import type { DxfEntityUnion } from '../dxf-types';
import {
  buildFrameIndices,
  buildDimensionLookup,
  buildSlabOpeningsBySlab,
  buildOpeningsByWall,
  buildWallsById,
  buildColumnFootprints,
} from '../dxf-renderer-frame-builders';

// ── Fixtures ─────────────────────────────────────────────────────────
// Ελάχιστα σχήματα: μόνο τα πεδία που διαβάζουν οι builders. Ίδιο ιδίωμα με τα υπόλοιπα tests
// του φακέλου (`{...} as unknown as DxfScene`) — κανένα `any`.

function dimension(id: string): DxfEntityUnion {
  return { id: `w-${id}`, type: 'dimension', visible: true, dimensionEntity: { id } } as unknown as DxfEntityUnion;
}

function slabOpening(id: string, slabId: string): DxfEntityUnion {
  return {
    id, type: 'slab-opening', visible: true,
    slabOpeningEntity: { id, params: { slabId } },
  } as unknown as DxfEntityUnion;
}

function wallOpening(id: string, wallId: string): DxfEntityUnion {
  return {
    id, type: 'opening', visible: true,
    openingEntity: { id, params: { wallId, hostKind: 'wall' } },
  } as unknown as DxfEntityUnion;
}

/** ADR-615 — αυτο-φιλοξενούμενο κούφωμα: ΔΕΝ μπαίνει σε κανέναν κάδο τοίχου. */
function selfHostedOpening(id: string): DxfEntityUnion {
  return {
    id, type: 'opening', visible: true,
    openingEntity: { id, params: { hostKind: 'self' } },
  } as unknown as DxfEntityUnion;
}

function column(id: string, vertexCount: number): DxfEntityUnion {
  const vertices = Array.from({ length: vertexCount }, (_, i) => ({ x: i, y: i * 2 }));
  return { id, type: 'column', visible: true, geometry: { footprint: { vertices } } } as unknown as DxfEntityUnion;
}

function wall(id: string): DxfEntityUnion {
  return { id, type: 'wall', visible: true, geometry: {}, params: { thickness: 200 } } as unknown as DxfEntityUnion;
}

function line(id: string): DxfEntityUnion {
  return { id, type: 'line', visible: true } as unknown as DxfEntityUnion;
}

/**
 * Σκηνή που πιάνει **και τις πέντε** οικογένειες μαζί με τον θόρυβο ανάμεσά τους:
 * πολλαπλά μέλη ανά κάδο, κολώνα με ΑΝΕΠΑΡΚΕΙΣ κορυφές (<3 ⇒ απορρίπτεται), αυτο-φιλοξενούμενο
 * κούφωμα (ADR-615 ⇒ απορρίπτεται), και άσχετες οντότητες που κανένας builder δεν κοιτά.
 */
const SCENE_ENTITIES: readonly DxfEntityUnion[] = [
  line('l1'),
  dimension('d1'),
  wall('w1'),
  slabOpening('so1', 'slab-A'),
  column('c1', 4),
  wallOpening('o1', 'w1'),
  dimension('d2'),
  slabOpening('so2', 'slab-A'),
  selfHostedOpening('o-self'),
  column('c2', 2), // < 3 κορυφές ⇒ ΔΕΝ μετράει ως footprint
  wallOpening('o2', 'w2'),
  slabOpening('so3', 'slab-B'),
  wall('w2'),
  line('l2'),
  column('c3', 5),
];

describe('buildFrameIndices — ισοδυναμία με τους πέντε αρχικούς builders', () => {
  const idx = buildFrameIndices(SCENE_ENTITIES);

  it('dimensionLookup: ίδια απάντηση για κάθε id (και για άγνωστο id)', () => {
    const reference = buildDimensionLookup(SCENE_ENTITIES);
    for (const id of ['d1', 'd2', 'άγνωστο']) {
      expect(idx.dimensionLookup(id)).toEqual(reference(id));
    }
    // Θετικός έλεγχος: το lookup όντως βρίσκει κάτι — αλλιώς η ισότητα «undefined === undefined»
    // θα περνούσε με ΑΔΕΙΟ ευρετήριο και το test δεν θα φύλαγε τίποτα.
    expect(idx.dimensionLookup('d1')).toBeDefined();
  });

  it('slabOpeningsBySlab: ίδιοι κάδοι, ίδια σειρά μέσα σε κάθε κάδο', () => {
    expect(idx.slabOpeningsBySlab).toEqual(buildSlabOpeningsBySlab(SCENE_ENTITIES));
    expect(idx.slabOpeningsBySlab.get('slab-A')).toHaveLength(2);
  });

  it('openingsByWall: ίδιοι κάδοι — και το αυτο-φιλοξενούμενο μένει έξω (ADR-615)', () => {
    expect(idx.openingsByWall).toEqual(buildOpeningsByWall(SCENE_ENTITIES));
    expect([...idx.openingsByWall.keys()].sort()).toEqual(['w1', 'w2']);
  });

  it('wallsById: ίδιος χάρτης', () => {
    expect(idx.wallsById).toEqual(buildWallsById(SCENE_ENTITIES));
    expect(idx.wallsById.size).toBe(2);
  });

  it('columnFootprints: ίδια λίστα — η κολώνα με <3 κορυφές μένει έξω', () => {
    expect(idx.columnFootprints).toEqual(buildColumnFootprints(SCENE_ENTITIES));
    expect(idx.columnFootprints).toHaveLength(2);
  });

  it('η σειρά των οντοτήτων δεν αλλάζει το αποτέλεσμα ανά κάδο (μόνο η σειρά μέσα του)', () => {
    // Ένα ΕΝΙΑΙΟ πέρασμα θα μπορούσε να γεμίσει τους κάδους με άλλη σειρά από πέντε χωριστά·
    // δεν το κάνει, γιατί και τα δύο διατρέχουν τον πίνακα μία φορά προς τα εμπρός.
    const reference = buildSlabOpeningsBySlab(SCENE_ENTITIES).get('slab-A');
    expect(idx.slabOpeningsBySlab.get('slab-A')?.map((o) => o.id)).toEqual(reference?.map((o) => o.id));
  });

  it('άδεια σκηνή ⇒ άδεια ευρετήρια, καμία εξαίρεση', () => {
    const empty = buildFrameIndices([]);
    expect(empty.slabOpeningsBySlab.size).toBe(0);
    expect(empty.openingsByWall.size).toBe(0);
    expect(empty.wallsById.size).toBe(0);
    expect(empty.columnFootprints).toHaveLength(0);
    expect(empty.dimensionLookup('οτιδήποτε')).toBeUndefined();
  });
});
