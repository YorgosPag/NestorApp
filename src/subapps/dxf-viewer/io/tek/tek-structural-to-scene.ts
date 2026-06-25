/**
 * ADR-531 Φ5b.1+ (Tekton .TEK IMPORT — structural, faithful 2Δ) — mappers `TekWallRecord`/
 * `TekDimRecord` → 2Δ scene primitives που **αναπαράγουν το σύμβολο του Τέκτονα**:
 *
 *   - **Τοίχος** → παρειές με κομμένα ανοίγματα + jamb returns ({@link buildWallCutoutSegments}).
 *   - **Παράθυρο** → υαλοπίνακας/φύλλο μέσα στο άνοιγμα ({@link buildWindowSymbolSegments}).
 *   - **Διάσταση** → γραμμή + βοηθητικές + πλάγιες παύλες άκρων + κείμενο ({@link buildDimensionSymbol}).
 *
 * Όλη η γεωμετρία υπολογίζεται σε Tekton μέτρα στα pure modules· εδώ γίνεται ΜΟΝΟ η μετατροπή
 * μονάδων + Y-flip (SSoT `tekMetersToScene`/`metersToScene`) + χρωματισμός + δόμηση entities.
 */

import { tekMetersToScene, metersToScene } from '../../export/core/tek/tek-geometry';
import { colorHex6 } from '../../export/core/tek/tek-xml-writer';
import { generateEntityId } from '@/services/enterprise-id-convenience';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity, LineEntity, TextEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { TekDimRecord, TekWallRecord, TekPoint2D } from './tek-import-types';
import {
  buildWallCutoutSegments, buildWindowSymbolSegments, type TekSeg,
} from './tek-window-symbol';
import { buildDimensionSymbol } from './tek-dimension-symbol';

/**
 * Override χρώματος για τα end-markers (βελάκια+extension) της διάστασης. `null` → χρησιμοποιείται
 * το χρώμα της γραμμής (`<color>`, faithful στο data — μία πηγή). Calibratable σε browser-verify
 * (το target `221306` δείχνει κοκκινωπά άκρα· αλλάζει με ένα string εδώ αν το θέλει ο Giorgio).
 */
const DIM_ARROW_COLOR_OVERRIDE: string | null = null;

/** Tekton `<color>` (RGB, χωρίς `#`) → `#RRGGBB` (reuse export SSoT `colorHex6`). */
function tekColorToHex(raw: string): string {
  return `#${colorHex6(raw)}`;
}

/** Tekton-μέτρα σημείο → scene (Y-flip + units) μέσω του SSoT. */
function toScene(p: TekPoint2D, units: SceneUnits): Point2D {
  return tekMetersToScene(p.x, p.y, units);
}

/** `TekSeg` (Tekton μέτρα) → `LineEntity` (scene). */
function segToLine(s: TekSeg, color: string, units: SceneUnits): LineEntity {
  return {
    id: generateEntityId(), type: 'line', layerId: '', color,
    start: toScene(s.a, units), end: toScene(s.b, units),
  };
}

// ─── Wall + window ──────────────────────────────────────────────────────────────

/** `<wall>` → παρειές με κομμένα ανοίγματα (χρώμα τοίχου) + σύμβολο παραθύρου ανά κούφωμα. */
export function tekWallToEntities(rec: TekWallRecord, units: SceneUnits): Entity[] {
  const wallColor = tekColorToHex(rec.color);
  const out: Entity[] = buildWallCutoutSegments(rec.matrix, rec.openings).map(
    (s) => segToLine(s, wallColor, units),
  );
  for (const opening of rec.openings) {
    const openColor = tekColorToHex(opening.color);
    for (const s of buildWindowSymbolSegments(opening, rec.matrix)) {
      out.push(segToLine(s, openColor, units));
    }
  }
  return out;
}

// ─── Dimension ──────────────────────────────────────────────────────────────────

/**
 * `<dim>` → γραμμή+witness (χρώμα `<color>`) + βελάκια/extension άκρων + **κείμενο τιμής σε κίτρινο
 * `<dtext_color>`** (ο Τέκτων χρωματίζει το κείμενο ξεχωριστά). Calibration Φ5b.1++.
 */
export function tekDimToEntities(rec: TekDimRecord, units: SceneUnits): Entity[] {
  const lineColor = tekColorToHex(rec.color);
  const arrowColor = DIM_ARROW_COLOR_OVERRIDE ?? lineColor;
  // Κείμενο: ξεχωριστό `<dtext_color>` (π.χ. FFFF80 κίτρινο)· fallback στο χρώμα γραμμής αν λείπει.
  const textColor = rec.dtextColor ? tekColorToHex(rec.dtextColor) : lineColor;
  const geom = buildDimensionSymbol(rec);
  const out: Entity[] = [];
  for (const s of geom.lines) out.push(segToLine(s, lineColor, units));
  for (const s of geom.ticks) out.push(segToLine(s, arrowColor, units));
  for (const t of geom.texts) {
    const height = metersToScene(t.heightM, units);
    const text: TextEntity = {
      id: generateEntityId(), type: 'text', layerId: '', color: textColor,
      position: toScene(t.pos, units), text: t.text,
      height, fontSize: height, alignment: 'center', rotation: 0,
    };
    out.push(text);
  }
  return out;
}
