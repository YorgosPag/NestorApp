/**
 * ADR-507/508 (Tekton .TEK export) — BIM → Tekton records mapper (SSoT).
 *
 * Φάση 1: ΤΟΙΧΟΙ (straight). Κάθε BIM `wall` → ένα `<record>` με xmatrix από το
 * centerline (params.start/end) + πάχος. Κουφώματα/έπιπλα = επόμενη φάση.
 *
 * Reuse: `metersPerCanvasUnit`/`mmToMeters`/`buildWallXMatrix` (tek-geometry) +
 * `buildWallRecordXml` (tek-xml-writer). Μηδέν re-impl μετατροπών.
 */

import type { Entity } from '../../../types/entities';
import { isWallEntity } from '../../../types/entities';
import { sceneUnitsToMeters } from '../../../utils/scene-units';
import { mmToMeters, buildWallXMatrix } from './tek-geometry';
import { buildWallRecordXml } from './tek-xml-writer';
import type { TekWall } from './tek-types';

export interface TekCollectResult {
  /** Σειριοποιημένα `<record>` τοίχων (join με newline) έτοιμα για injection. */
  readonly wallsXml: string;
  /** Πλήθος τοίχων που εξήχθησαν. */
  readonly wallCount: number;
  /** Παραλείψεις (π.χ. μη-straight τοίχοι — φάση 2). */
  readonly warnings: string[];
}

/**
 * Συλλέγει τους τοίχους μιας scope-filtered λίστας entities σε Tekton records.
 * Straight μόνο (start/end)· curved/polyline → warning + skip (DEFER).
 */
export function collectTekWalls(entities: readonly Entity[]): TekCollectResult {
  const records: string[] = [];
  const warnings: string[] = [];
  let id = 1;

  for (const e of entities) {
    if (!isWallEntity(e)) continue;
    if (e.kind !== 'straight') {
      warnings.push(`Τοίχος ${e.id}: ο τύπος "${e.kind}" δεν υποστηρίζεται ακόμη στο .TEK (φάση 2) — παραλείφθηκε.`);
      continue;
    }
    const p = e.params;
    const f = sceneUnitsToMeters(p.sceneUnits ?? 'mm');
    const wall: TekWall = {
      id,
      name: String(id),
      heightM: mmToMeters(p.height),
      elevationM: 0,
      colorHex: '80BCFC',
      xmatrix: buildWallXMatrix(
        p.start.x * f, p.start.y * f,
        p.end.x * f, p.end.y * f,
        mmToMeters(p.thickness),
      ),
    };
    records.push(buildWallRecordXml(wall));
    id += 1;
  }

  return { wallsXml: records.join('\n'), wallCount: records.length, warnings };
}
