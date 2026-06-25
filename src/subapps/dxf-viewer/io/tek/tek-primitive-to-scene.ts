/**
 * ADR-526 Φ5a (Tekton .TEK IMPORT) — mappers `TekLineRecord`/`TekArcRecord` → scene entities.
 *
 * Αντιστρέφει τον export (`dxf-to-tek.ts` `collectTekLines`/`collectTekArcs`):
 *   - **Μονάδες + Y-flip:** μέσω του SSoT `tekMetersToScene` (μέτρα Y-up → scene units Y-down).
 *   - **Χρώμα:** Tekton BGR → RGB μέσω `bgrToRgbHex`.
 *   - **Τόξο:** ο export γράφει `p0=τέλος`, `p1=αρχή` (το Y-flip αντιστρέφει τη φορά CW↔CCW).
 *     Ο import το αντιστρέφει: `startAngle` από `p1`, `endAngle` από `p0`. Αφού κέντρο/σημεία
 *     περνούν από το ΙΔΙΟ `tekMetersToScene`, το round-trip με τον export είναι ακριβές.
 */

import { tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { radToDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { generateEntityId } from '@/services/enterprise-id-convenience';
import type { Point2D } from '../../rendering/types/Types';
import type { LineEntity, CircleEntity, ArcEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { TekLineRecord, TekArcRecord } from './tek-import-types';
import { bgrToRgbHex } from './tek-primitive-extract';

/** Γωνία (μοίρες) σημείου `p` γύρω από κέντρο `c`, κανονικοποιημένη σε [0, 360). */
function angleDeg(c: Point2D, p: Point2D): number {
  const deg = radToDeg(Math.atan2(p.y - c.y, p.x - c.x));
  return ((deg % 360) + 360) % 360;
}

/** Απόσταση δύο σημείων (scene units). */
function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** `<line>` record → `LineEntity` (δύο κορυφές, Y-flipped, RGB χρώμα). */
export function tekLineToEntity(rec: TekLineRecord, units: SceneUnits): LineEntity {
  return {
    id: generateEntityId(),
    type: 'line',
    layerId: '',
    color: bgrToRgbHex(rec.colorBgr),
    start: tekMetersToScene(rec.v0x, rec.v0y, units),
    end: tekMetersToScene(rec.v1x, rec.v1y, units),
  };
}

/**
 * `<arc>` record → `CircleEntity` (αν `isCircle`) ή `ArcEntity`. Η ακτίνα προκύπτει από την
 * απόσταση κέντρου↔`p0` (περιφέρεια/ακραίο σημείο) ΜΕΤΑ το Y-flip (ισόμετρη μετατροπή).
 */
export function tekArcToEntity(rec: TekArcRecord, units: SceneUnits): CircleEntity | ArcEntity {
  const center = tekMetersToScene(rec.centreX, rec.centreY, units);
  const p0 = tekMetersToScene(rec.p0x, rec.p0y, units); // export: τέλος (κύκλος: περιφέρεια)
  const radius = dist(center, p0);
  const color = bgrToRgbHex(rec.colorBgr);
  if (rec.isCircle) {
    return { id: generateEntityId(), type: 'circle', layerId: '', color, center, radius };
  }
  const p1 = tekMetersToScene(rec.p1x, rec.p1y, units); // export: αρχή
  return {
    id: generateEntityId(),
    type: 'arc',
    layerId: '',
    color,
    center,
    radius,
    startAngle: angleDeg(center, p1),
    endAngle: angleDeg(center, p0),
  };
}
