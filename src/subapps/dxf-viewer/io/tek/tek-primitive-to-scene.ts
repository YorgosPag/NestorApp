/**
 * ADR-526 Φ5a (Tekton .TEK IMPORT) — mappers `TekLineRecord`/`TekArcRecord` → scene entities.
 *
 * Αντιστρέφει τον export (`dxf-to-tek.ts` `collectTekLines`/`collectTekArcs`):
 *   - **Μονάδες + Y-flip:** μέσω του SSoT `tekMetersToScene` (μέτρα Y-up → scene units Y-down).
 *   - **Χρώμα:** `<color>` RGB αυτούσιο (ΟΧΙ BGR) + `#` μέσω του `tekColorToHex` (reuse `colorHex6`).
 *   - **Τόξο:** ο export γράφει `p0=τέλος`, `p1=αρχή` (το Y-flip αντιστρέφει τη φορά CW↔CCW).
 *     Ο import το αντιστρέφει: `startAngle` από `p1`, `endAngle` από `p0`. Αφού κέντρο/σημεία
 *     περνούν από το ΙΔΙΟ `tekMetersToScene`, το round-trip με τον export είναι ακριβές.
 */

import { tekMetersToScene, metersToScene } from '../../export/core/tek/tek-geometry';
import { colorHex6 } from '../../export/core/tek/tek-xml-writer';
import { radToDeg, normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { generateEntityId } from '@/services/enterprise-id-convenience';
import type { Point2D } from '../../rendering/types/Types';
import type { LineEntity, CircleEntity, ArcEntity, TextEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { TekLineRecord, TekArcRecord, TekTextRecord, TekXMatrix } from './tek-import-types';

/**
 * Tekton `<color>` (RGB hex, χωρίς `#`) → canonical `#RRGGBB` του Νέστορα. ΑΚΡΙΒΗΣ αντιστροφή
 * του export `colorHex6` (RGB straight, ΟΧΙ BGR swap) + το `#` που περιμένει ο renderer/CSS
 * (χωρίς `#` το `strokeStyle` είναι άκυρο → μαύρη/αόρατη γραμμή). Reuse του SSoT validation/fallback.
 */
function tekColorToHex(raw: string): string {
  return `#${colorHex6(raw)}`;
}

/** Γωνία (μοίρες) σημείου `p` γύρω από κέντρο `c`, κανονικοποιημένη σε [0, 360). */
function angleDeg(c: Point2D, p: Point2D): number {
  const deg = radToDeg(Math.atan2(p.y - c.y, p.x - c.x));
  return normalizeAngleDeg(deg);
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
    color: tekColorToHex(rec.color),
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
  const color = tekColorToHex(rec.color);
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

/**
 * Em (σε world-units) του outline γλύφου του Τέκτονα όταν το μέγεθος είναι **baked στο
 * xmatrix scale** (font=0). Καλιμπραρισμένο από δείγμα `ΚΑΤΟΨΗ` (scale 0.00628 m → label
 * ~0.25 m). Tunable — Φ5b refine για native-ttfont labels (font=30, scale≈1).
 */
const TEK_OUTLINE_GLYPH_EM = 40;
/** Πάνω από αυτό το scale ο γλύφος θεωρείται ήδη em-sized (native ttfont) → height ≈ scale. */
const TEK_NATIVE_SCALE_MIN = 0.1;

/** Ύψος κειμένου (world μέτρα) από το xmatrix vertical scale. Βλ. {@link TEK_OUTLINE_GLYPH_EM}. */
function textHeightMeters(m: TekXMatrix): number {
  const scale = Math.hypot(m.x10, m.x11);
  return scale < TEK_NATIVE_SCALE_MIN ? scale * TEK_OUTLINE_GLYPH_EM : scale;
}

/** `<hallign>` (0/1/2) → TextEntity alignment. */
function alignmentOf(hAlign: number): TextEntity['alignment'] {
  return hAlign === 1 ? 'center' : hAlign === 2 ? 'right' : 'left';
}

/**
 * `<text>` record → `TextEntity`. Περιεχόμενο inline από `<s>`· θέση από xmatrix translation
 * (Y-flipped μέσω SSoT)· ύψος από το vertical scale· περιστροφή = γωνία u-άξονα (Y-flipped).
 */
export function tekTextToEntity(rec: TekTextRecord, units: SceneUnits): TextEntity {
  const m = rec.matrix;
  const height = metersToScene(textHeightMeters(m), units);
  const rotation = -radToDeg(Math.atan2(m.x01, m.x00)) || 0; // Y-flip· || 0 αποφεύγει −0
  return {
    id: generateEntityId(),
    type: 'text',
    layerId: '',
    color: tekColorToHex(rec.color),
    position: tekMetersToScene(m.x20, m.x21, units),
    text: rec.content,
    height,
    fontSize: height,
    alignment: alignmentOf(rec.hAlign),
    rotation,
    // Διατηρεί τη γραμματοσειρά του Τέκτονα (π.χ. Arial)· αλλιώς ο renderer βάζει default.
    ...(rec.fontFamily ? { fontFamily: rec.fontFamily } : {}),
  };
}
