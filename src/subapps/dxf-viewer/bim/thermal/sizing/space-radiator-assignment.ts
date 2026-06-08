/**
 * ADR-422 L2 — Space ↔ Radiator assignment (point-in-polygon) — PURE SSoT.
 *
 * Αντιστοιχεί κάθε θερμαντικό σώμα στον θερμικό χώρο που το περιέχει (Revit auto:
 * το σημείο τοποθέτησης του σώματος μέσα στο όριο του χώρου). Όταν ένας χώρος έχει
 * N σώματα, το φορτίο του (Φ_room) μοιράζεται ισόποσα (Φ_room/N) — απλή Revit-like
 * κατανομή· `siblingCount` εκτίθεται ώστε ο consumer να υπολογίσει το μερίδιο.
 *
 * ΚΑΜΙΑ αριθμητική φορτίου εδώ — μόνο γεωμετρική αντιστοίχιση. Reuse του SSoT
 * `pointInPolygon` (ίδιο με `ThermalSpaceRenderer.hitTest`). `position` + footprint
 * είναι στο ΙΔΙΟ coordinate system (scene units) → unit-agnostic, καμία μετατροπή.
 *
 * @see ../../geometry/shared/polygon-utils (pointInPolygon)
 * @see ./radiator-sizing (consumer — required output per radiator)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L2)
 */

import { pointInPolygon } from '../../geometry/shared/polygon-utils';
import type { MepRadiatorEntity } from '../../types/mep-radiator-types';
import type { ThermalSpaceEntity } from '../../types/thermal-space-types';

/** Αντιστοίχιση ενός σώματος σε χώρο + πλήθος αδελφών σωμάτων στον ίδιο χώρο. */
export interface RadiatorSpaceLink {
  /** Το id του θερμικού χώρου που περιέχει το σώμα. */
  readonly spaceId: string;
  /** Πλήθος σωμάτων στον ίδιο χώρο (≥1) — για ισοκατανομή Φ_room/N. */
  readonly siblingCount: number;
}

/** Αποτέλεσμα αντιστοίχισης ορόφου (αμφίδρομα ευρετήρια). */
export interface RadiatorSpaceAssignment {
  /** radiatorId → χώρος + siblingCount. Σώματα εκτός κάθε χώρου απουσιάζουν. */
  readonly byRadiator: ReadonlyMap<string, RadiatorSpaceLink>;
  /** spaceId → ids σωμάτων του χώρου. */
  readonly bySpace: ReadonlyMap<string, readonly string[]>;
}

/**
 * Αντιστοιχεί σώματα σε χώρους με point-in-polygon. Pure/idempotent. Ένα σώμα
 * αντιστοιχεί στον ΠΡΩΤΟ χώρο που το περιέχει (οι θερμικοί χώροι δεν επικαλύπτονται).
 */
export function assignRadiatorsToSpaces(
  radiators: readonly MepRadiatorEntity[],
  spaces: readonly ThermalSpaceEntity[],
): RadiatorSpaceAssignment {
  const bySpace = new Map<string, string[]>();
  const radiatorSpace = new Map<string, string>();

  for (const radiator of radiators) {
    const p = radiator.params.position;
    const space = spaces.find((s) =>
      pointInPolygon(p, s.params.footprint.vertices),
    );
    if (!space) continue;
    radiatorSpace.set(radiator.id, space.id);
    const list = bySpace.get(space.id);
    if (list) list.push(radiator.id);
    else bySpace.set(space.id, [radiator.id]);
  }

  const byRadiator = new Map<string, RadiatorSpaceLink>();
  for (const [radiatorId, spaceId] of radiatorSpace) {
    byRadiator.set(radiatorId, {
      spaceId,
      siblingCount: bySpace.get(spaceId)?.length ?? 1,
    });
  }

  return { byRadiator, bySpace };
}
