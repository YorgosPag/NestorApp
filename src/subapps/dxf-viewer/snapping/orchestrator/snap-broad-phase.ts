/**
 * 🎯 ADR-728 Φ2 — ΕΝΑ broad phase, στο επίπεδο του snap orchestrator (AutoCAD APERTURE parity).
 *
 * ## Η ερώτηση, μία φορά
 *
 * «Ποιες οντότητες είναι κοντά στον κέρσορα;» απαντιόταν **έως και 11 φορές ανά κίνηση** — μία
 * ανά engine που σαρώνει το `context.entities` (grep-verified 2026-07-30: `Center`, `Extension`,
 * `Insertion`, `Nearest`, `Near`, `OrthoTrack`, `Parallel`, `Perpendicular`, `Quadrant`,
 * `Tangent`, `WallFace`). Είναι **μία** ερώτηση με **μία** σωστή απάντηση (ADR-728 §3.3, N.0.2):
 * απαντιέται εδώ, **πριν** από τον βρόχο των engines, και το αποτέλεσμα παραδίδεται σε όλες.
 *
 * Το AutoCAD κάνει ακριβώς αυτό εδώ και δεκαετίες: *«Object snap applies only to objects inside
 * or crossing the object snap target box»* (ADR-728 §4.1). Το APERTURE **είναι** broad phase.
 *
 * ## Τι ΔΕΝ κάνει
 *
 * - **Δεν χτίζει νέο spatial index.** Χρησιμοποιεί τον υπάρχοντα SSoT (`core/spatial/`) μέσω του
 *   `spatialIndexFactory` (ADR-728 §3.4 — η υποδομή υπήρχε, απλά στο λάθος επίπεδο).
 * - **Δεν ξαναγράφει per-type bounds μαθηματικά.** Καλεί το SSoT `resolveEntityBounds`
 *   (`rendering/hitTesting/entity-bounds-ssot.ts`, ADR-587 Φ9) — το ίδιο που χρησιμοποιεί το
 *   marquee (Twin B). N.18: μηδέν δίδυμο.
 * - **Δεν αλλάζει ποιος νικά.** Αλλάζει **ποιες οντότητες εξετάζονται**, ποτέ ποιος κερδίζει
 *   (ADR-728 §8.2). Η διατήρηση της **σειράς σκηνής** στο {@link selectBroadPhaseCandidates}
 *   είναι μέρος αυτής της εγγύησης, όχι λεπτομέρεια.
 *
 * ## Η αρχή ασφαλείας: **υπερ-εκτίμηση ναι, υπο-εκτίμηση ΠΟΤΕ**
 *
 * Κάθε αβεβαιότητα λύνεται υπέρ της συμπερίληψης (ADR-728 §Φ2.1). Οντότητα χωρίς bounds
 * (τύπος χωρίς provider), οντότητα που πέταξε exception, index που δεν χτίστηκε, aperture που
 * δεν υπολογίστηκε ⇒ **περνά ολόκληρη η σκηνή**. Χειρότερη απόδοση, **ποτέ** άλλο αποτέλεσμα.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-728-snap-broad-phase-and-navigation-suspension.md §5 Φ2
 */

import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType, type Entity } from '../extended-types';
// ADR-587 Φ9 — SSoT per-type 2D bounds (ο ίδιος resolver που τροφοδοτεί το marquee).
import { resolveEntityBounds, type BoundingBox2D } from '../../rendering/hitTesting/entity-bounds-ssot';
// ADR-728 §3.4 — ΥΠΑΡΧΟΝ spatial SSoT· καμία νέα υλοποίηση ευρετηρίου.
import { spatialIndexFactory, SpatialIndexType, type ISpatialIndex, type SpatialBounds } from '../../core/spatial';
// Ο μεγαλύτερος συντελεστής που εφαρμόζει ΟΠΟΙΑΔΗΠΟΤΕ engine πάνω στην ανοχή της (βλ. §Aperture).
import { SNAP_RADIUS_MULTIPLIERS } from '../../config/tolerance-config';
// 🏢 ADR-735 — η πλευρά κελιού είναι SSoT στο `core/spatial/grid-sizing.ts`. Ζούσε **εδώ** ως
// `private` (ADR-728 Φ2) με το σωστό επιχείρημα ήδη γραμμένο — αλλά έτσι το ωφελούνταν μόνο αυτό
// το ένα ευρετήριο, ενώ τα εννέα ιδιωτικά των snap engines έμεναν στο πάγιο `50` που τους κόστιζε
// 16-19ms ανά κλήση. Μετακόμισε (MOVE, όχι copy — N.18) για να το μοιράζονται όλοι.
import { resolveGridSize } from '../../core/spatial/grid-sizing';

// ────────────────────────────────────────────────────────────────────────────
// Σταθερές συντονισμού — κάθε μία με μετρήσιμο επιχείρημα, όχι με αίσθηση
// ────────────────────────────────────────────────────────────────────────────

/**
 * Πόσο **πλατύτερο** από τη μεγαλύτερη ανοχή τύπου είναι το κουτί του broad phase.
 *
 * **Γιατί δεν αρκεί το `worldRadiusForType`:** τρεις engines πολλαπλασιάζουν την ανοχή τους πριν
 * ψάξουν — `Perpendicular`/`Extension`/`OrthoTrack` με `SNAP_RADIUS_MULTIPLIERS.STANDARD` (1,5×)
 * και `Parallel` με `EXTENDED` (2×) (grep-verified 2026-07-30, `snapping/engines/`). Αν το κουτί
 * ήταν 1,0× η ανοχή, η `Perpendicular` θα έχανε πόδια καθέτου που σήμερα βρίσκει ⇒ **αλλαγή
 * συμπεριφοράς**. Παίρνουμε τον **μέγιστο** συντελεστή που υπάρχει στον κώδικα, από το SSoT
 * `tolerance-config` — αν κάποιος τον ανεβάσει, το κουτί ακολουθεί αυτόματα.
 *
 * Κόστος της υπερ-εκτίμησης: το κουτί διπλασιάζει πλευρά ⇒ ~4× εμβαδόν ⇒ ~4× υποψήφιοι. Σε
 * μετρημένη πυκνότητα (2.909 οντότητες, ADR-728 §2.3) αυτό είναι ~5-50 αντί για ~2-12 — και τα
 * δύο τρεις τάξεις μεγέθους κάτω από το 2.909. **Η ασφάλεια είναι φθηνή· η υπο-εκτίμηση όχι.**
 */
const BROAD_PHASE_REACH_MULTIPLIER: number = SNAP_RADIUS_MULTIPLIERS.EXTENDED;

/**
 * Οντότητα που καλύπτει περισσότερα από τόσα κελιά (π.χ. πλαίσιο σχεδίου, μεγάλο hatch) **δεν
 * ευρετηριάζεται**: μπαίνει στο «πάντα μέσα» σύνολο. Δύο λόγοι, και οι δύο μετρήσιμοι:
 * (α) το `GridSpatialIndex.insert` γράφει την οντότητα σε **κάθε** κελί που τέμνει — κόστος
 * O(κελιά) στο χτίσιμο· (β) μια τέτοια οντότητα επιστρέφεται ούτως ή άλλως για σχεδόν κάθε θέση
 * κέρσορα, οπότε το ευρετήριο δεν κερδίζει τίποτα από αυτήν. Υπερ-εκτίμηση ⇒ ασφαλές.
 */
const MAX_CELLS_PER_ENTITY = 64;

/** Περιθώριο γύρω από την ένωση των AABB, ως ποσοστό της μεγαλύτερης διάστασης. */
const BOUNDS_MARGIN_RATIO = 0.05;

// ────────────────────────────────────────────────────────────────────────────
// Τύποι
// ────────────────────────────────────────────────────────────────────────────

/**
 * Το χτισμένο broad phase: ένα χωρικό ευρετήριο πάνω σε AABB οντοτήτων + το σύνολο των
 * οντοτήτων που **παρακάμπτουν** το ευρετήριο (fail-open ή υπερ-μεγέθη).
 */
export interface SnapBroadPhase {
  /** Το ΥΠΑΡΧΟΝ `ISpatialIndex` SSoT, γεμάτο με ένα item ανά ευρετηριάσιμη οντότητα. */
  readonly index: ISpatialIndex;
  /** Ids που περνούν **πάντα** — άγνωστα bounds ή οντότητες που καλύπτουν όλο το σχέδιο. */
  readonly alwaysInclude: ReadonlySet<string>;
  /** Πόσες οντότητες μπήκαν όντως στο ευρετήριο (διαγνωστικό· `index.itemCount` mirror). */
  readonly indexedCount: number;
}

/** Οι δύο συναρτήσεις ανοχής του `SnapContextManager`, ως εξάρτηση αντί για global. */
export interface SnapApertureResolver {
  worldRadiusAt: (point: Point2D) => number;
  worldRadiusForType: (point: Point2D, snapType: ExtendedSnapType) => number;
}

// ────────────────────────────────────────────────────────────────────────────
// Χτίσιμο
// ────────────────────────────────────────────────────────────────────────────

/**
 * AABB μιας οντότητας μέσω του SSoT resolver, με **fail-open** σε κάθε αστοχία.
 *
 * `null` σημαίνει «δεν ξέρω πού είναι» ⇒ ο καλών την βάζει στο «πάντα μέσα». Τρεις πηγές του
 * `null`: τύπος χωρίς provider (ο resolver επιστρέφει `null` by design), exception μέσα σε
 * provider (μισοφτιαγμένη οντότητα — ο snap δεν είναι το σωστό μέρος για να σκάσει), και μη
 * πεπερασμένα bounds (ADR-510 Φ5: ένα NaN δηλητηριάζει ολόκληρο το ευρετήριο).
 */
function resolveIndexableBounds(entity: Entity): BoundingBox2D | null {
  let box: BoundingBox2D | null;
  try {
    box = resolveEntityBounds(entity);
  } catch {
    return null;
  }
  if (!box) return null;
  const finite = Number.isFinite(box.minX) && Number.isFinite(box.minY)
    && Number.isFinite(box.maxX) && Number.isFinite(box.maxY);
  return finite ? box : null;
}

/** Ένωση AABB + περιθώριο, ώστε **καμία** διάσταση να μην είναι μηδενική (πλέγμα με 0 γραμμές). */
function unionWithMargin(boxes: readonly BoundingBox2D[]): SpatialBounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  const extent = Math.max(maxX - minX, maxY - minY);
  // Εκφυλισμένη σκηνή (όλες οι οντότητες σε ΕΝΑ σημείο): το φιλτράρισμα δεν έχει τι να κερδίσει
  // και το πλέγμα δεν έχει κλίμακα να συντονιστεί ⇒ ο καλών γυρίζει σε pass-through.
  if (!Number.isFinite(extent) || extent <= 0) return null;
  const margin = extent * BOUNDS_MARGIN_RATIO;
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}

/** Πόσα κελιά καλύπτει ένα AABB — φράγμα κόστους εισαγωγής (βλ. {@link MAX_CELLS_PER_ENTITY}). */
function coveredCellCount(box: BoundingBox2D, gridSize: number): number {
  const cols = Math.floor((box.maxX - box.minX) / gridSize) + 1;
  const rows = Math.floor((box.maxY - box.minY) / gridSize) + 1;
  return cols * rows;
}

/**
 * Χτίζει το broad phase για μια σκηνή. `null` ⇒ **δεν υπάρχει χρήσιμο ευρετήριο**, ο καλών
 * οφείλει να δουλέψει σε pass-through (καμία αλλαγή συμπεριφοράς — ADR-728 §Φ2 «δικλείδα»).
 *
 * Ο κύκλος ζωής **δεν ανήκει εδώ**: το πότε ξαναχτίζεται είναι απόφαση του orchestrator, ο
 * οποίος τρέχει ήδη πίσω από το idle-deferred + fingerprint-guarded `useGlobalSnapSceneSync`.
 */
export function buildSnapBroadPhase(entities: readonly Entity[]): SnapBroadPhase | null {
  if (entities.length === 0) return null;

  const indexable: Array<{ id: string; box: BoundingBox2D }> = [];
  const alwaysInclude = new Set<string>();
  for (const entity of entities) {
    const box = resolveIndexableBounds(entity);
    if (box) indexable.push({ id: entity.id, box });
    else alwaysInclude.add(entity.id);   // fail-open: άγνωστη θέση ⇒ πάντα υποψήφια
  }
  if (indexable.length === 0) return null;

  const bounds = unionWithMargin(indexable.map(i => i.box));
  if (!bounds) return null;

  const gridSize = resolveGridSize(bounds, indexable.length);
  const index = createIndex(bounds, gridSize);
  if (!index) return null;

  fillIndex(index, indexable, gridSize, alwaysInclude);
  return { index, alwaysInclude, indexedCount: index.itemCount };
}

/** Δημιουργία μέσω του ΥΠΑΡΧΟΝΤΟΣ factory· αστοχία ⇒ `null` ⇒ pass-through. */
function createIndex(bounds: SpatialBounds, gridSize: number): ISpatialIndex | null {
  try {
    return spatialIndexFactory.create({ indexType: SpatialIndexType.GRID, bounds, gridSize });
  } catch {
    return null;
  }
}

/** Εισαγωγή με φράγμα κόστους + fail-open ανά item. Μεταλλάσσει το `alwaysInclude`. */
function fillIndex(
  index: ISpatialIndex,
  indexable: ReadonlyArray<{ id: string; box: BoundingBox2D }>,
  gridSize: number,
  alwaysInclude: Set<string>,
): void {
  for (const { id, box } of indexable) {
    if (coveredCellCount(box, gridSize) > MAX_CELLS_PER_ENTITY) {
      alwaysInclude.add(id);
      continue;
    }
    try {
      index.insert({ id, bounds: { minX: box.minX, minY: box.minY, maxX: box.maxX, maxY: box.maxY } });
    } catch {
      alwaysInclude.add(id);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Aperture + ερώτημα
// ────────────────────────────────────────────────────────────────────────────

/**
 * Η ημιπλευρά του aperture box: **μέγιστη** ενεργή ακτίνα, όχι κάποια ακτίνα.
 *
 * ADR-728 §Φ2.1: *«Το aperture δεν είναι ένα»* — το `perModePxTolerance` δίνει 10-30px ανά τύπο
 * (π.χ. `BIM_WALL_FACE` 30, `GUIDE`/`SELECTED_GRIP` 12, τα υπόλοιπα 10). Αν το κουτί χτιστεί με
 * την ανοχή ενός τύπου, κόβει υποψηφίους που μια **πιο ανεκτική** engine θα δεχόταν. Το μέγιστο
 * είναι ο μόνος ασφαλής επιλογέας — και μπαίνει και το βασικό `worldRadiusAt` ως δάπεδο, γιατί
 * τύπος χωρίς εγγραφή στο `perModePxTolerance` πέφτει πίσω σε αυτό.
 *
 * Μη πεπερασμένο/μη θετικό αποτέλεσμα **δεν** διορθώνεται εδώ — το {@link selectBroadPhaseCandidates}
 * το διαβάζει ως «δεν ξέρω» και γυρίζει σε pass-through (ένα σημείο απόφασης, όχι δύο).
 */
export function resolveBroadPhaseAperture(
  cursorPoint: Point2D,
  enabledTypes: ReadonlySet<ExtendedSnapType>,
  resolver: SnapApertureResolver,
): number {
  let maxRadius = resolver.worldRadiusAt(cursorPoint);
  for (const snapType of enabledTypes) {
    const radius = resolver.worldRadiusForType(cursorPoint, snapType);
    if (Number.isFinite(radius) && radius > maxRadius) maxRadius = radius;
  }
  return maxRadius * BROAD_PHASE_REACH_MULTIPLIER;
}

/**
 * Το φιλτραρισμένο σύνολο υποψηφίων — **στη σειρά της σκηνής**.
 *
 * 🔴 **Η σειρά είναι ορθότητα, όχι αισθητική.** Οι engines κόβουν στο `context.maxCandidates`
 * (`BaseSnapEngine.processCandidateLoop`, γρ. 125/129) και ο βρόχος του orchestrator έχει
 * sub-pixel early-exit· άλλη σειρά ⇒ άλλοι υποψήφιοι στο φράγμα ⇒ **άλλος νικητής**. Γι' αυτό το
 * αποτέλεσμα παράγεται με `filter` πάνω στον **αρχικό** πίνακα και όχι από τη σειρά του
 * ερωτήματος (που είναι ταξινομημένη κατά απόσταση από το `BaseSpatialIndex.finalizeResults`).
 * Το O(N) πέρασμα με `Set.has` είναι μικροδευτερόλεπτα — τάξεις μεγέθους κάτω από τη γεωμετρία
 * που γλιτώνει.
 *
 * Ο ίδιος `id` μπορεί θεωρητικά να επιστραφεί από πολλά items· το `Set` το εξουδετερώνει.
 */
export function selectBroadPhaseCandidates(
  broadPhase: SnapBroadPhase,
  entities: readonly Entity[],
  cursorPoint: Point2D,
  apertureRadius: number,
): Entity[] {
  if (!Number.isFinite(apertureRadius) || apertureRadius <= 0) return entities.slice();
  if (!Number.isFinite(cursorPoint.x) || !Number.isFinite(cursorPoint.y)) return entities.slice();

  const near = queryNearIds(broadPhase.index, cursorPoint, apertureRadius);
  if (!near) return entities.slice();   // fail-open: το ερώτημα απέτυχε

  const { alwaysInclude } = broadPhase;
  return entities.filter(entity => near.has(entity.id) || alwaysInclude.has(entity.id));
}

/** `queryBounds` πάνω στο aperture box ⇒ Set από ids· `null` ⇒ αστοχία ⇒ fail-open στον καλούντα. */
function queryNearIds(index: ISpatialIndex, cursor: Point2D, radius: number): Set<string> | null {
  try {
    const hits = index.queryBounds({
      minX: cursor.x - radius,
      minY: cursor.y - radius,
      maxX: cursor.x + radius,
      maxY: cursor.y + radius,
    });
    const ids = new Set<string>();
    for (const hit of hits) ids.add(hit.item.id);
    return ids;
  } catch {
    return null;
  }
}
