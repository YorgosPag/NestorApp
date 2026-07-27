/**
 * ADR-718 — «κόψε το ανάγλυφο κατακόρυφα στο όριο του οικοπέδου». Καθαρό: μηδέν store, μηδέν
 * THREE, μηδέν React. Παίρνει μια {@link TinSurface} και ένα κλειστό δακτύλιο, δίνει μια **νέα**
 * `TinSurface` που καλύπτει μόνο ό,τι είναι μέσα.
 *
 * ── Γιατί τα υψόμετρα ΔΕΝ αλλοιώνονται ──────────────────────────────────────────────────────
 * Το z πάνω σε ένα τρίγωνο TIN είναι **γραμμικό πεδίο** — το τρίγωνο ΕΙΝΑΙ ένα επίπεδο. Κάθε νέα
 * κορυφή που γεννά η τομή κάθεται πάνω σε **αυτό το ίδιο επίπεδο** (`fitDzPlane` → `dzAt`), οπότε
 * η κομμένη επιφάνεια δεν είναι «μια άλλη επιφάνεια που της μοιάζει»: είναι κυριολεκτικά **το ίδιο
 * γεωμετρικό αντικείμενο με μικρότερο πεδίο ορισμού**. Λοφάκι 2m στο κέντρο παραμένει 2m. Καμία
 * επανατριγωνοποίηση, καμία παρεμβολή μεταξύ ΔΙΑΦΟΡΕΤΙΚΩΝ τριγώνων, καμία εξομάλυνση.
 *
 * ── Γιατί η μεγέθυνση είναι ΑΔΥΝΑΤΗ, όχι απαγορευμένη ───────────────────────────────────────
 * Η έξοδος συναρμολογείται **αποκλειστικά** από τομές `τρίγωνο ∩ όριο`. Η τομή είναι πάντα
 * υποσύνολο του τριγώνου, άρα η κομμένη επιφάνεια είναι πάντα υποσύνολο της μετρημένης — όσο
 * μεγάλο κι αν είναι το όριο. Δεν υπάρχει φύλακας να παρακαμφθεί και δεν υπάρχει διαδρομή που να
 * εφευρίσκει έδαφος εκεί που ο τοπογράφος δεν μέτρησε. Αυτή είναι όλη η απαίτηση «μόνο
 * συρρίκνωση», και ζει στη δομή του αλγορίθμου αντί σε έναν έλεγχο.
 *
 * ── Τι ΔΕΝ κάνει ────────────────────────────────────────────────────────────────────────────
 * Δεν αγγίζει τα survey points. Ο ορισμός της επιφάνειας (σημεία + γραμμές ασυνέχειας) μένει
 * ανέπαφος στο `TopoPointStore`· η κοπή είναι **παράγωγο**, οπότε η επαναφορά είναι απλώς «μην
 * κόψεις» — μηδέν απώλεια δεδομένων, μηδέν migration.
 *
 * @see ../../bim/geometry/shared/polygon-clip-utils — `clipPolygonByConvex2D` (το ΕΝΑ S-H σπίτι)
 * @see ./cut-fill.ts — ο δίδυμος καλών: το ΙΔΙΟ «τρίγωνο ∩ όριο», για όγκους αντί για γεωμετρία
 * @see ./tin-builder.ts — η κοινή συναρμολόγηση (dedup grid / bounds / false flats)
 */

import type { Point2D } from '../../rendering/types/Types';
import { clipPolygonByConvex2D } from '../../bim/geometry/shared/polygon-utils';
import type { TinSurface } from './topo-types';
import { worldToLocal } from './topo-local-origin';
import { fitDzPlane, dzAt, type DzVertex } from './cut-fill-geometry';
import {
  createVertexAccumulator,
  pushVertex,
  computeBounds,
  countFlatTriangles,
  type CollectedVertices,
} from './tin-builder';

/**
 * Η κομμένη επιφάνεια: η `surface` περιορισμένη στο `boundaryWorld` (WORLD canonical mm, σιωπηρά
 * κλειστό — όπως το `TopoBoundary.vertices`). Το όριο μπορεί να είναι **μη κυρτό**· Γ-σχήμα
 * οικόπεδο είναι ο κανόνας, όχι η εξαίρεση.
 *
 * ⚠️ Όριο με < 3 κορυφές, ή όριο που δεν τέμνει καθόλου την επιφάνεια, δίνει **κενή** επιφάνεια —
 * ποτέ την αρχική. Το «δεν μπόρεσα να κόψω, ορίστε το ακομμάτιαστο» θα ήταν σιωπηλή αποτυχία που
 * μοιάζει με επιτυχία: ο χρήστης θα έβλεπε το ανάγλυφο να ξεχειλίζει και θα νόμιζε ότι η κοπή
 * είναι κλειστή. Άδειο είναι ορατό, και ορατό είναι διορθώσιμο.
 */
export function clipTinToBoundary(
  surface: TinSurface,
  boundaryWorld: readonly Point2D[],
): TinSurface {
  if (surface.triangles.length === 0 || boundaryWorld.length < 3) return emptyLike(surface);

  // Το όριο κατεβαίνει στο LOCAL πλαίσιο της επιφάνειας ΜΙΑ φορά. Έτσι όλη η τομή τρέχει στα μικρά
  // μεγέθη για τα οποία χτίστηκε το local frame (ADR-635/650 M1) — σε ΕΓΣΑ canonical mm (~1e8) οι
  // διαφορές που κρίνουν το «μέσα ή έξω» χάνονται στο float64 noise.
  const boundaryLocal = boundaryWorld.map((p) => worldToLocal(p, surface.origin));

  const acc = createVertexAccumulator();
  const triangles: [number, number, number][] = [];
  for (const tri of surface.triangles) {
    appendClippedTriangle(surface, tri, boundaryLocal, acc, triangles);
  }
  if (triangles.length === 0) return emptyLike(surface);

  return {
    positions: acc.positions,
    elevations: acc.elevations,
    triangles,
    origin: surface.origin,
    bounds: computeBounds(acc.positions, acc.elevations),
    flatTriangleCount: countFlatTriangles(triangles, acc.elevations),
  };
}

// ─── internals ─────────────────────────────────────────────────────────────────

/** Η κενή επιφάνεια που κρατά το `origin` — ώστε ο καταναλωτής να μη χάσει το πλαίσιο. */
function emptyLike(surface: TinSurface): TinSurface {
  return {
    positions: [],
    elevations: [],
    triangles: [],
    origin: surface.origin,
    bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity },
    flatTriangleCount: 0,
  };
}

/** Ένα τρίγωνο: τομή με το όριο → fan → κορυφές στον κοινό πίνακα. Εκφυλισμένο ⇒ σιωπηλά τίποτα. */
function appendClippedTriangle(
  surface: TinSurface,
  [i, j, k]: readonly [number, number, number],
  boundaryLocal: readonly Point2D[],
  acc: CollectedVertices,
  out: [number, number, number][],
): void {
  const corners = [localCorner(surface, i), localCorner(surface, j), localCorner(surface, k)];
  const plane = fitDzPlane(corners[0]!, corners[1]!, corners[2]!);
  if (!plane) return; // συνευθειακό: μηδενικό εμβαδόν, τίποτα να κρατηθεί

  const piece = clipPolygonByConvex2D(boundaryLocal, corners);
  if (piece.length < 3) return; // ολόκληρο εκτός ορίου

  // Το κομμάτι είναι ΚΥΡΤΟ (τομή κυρτού τριγώνου με ημιεπίπεδα), οπότε η βεντάλια από την πρώτη
  // κορυφή είναι εξ ορισμού έγκυρη τριγωνοποίηση — καμία ανάγκη να ξανακληθεί ο CDT.
  const indices = piece.map((p) => pushVertex(acc, p.x, p.y, dzAt(plane, p)));
  for (let f = 1; f + 1 < indices.length; f++) {
    const tri: [number, number, number] = [indices[0]!, indices[f]!, indices[f + 1]!];
    if (isDegenerate(tri)) continue;
    out.push(tri);
  }
}

/**
 * Η κορυφή `index` ως `DzVertex` όπου το «πεδίο» είναι το **ίδιο το υψόμετρο**.
 *
 * Η επαναχρησιμοποίηση του `fitDzPlane`/`dzAt` δεν είναι κόλπο: εκείνα προσαρμόζουν ένα επίπεδο σε
 * τρεις βαθμωτές τιμές πάνω από ένα τρίγωνο — το ερώτημα είναι ταυτόσημο είτε η τιμή λέγεται Δz
 * (cut/fill) είτε z (εδώ, με αναφορά το μηδέν). Δεύτερο αντίγραφο του ίδιου προσδιορισμού επιπέδου
 * θα ήταν ακριβώς ο structural clone του N.18 — και, χειρότερα, δύο εκδοχές του πότε ένα τρίγωνο
 * θεωρείται εκφυλισμένο.
 */
function localCorner(surface: TinSurface, index: number): DzVertex {
  const [x, y] = surface.positions[index]!;
  return { x, y, dz: surface.elevations[index]! };
}

/** Το dedup grid μπορεί να συγχωνεύσει δύο κορυφές μιας λεπτής σχιστής — τότε δεν είναι τρίγωνο. */
function isDegenerate([a, b, c]: readonly [number, number, number]): boolean {
  return a === b || b === c || a === c;
}
