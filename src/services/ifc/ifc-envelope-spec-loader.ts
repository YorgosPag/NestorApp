/**
 * IFC4 Envelope-Spec Loader (ADR-396 P9)
 *
 * One-shot async loader για τα per-floor ETICS `ThermalEnvelopeSpec` ενός
 * project. Το spec ζει στο `dxf_viewer_levels/{levelId}.thermalEnvelopeSpec`
 * (ADR-396 P7 Part A) — ΟΧΙ πάνω στις wall entities. Ο covering serializer
 * (P9) το χρειάζεται για να εκδώσει `IfcCovering` στους εξωτ. τοίχους (Z1
 * facade), αφού οι τοίχοι δεν κουβαλούν per-element `envelopeLayer`.
 *
 * Mirror του `loadBimScenesForProject` (ίδιο `firestoreQueryService.getAll`
 * pattern + `where('projectId', ...)`). NOT a React hook — async fetch, καλείται
 * από τον EventBus handler του `IfcExportHost`.
 */

import { where } from 'firebase/firestore';

import { firestoreQueryService } from '@/services/firestore';
import type { DxfLevelDocument } from '@/app/api/dxf-levels/dxf-levels.types';
import type { ThermalEnvelopeSpec } from '@/subapps/dxf-viewer/bim/types/thermal-envelope-types';

/** Defensive read — το `thermalEnvelopeSpec` δεν είναι ρητά typed στο doc. */
function readSpec(level: DxfLevelDocument): ThermalEnvelopeSpec | undefined {
  const raw = (level as { thermalEnvelopeSpec?: ThermalEnvelopeSpec | null }).thermalEnvelopeSpec;
  return raw ?? undefined;
}

/**
 * Επιστρέφει `Map<floorId, ThermalEnvelopeSpec>` για όλα τα levels του project
 * που έχουν spec + floorId. Levels χωρίς spec/floorId παραλείπονται.
 */
export async function loadEnvelopeSpecsForProject(
  projectId: string,
): Promise<Map<string, ThermalEnvelopeSpec>> {
  const res = await firestoreQueryService.getAll<DxfLevelDocument>('DXF_VIEWER_LEVELS', {
    constraints: [where('projectId', '==', projectId)],
  });

  const byFloor = new Map<string, ThermalEnvelopeSpec>();
  for (const level of res.documents) {
    const floorId = level.floorId ?? undefined;
    if (!floorId) continue;
    const spec = readSpec(level);
    if (spec) byFloor.set(floorId, spec);
  }
  return byFloor;
}
