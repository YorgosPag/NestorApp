/**
 * ADR-531 Φ5b.1+ (Tekton .TEK IMPORT — structural, faithful 2Δ) — mapper `TekWallRecord` → 2Δ
 * scene primitives που **αναπαράγουν το σύμβολο του Τέκτονα**:
 *
 *   - **Τοίχος** → παρειές με κομμένα ανοίγματα + jamb returns ({@link buildWallCutoutSegments}).
 *   - **Παράθυρο** → υαλοπίνακας/φύλλο μέσα στο άνοιγμα ({@link buildWindowSymbolSegments}).
 *
 * (Οι διαστάσεις `<dim>` χαρτογραφούνται πλέον σε native `DimensionEntity` — βλ.
 * {@link tek-dim-to-dimension}, ADR-608 — αντί για αποδόμηση σε 2Δ primitives.)
 *
 * Όλη η γεωμετρία υπολογίζεται σε Tekton μέτρα στα pure modules· εδώ γίνεται ΜΟΝΟ η μετατροπή
 * μονάδων + Y-flip (SSoT `tekMetersToScene`) + χρωματισμός + δόμηση entities.
 */

import { tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { tekColorToHex } from './tek-color';
import { generateEntityId } from '@/services/enterprise-id-convenience';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity, LineEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { TekWallRecord, TekPoint2D } from './tek-import-types';
import {
  buildWallCutoutSegments, buildWindowSymbolSegments, buildDoorSymbolSegments, isDoorStyle,
  type TekSeg,
} from './tek-window-symbol';

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

/**
 * `<wall>` → παρειές με κομμένα ανοίγματα (χρώμα τοίχου) + σύμβολο **πόρτας** (τόξο, `style=1`) ή
 * **παραθύρου** (πλαίσιο+μπινί, `style=0`) ανά κούφωμα — DXF-verified διαχωρισμός ανά `style`.
 */
export function tekWallToEntities(rec: TekWallRecord, units: SceneUnits): Entity[] {
  const wallColor = tekColorToHex(rec.color);
  const out: Entity[] = buildWallCutoutSegments(rec.matrix, rec.openings).map(
    (s) => segToLine(s, wallColor, units),
  );
  for (const opening of rec.openings) {
    const openColor = tekColorToHex(opening.color);
    const segs = isDoorStyle(opening.style)
      ? buildDoorSymbolSegments(opening, rec.matrix)
      : buildWindowSymbolSegments(opening, rec.matrix);
    for (const s of segs) out.push(segToLine(s, openColor, units));
  }
  return out;
}
