/**
 * Polygon-vertex lock store — zero-React SSoT για το Φ6b edge-slide state (ADR-514 Φ6).
 *
 * **Γιατί υπάρχει:** το edge-slide χρειάζεται να θυμάται σε ΠΟΙΑ παρειά κούμπωσε η **προηγούμενη**
 * κορυφή ώστε η επόμενη να γλιστρά κατά μήκος της. Αυτό το state πρέπει να το διαβάζουν ΔΥΟ διαφορετικά
 * call sites: (α) το **commit** (`useSlabTool`/`useRoofTool.onCanvasClick`) και (β) το **preview**
 * (`drawing-preview-generator` → slab/roof branch). Ζει **εδώ, μία φορά** (zero-React, mirror
 * `ImmediateSnapStore`) → preview ≡ commit by construction· μηδέν διπλό state ανά εργαλείο.
 *
 * Single-writer: ο ΕΝΑΣ ενεργός polygon tool (πλάκα Ή στέγη — ποτέ ταυτόχρονα). Γράφει τον lock μετά
 * από κάθε κορυφή, `reset()` on activate/commit/deactivate. Multi-reader: commit + preview.
 *
 * @see ./polygon-vertex-snap.ts — ο pure resolver που καταναλώνει τον `PolygonVertexLock`
 * @see docs/centralized-systems/reference/adrs/ADR-514-unified-bim-cursor-snap.md §Φ6
 */

import type { PolygonVertexLock } from './polygon-vertex-snap';

let current: PolygonVertexLock | null = null;

export const polygonVertexLockStore = {
  /** Reader (non-React) — commit + preview διαβάζουν τον lock της προηγούμενης κορυφής. */
  get(): PolygonVertexLock | null {
    return current;
  },
  /** Writer — ο ενεργός tool θέτει τον lock της μόλις-τοποθετημένης κορυφής (`null` = ελεύθερη). */
  set(lock: PolygonVertexLock | null): void {
    current = lock;
  },
  /** Reset — on activate / commit (νέο πολύγωνο) / deactivate (μηδέν leak σε άλλο εργαλείο). */
  reset(): void {
    current = null;
  },
};
