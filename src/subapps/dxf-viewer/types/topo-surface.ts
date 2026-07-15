/**
 * ADR-662 Φάση 2β (Δρόμος Γ) — TopoSurfaceEntity: η τοπογραφική επιφάνεια ως
 * **first-class, επιλέξιμο** scene entity (Revit Toposolid / Civil 3D Surface
 * μοντέλο — το έδαφος είναι αντικείμενο με δικές του ιδιότητες, όχι ρυθμίσεις σε
 * document-level panel).
 *
 * **Thin/derived (SSoT — απόφαση Giorgio 2026-07-16):** το entity ΔΕΝ κατέχει τη
 * γεωμετρία/ορισμό της επιφάνειας — αυτά ζουν στο per-floor `TopoSurfaceDoc`
 * (survey points/breaklines) και η TIN παράγεται από το `getTopoSurface(surfaceId)`
 * (`systems/topography/topo-surface.ts`). Το entity είναι **δείκτης** (`surfaceId`)
 * + ένα **footprint** (περίγραμμα της TIN, world canonical mm) που δίνει clickable
 * geometry στην κάτοψη — ώστε επιλογή → contextual tab + object-bound Properties
 * (relief/surface style στο `terrain-3d-store`, point-label style στο
 * `topo-point-label-store`). Ξαναχτίζεται στο load όπως οι ισοϋψείς
 * (`regenerate-topo.ts`), άρα ΔΕΝ έχει δικό του per-entity Firestore doc.
 *
 * Non-BIM (mirror `ImageEntity`/`AnnotationSymbolEntity`): 2D-only render (το 3D
 * mesh το κρατά ο υπάρχων imperative `TerrainSceneLayer`), καμία IFC/BIM-category
 * μεταχείριση → **σκόπιμα ΕΚΤΟΣ** `isBimEntityType`.
 *
 * @see types/annotation-symbol.ts — το lightweight non-BIM template
 * @see systems/topography/topo-surface.ts — η TIN SSoT (`getTopoSurface`)
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';
import type { TopoSurfaceId } from '../systems/topography/topo-types';

export interface TopoSurfaceEntity extends BaseEntity {
  type: 'topo-surface';

  /**
   * Ποια παραγόμενη επιφάνεια δείχνει το entity (`'existing'` | `'proposed'`).
   * SSoT της γεωμετρίας: `getTopoSurface(surfaceId)`.
   */
  surfaceId: TopoSurfaceId;

  /**
   * Το περίγραμμα της TIN σε **world canonical mm** — ένα ή περισσότερα κλειστά
   * rings (perimeter edges των triangles ή το picked `TopoBoundary`). Δίνει την
   * clickable/hit-test περιοχή στην κάτοψη· κάθε ring implicitly κλειστό
   * (last→first χωρίς διπλή κορυφή). Recompute από το `getTopoSurface`.
   */
  footprint: Point2D[][];
}

// ──────────────────────────────────────────────────────────────────────────────
// Type guard
// ──────────────────────────────────────────────────────────────────────────────

export const isTopoSurfaceEntity = (
  e: { type: string },
): e is TopoSurfaceEntity => e.type === 'topo-surface';
