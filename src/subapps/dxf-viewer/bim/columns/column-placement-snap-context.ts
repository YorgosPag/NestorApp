/**
 * Column placement ghost-status — pure SSoT (ADR-398 §Column→Beam axis snap, §ghost coloring).
 *
 * Κατά την τοποθέτηση κολώνας (freehand), δίνει **σημασιολογικό status** ανάλογα με το τι
 * βρίσκεται κάτω από το σταυρόνημα, ώστε το ghost να χρωματίζεται (Revit/AutoCAD pattern):
 *   · `beam`    → ο cursor κουμπώνει στον **άξονα** δοκαριού (το ενιαίο snap pipeline —
 *                 `NearestSnapEngine` `bim-beam` — έχει ήδη snap-άρει εκεί). Ghost = 🟢, η
 *                 κολώνα τοποθετείται κεντραρισμένη στον άξονα (`useColumnTool` center-anchor).
 *   · `overlap` → ο cursor είναι μέσα σε footprint υπάρχουσας κολώνας (ή snap σε κολώνα) →
 *                 σύγκρουση/επικάλυψη. Ghost = 🔴 (προειδοποίηση, τοποθετείται ακόμη).
 *   · `neutral` → ελεύθερη τοποθέτηση.
 *
 * **Thin reader (ADR-398 bugfix 2026-06-19):** το status παράγεται από το ΑΠΟΤΕΛΕΣΜΑ του
 * ενιαίου snap (`snapResult.snapPoint.entityId`) + ένα light footprint-overlap έλεγχο — ΟΧΙ
 * από παράλληλη ανίχνευση δοκαριού. Έτσι το snap pipeline (γλυφές + ετικέτες) δεν καταπνίγεται.
 *
 * Pure — zero React/DOM/Firestore. Reuse `isColumnEntity`/`isBeamEntity` (type SSoT) +
 * `isPointInPolygon` (hit-test SSoT). Μονάδες: scene units (worldPos + entities ομοιόμορφα).
 *
 * @see ../beams/beam-axis-projection.ts — projectPointOnBeamAxis (NearestSnapEngine beam SSoT)
 * @see ../../systems/cursor/snap-scheduler.ts — move-path consumer (ghost status)
 * @see ../../systems/cursor/ColumnPlacementGhostStatusStore.ts — το zero-React store
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import { findEntityOverlap } from '../geometry/entity-overlap';
import type { ColumnGhostStatus } from '../../systems/cursor/ColumnPlacementGhostStatusStore';
import type { ProSnapResult } from '../../snapping/extended-types';
import { resolveProjectedSnap, type CornerProjectionResult } from '../../systems/cursor/corner-projection-snap';

/** Το επιλεγμένο snap για την τοποθέτηση κολώνας: η γλυφή/ετικέτα (`snapResult`) + το σημείο
 *  στο οποίο κουμπώνει το ghost (`ghostPoint`, με την corner-διόρθωση όταν υπάρχει). */
export interface ColumnDrawSnap {
  readonly snapResult: ProSnapResult;
  readonly ghostPoint: Point2D;
}

/**
 * ADR-398 §3.10 — Σημείωση: το παλιό `resolveColumnFaceSnapWithGlyph` (face-snap + glyph
 * magnetic-pull μέσα στον ίδιο resolver) ΑΦΑΙΡΕΘΗΚΕ. Η μαγνητική έλξη σε ορατό BIM χαρακτηριστικό
 * έρχεται πλέον ΔΩΡΕΑΝ μέσω του normal scheduler path → `ImmediateSnap` → `resolveEffectivePreviewCursor`
 * (ίδιο pattern με τοίχο/δοκάρι)· το face-snap υπολογίζεται σύγχρονα στο preview/commit
 * (`resolveColumnFaceSnapFromTargets`). Η δημοσίευση της γλυφής/ετικέτας γίνεται από το normal
 * `publishSnapMarker` του scheduler.
 */

/**
 * Επιλέγει το snap που θα δειχθεί + θα κουμπώσει το ghost κατά την τοποθέτηση κολώνας, με
 * **Revit-grade προτεραιότητα** (λύνει το bug «οι έλξεις εξαφανίζονται στο εργαλείο Κολώνα»):
 *
 *   1. **Ορατό corner-projection** — μια γωνία της would-be κολώνας κουμπώνει σε **διακριτό**
 *      στόχο (γωνία/άκρο/τομή): κρατάμε την ευθυγράμμιση γωνίας (γλυφή στον στόχο).
 *   2. **Ορατό cursor snap** — BIM χαρακτηριστικό (Γωνία/Μέσο/Κέντρο στήλης/δοκαριού, ή άξονας
 *      δοκαριού) κάτω από το σταυρόνημα: **η ρητή πρόθεση** του χρήστη. (Πριν το έκρυβε ένα
 *      corner-projection που κουμπούσε σε **σιωπηλό grid** → καμία γλυφή.)
 *   3. **Σιωπηλό fallback** — grid/guide ευθυγράμμιση (corner > cursor) για να μη χαθεί το
 *      placement-snap όταν δεν υπάρχει ορατό χαρακτηριστικό.
 *
 * Pure. `drawCorner` = το αποτέλεσμα του `findColumnDrawCornerSnap` (ο scheduler το υπολογίζει,
 * αφού κατέχει το column-tool handle). `findSnapPoint` = ο ενιαίος snap engine (cursor query).
 */
export function resolveColumnDrawSnap(
  cursorPos: Readonly<Point2D>,
  drawCorner: CornerProjectionResult | null,
  findSnapPoint: (x: number, y: number) => ProSnapResult | null,
): ColumnDrawSnap | null {
  // Thin wrapper πάνω στο κοινό priority SSoT (ADR-560 §grip-OSNAP-unified). Το draw path κρατά
  // ΚΑΙ τις σιωπηλές placement-έλξεις (grid placement είναι θεμιτό στο εργαλείο), οπότε δέχεται
  // κάθε αποτέλεσμα του `resolveProjectedSnap` ανεξαρτήτως `visible` — ίδια 4-tier σειρά με πριν.
  const picked = resolveProjectedSnap(cursorPos, drawCorner, findSnapPoint);
  return picked ? { snapResult: picked.snapResult, ghostPoint: picked.ghostPoint } : null;
}

/** Η πρώτη υπάρχουσα κολώνα της οποίας το footprint περιέχει τον cursor (`null` αν καμία).
 *  Delegate στο ουδέτερο `findEntityOverlap` SSoT (column extractor = `geometry.footprint`). */
export function findColumnOverlap(
  worldPos: Readonly<Point2D>,
  entities: readonly Entity[],
): string | null {
  return findEntityOverlap(worldPos, entities, (e) =>
    isColumnEntity(e) ? e.geometry?.footprint?.vertices : null,
  );
}

/**
 * Παράγει το ghost status από το ΑΠΟΤΕΛΕΣΜΑ του ενιαίου snap (thin reader, ΕΝΑ SSoT).
 *
 * Precedence **overlap > beam > neutral**:
 *   · footprint υπάρχουσας κολώνας **ή** snap σε κολώνα → `overlap` (🔴 — μην βάλεις διπλή·
 *     ισχύει ΑΚΟΜΗ κι όταν από κάτω περνά δοκάρι, π.χ. ενδιάμεση κολώνα στη μέση δοκαριού).
 *   · αλλιώς snap σε δοκάρι (`NearestSnapEngine` beam-axis) → `beam` (🟢).
 *   · αλλιώς → `neutral`. Pure.
 *
 * @param snapEntityId το `snapResult.snapPoint?.entityId` του ενιαίου snap (ή null).
 */
export function resolveColumnGhostStatusFromSnap(
  worldPos: Readonly<Point2D>,
  entities: readonly Entity[],
  snapEntityId: string | null | undefined,
): ColumnGhostStatus {
  const snapped = snapEntityId
    ? entities.find((e) => e.id === snapEntityId) ?? null
    : null;
  if (findColumnOverlap(worldPos, entities) || (snapped && isColumnEntity(snapped))) {
    return 'overlap';
  }
  if (snapped && isBeamEntity(snapped)) {
    return 'beam';
  }
  return 'neutral';
}
