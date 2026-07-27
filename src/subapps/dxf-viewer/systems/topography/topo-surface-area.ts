/**
 * ADR-662 §12 — Εμβαδά τοπογραφικής επιφάνειας από την ΤΡΙΓΩΝΟΠΟΙΗΣΗ (pure SSoT).
 *
 * ΓΙΑΤΙ ΑΠΟ ΤΑ ΤΡΙΓΩΝΑ ΚΑΙ ΟΧΙ ΑΠΟ ΤΟ `footprint` (κρίσιμη απόφαση):
 * το `topoSurfacePerimeter` παράγει «outer + hole loops» — ένα ring μπορεί να είναι
 * **τρύπα** μέσα στην επιφάνεια, όχι διακριτή νησίδα. Και επειδή η αλυσοποίηση γίνεται
 * σε **μη-προσανατολισμένες** ακμές (`chainUndirectedEdges`), το πρόσημο του shoelace
 * **δεν** μπορεί να ξεχωρίσει τρύπα από νησίδα. Άθροισμα rings ⇒ υπερεκτίμηση·
 * outer − rest ⇒ υποεκτίμηση σε αληθινές νησίδες. **Και τα δύο δίνουν λάθος αριθμό.**
 * Τα τρίγωνα δεν έχουν αυτή την αμφισημία: αθροίζεις ό,τι υπάρχει, τρύπες αποκλείονται
 * εξ ορισμού (δεν υπάρχει τρίγωνο εκεί). Ίδια πηγή που αναφέρει το Civil 3D.
 *
 * ΔΥΟ ΕΜΒΑΔΑ, ΔΥΟ ΕΡΩΤΗΜΑΤΑ (Civil 3D «2D Area» / «3D Area» — απόφαση Giorgio 2026-07-27):
 *   - **plan2DMm2** — η ΠΡΟΒΟΛΗ σε κάτοψη. Το «νομικό» εμβαδόν του οικοπέδου, αυτό που
 *     γράφει ο τίτλος και μετρά το τοπογραφικό διάγραμμα. Σύμβαση του κώδικα ήδη
 *     (`CutFillResult`: «PLAN areas (footprint), not slope areas»).
 *   - **surface3DMm2** — η ΠΡΑΓΜΑΤΙΚΗ επιφάνεια του εδάφους κατά μήκος των κλίσεων. Αυτό
 *     τιμολογεί ο εργολάβος σε εκσκαφή/επένδυση/φύτευση επικλινούς. Πάντα ≥ plan2D·
 *     ίσα μόνο σε τελείως οριζόντιο έδαφος.
 *
 * ΠΛΑΙΣΙΟ: τα `positions` είναι LOCAL mm και τα `elevations` WORLD canonical mm. Το
 * LOCAL→WORLD είναι **καθαρή μετατόπιση** (`localToWorld` = + origin), και η μετατόπιση
 * **διατηρεί το εμβαδόν** — άρα δεν χρειάζεται re-projection εδώ. Το ίδιο ισχύει για τη
 * geo-reference προβολή του display frame: το εμβαδόν που θέλει ο μηχανικός είναι το
 * **πραγματικό εμβαδόν εδάφους**, ανεξάρτητο από το πώς τυχαίνει να προβάλλεται η κάτοψη.
 *
 * Pure (μηδέν store/React/DOM) — unit-testable με σκέτο `TinSurface`.
 *
 * @see ./topo-types.ts — TinSurface (positions/elevations/triangles)
 * @see ./topo-surface-perimeter.ts — γιατί τα rings ΔΕΝ είναι αξιόπιστη πηγή εμβαδού
 * @see ../measure/entity-measurement-facts.ts — ο καταναλωτής («τι εμβαδόν δίνει αυτή η οντότητα;»)
 */

import type { TinSurface } from './topo-types';

/** Τα δύο εμβαδά μιας τριγωνοποιημένης επιφάνειας, σε canonical mm² (ADR-462). */
export interface TopoSurfaceAreas {
  /** Προβολή σε κάτοψη — το «νομικό» εμβαδόν. Πάντα ≤ `surface3DMm2`. */
  readonly plan2DMm2: number;
  /** Πραγματική επιφάνεια κατά μήκος των κλίσεων. Ίση με την προβολή σε επίπεδο έδαφος. */
  readonly surface3DMm2: number;
  /** Πόσα τρίγωνα συνεισέφεραν — 0 σημαίνει «καμία τριγωνοποιήσιμη επιφάνεια». */
  readonly triangleCount: number;
}

const NO_AREAS: TopoSurfaceAreas = { plan2DMm2: 0, surface3DMm2: 0, triangleCount: 0 };

/**
 * Τα εμβαδά (προβολής + πραγματικής επιφάνειας) μιας TIN. Κενή/μη τριγωνοποιήσιμη
 * επιφάνεια → μηδενικά, **ποτέ** NaN.
 *
 * Ένα πέρασμα, δύο απαντήσεις: τα ίδια δύο διανύσματα ακμών δίνουν και το 2D εξωτερικό
 * γινόμενο (z-συνιστώσα) και το 3D μέτρο του — γι' αυτό δεν υπάρχουν δύο βρόχοι.
 */
export function topoSurfaceAreas(surface: TinSurface): TopoSurfaceAreas {
  const { triangles, positions, elevations } = surface;
  if (triangles.length === 0) return NO_AREAS;

  let plan2DMm2 = 0;
  let surface3DMm2 = 0;
  let triangleCount = 0;

  for (const [ia, ib, ic] of triangles) {
    const pa = positions[ia];
    const pb = positions[ib];
    const pc = positions[ic];
    if (!pa || !pb || !pc) continue;

    // Δύο ακμές από την κορυφή A, σε 3Δ (z = υψόμετρο· απόν ⇒ 0, δηλαδή επίπεδο).
    const ux = pb[0] - pa[0];
    const uy = pb[1] - pa[1];
    const uz = (elevations[ib] ?? 0) - (elevations[ia] ?? 0);
    const vx = pc[0] - pa[0];
    const vy = pc[1] - pa[1];
    const vz = (elevations[ic] ?? 0) - (elevations[ia] ?? 0);

    // u × v: η z-συνιστώσα ΜΟΝΗ ΤΗΣ είναι το διπλάσιο εμβαδόν της προβολής· το πλήρες
    // μέτρο του διανύσματος είναι το διπλάσιο εμβαδόν του τριγώνου στον χώρο.
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    const twicePlan = Math.abs(nz);
    const twiceSurface = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!Number.isFinite(twicePlan) || !Number.isFinite(twiceSurface)) continue;

    plan2DMm2 += twicePlan / 2;
    surface3DMm2 += twiceSurface / 2;
    triangleCount += 1;
  }

  return { plan2DMm2, surface3DMm2, triangleCount };
}
