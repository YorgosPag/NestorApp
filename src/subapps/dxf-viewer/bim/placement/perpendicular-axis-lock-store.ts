/**
 * Perpendicular-axis lock store — zero-React SSoT για το κλείδωμα του **δεύτερου κλικ** του εργαλείου
 * «κάθετη γραμμή» (`line-perpendicular`, Revit-grade 2-click, επέκταση ADR-508 §line-cyan).
 *
 * **Γιατί υπάρχει:** στο 1ο κλικ η βάση κουμπώνει flush πάνω στην παρειά μιας υφιστάμενης οντότητας και
 * καταγράφεται ο **κάθετος άξονας** (`faceFrame.perpDir`). Στο 2ο κλικ (και σε κάθε hover ανάμεσα) η
 * γραμμή πρέπει να μένει **κλειδωμένη κάθετη** σε αυτόν τον άξονα — άρα το state αυτό το διαβάζουν ΔΥΟ
 * διαφορετικά call sites: (α) το **preview** (`drawing-hover-handler` → hard axis lock) και (β) το
 * **commit** (`resolveLineFamilyCommitPoint` στο `drawing-handler-utils`). Ζει **εδώ, μία φορά**
 * (zero-React, mirror `polygonVertexLockStore`/`ImmediateSnapStore`) → preview ≡ commit by construction.
 *
 * Single-writer: ο ΕΝΑΣ ενεργός `line-perpendicular` tool (γράφει τον lock στο 1ο κλικ). Multi-reader:
 * preview + commit. `reset()` on click-2 consume / tool change / cancel (μηδέν leak σε άλλο εργαλείο).
 *
 * @see ./polygon-vertex-lock-store.ts — ο αδελφός του (ίδιο pattern, edge-slide)
 * @see ../../hooks/drawing/line-perpendicular-preview-helpers.ts — pure resolver/projection που τον καταναλώνει
 * @see docs/centralized-systems/reference/adrs/ADR-060-line-perpendicular-tool.md
 */

import type { Point2D } from '../../rendering/types/Types';

export interface PerpendicularAxisLock {
  /** Flush foot που κλειδώθηκε στο 1ο κλικ (γίνεται και `tempPoints[0]`). */
  readonly base: Point2D;
  /** Μοναδιαίο κάθετο διάνυσμα (`faceFrame.perpDir`) — ο κλειδωμένος άξονας της γραμμής. */
  readonly dir: Point2D;
}

let current: PerpendicularAxisLock | null = null;

export const perpendicularAxisLockStore = {
  /** Reader (non-React) — preview + commit διαβάζουν τον κλειδωμένο κάθετο άξονα. */
  get(): PerpendicularAxisLock | null {
    return current;
  },
  /** Writer — ο ενεργός tool θέτει τον lock στο 1ο κλικ (`null` = ελεύθερη κίνηση, καμία κάθετη). */
  set(lock: PerpendicularAxisLock | null): void {
    current = lock;
  },
  /** Reset — on click-2 consume / tool change / cancel (μηδέν leak σε άλλο εργαλείο). */
  reset(): void {
    current = null;
  },
};
