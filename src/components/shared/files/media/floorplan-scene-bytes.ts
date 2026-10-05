/**
 * =============================================================================
 * ΣΚΗΝΗ ΑΠΟ BYTES — ο ΕΝΑΣ δρόμος «κατέβασε και διάβασε», για JSON σκηνής ΚΑΙ πρωτότυπο DXF
 * =============================================================================
 *
 * Ήταν δύο κλάδοι του `useFloorplanSceneLoader` (PATH C = JSON, PATH D = DXF) που διάλεγαν από το **`ext`** της
 * εγγραφής. Εδώ διαλέγουν τα **bytes** (`classifyScenePayloadHead`, ADR-899 §9 θέμα 8): JSON σκηνής δεν περνά
 * ποτέ από τον αναλυτή DXF, και ό,τι δεν είναι κανένα από τα δύο είναι **ονομασμένο σφάλμα**, όχι άδεια σκηνή.
 *
 * @module components/shared/files/media/floorplan-scene-bytes
 */

import type { DxfSceneData, FileRecord } from '@/types/file-record';
import { classifyScenePayloadHead, SCENE_PAYLOAD_HEAD_BYTES } from '@/lib/dxf-scene/scene-payload-kind';
import { toDxfSceneData } from '@/services/floorplans/dxf-scene-data-projection';

/** Τα bytes δεν είναι ούτε σκηνή ούτε DXF (ή είναι JSON χωρίς `entities`). */
export class UnreadableScenePayloadError extends Error {
  constructor() {
    super('Scene payload is neither a scene JSON nor a DXF drawing');
    this.name = 'UnreadableScenePayloadError';
  }
}

export interface SceneBytesRequest {
  readonly url: string;
  /** Όνομα για τον αναλυτή DXF (κωδικοποίηση/μηνύματα) — δεν αποφασίζει τη μορφή. */
  readonly fileName: string;
  /** ADR-716 Φ5 — η ρητή μονάδα σχεδίασης της εγγραφής, όταν υπάρχει. */
  readonly userDrawingUnits?: FileRecord['userDrawingUnits'];
}

function parseSceneJson(text: string): DxfSceneData {
  const parsed: unknown = JSON.parse(text);
  const entities = (parsed as { entities?: unknown } | null)?.entities;
  if (!Array.isArray(entities)) throw new UnreadableScenePayloadError();
  return parsed as DxfSceneData;
}

async function parseDxfBlob(blob: Blob, request: SceneBytesRequest): Promise<DxfSceneData> {
  const file = new File([blob], request.fileName || 'plan.dxf');
  const { dxfImportService } = await import('@/subapps/dxf-viewer/io/dxf-import');
  // ADR-716 Φ5 — re-parse ΠΟΛΥ μετά την εισαγωγή: κανείς δεν υπάρχει να ρωτηθεί για τη μονάδα, γι' αυτό η ρητή
  // ετυμηγορία ζει στο ίδιο το FileRecord και διαβάζεται από εκεί.
  const result = await dxfImportService.importDxfFile(file, undefined, request.userDrawingUnits);
  if (!result.success || !result.scene) throw new Error(result.error || 'Parse failed');
  // N.0.2/N.18 — ΜΙΑ προβολή SceneModel → DxfSceneData, κοινή με τον FloorplanProcessor και το server route.
  return toDxfSceneData(result.scene);
}

/** **Κατέβασε τα bytes και δώσε τη σκηνή** — η μορφή από το περιεχόμενο. Πετά σε HTTP σφάλμα ή άγνωστη μορφή. */
export async function loadSceneFromBytes(request: SceneBytesRequest): Promise<DxfSceneData> {
  const response = await fetch(request.url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const kind = classifyScenePayloadHead(await blob.slice(0, SCENE_PAYLOAD_HEAD_BYTES).text());
  if (kind === 'scene-json') return parseSceneJson(await blob.text());
  if (kind === 'dxf') return parseDxfBlob(blob, request);
  throw new UnreadableScenePayloadError();
}
