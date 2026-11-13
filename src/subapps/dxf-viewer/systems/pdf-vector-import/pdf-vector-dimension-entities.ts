/**
 * ADR-941 Φ2α — οι δεμένες γραμμένες τιμές (`pdf-vector-dimension-binding`) ως **πραγματικές διαστάσεις** της σκηνής. Καθαρό.
 *
 * 🔑 **Δ13 — ό,τι θα έφτιαχνε ο χρήστης:** `aligned` (όπως το «επιλέγω γραμμή» με κάθετο τράβηγμα,
 *   `dimension-create-entity-pick-builder`): `defPoints` = τα δύο άκρα της ακμής + σημείο της γραμμής διάστασης (το μέσο της
 *   γραμμής βάσης του κειμένου του PDF). `associations` `endpoint` προς την πολυγραμμή/γραμμή (ο δείκτης κορυφής είναι και
 *   το `subIndex` — για `line` 0 = αρχή, 1 = τέλος) ⇒ τέντωμα, μετακίνηση, λαβές: η διάσταση ακολουθεί (ADR-362).
 * 🔑 **Δ14 — ζωντανή τιμή, ορατή διαφωνία:** μετρημένο ≈ γραμμένο (μέσα σε ένα ψηφίο γραφής) ⇒ **χωρίς** `userText` (η
 *   μετρούμενη τιμή, όπως στη χειροκίνητη)· αλλιώς το γραμμένο κείμενο ως αντικατάσταση, που ο καλών **μετρά** (`overridden`).
 * 🔑 **ΕΝΑΣ δρόμος συντεταγμένων:** `rasterPixelToScene`, ο ίδιος με τη γεωμετρία της εισαγωγής (Δ1).
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-dimension-entities
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AlignedDimensionEntity } from '../../types/dimension';
import { rasterPixelToScene, type RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import type { PdfVectorContent, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import { generateDimensionId } from '@/services/enterprise-id-convenience';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { PDF_VECTOR_IMPORT_META_KEY } from './pdf-vector-entities';
import type { PdfDimensionBinding } from './pdf-vector-dimension-binding';


export interface PdfDimensionEntityInput {
  readonly bindings: readonly PdfDimensionBinding[];
  readonly content: PdfVectorContent;
  /** Τα ids των οντοτήτων γεωμετρίας, με τη σειρά του `content.polylines`. */
  readonly geometryIds: readonly string[];
  readonly placement: RasterPlacement;
  readonly sceneUnits: SceneUnits;
  readonly styleId: string;
  readonly layerId: string;
  readonly sourceKey: string;
  /** Πηγή ids (N.6). Προεπιλογή: `generateDimensionId`. */
  readonly newId?: () => string;
}

export interface PdfDimensionEntities {
  readonly dimensions: readonly AlignedDimensionEntity[];
  /** Πόσες κρατούν το γραμμένο κείμενο επειδή διαφωνούν με τη γεωμετρία (Δ14). */
  readonly overridden: number;
}

const toScene = (p: PxPoint, placement: RasterPlacement): Point2D => rasterPixelToScene({ x: p[0], y: p[1] }, placement);

/** Συμφωνεί η μετρημένη απόσταση της σκηνής με το γραμμένο μήκος, μέσα σε ένα ψηφίο γραφής; */
function agreesWithWritten(a: Point2D, b: Point2D, binding: PdfDimensionBinding, sceneUnits: SceneUnits): boolean {
  const perMm = mmToSceneUnits(sceneUnits);
  return Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - binding.valueMm * perMm) <= binding.precisionMm * perMm;
}

function dimensionOf(binding: PdfDimensionBinding, input: PdfDimensionEntityInput): AlignedDimensionEntity | null {
  const geometryId = input.geometryIds[binding.edge.polylineIndex];
  const points = input.content.polylines[binding.edge.polylineIndex]?.points;
  if (geometryId === undefined || points === undefined) return null;
  const a = toScene(points[binding.edge.from], input.placement);
  const b = toScene(points[binding.edge.to], input.placement);
  return {
    id: (input.newId ?? generateDimensionId)(),
    type: 'dimension',
    dimensionType: 'aligned',
    layerId: input.layerId,
    styleId: input.styleId,
    defPoints: [a, b, toScene(binding.baselineMid, input.placement)],
    ...(agreesWithWritten(a, b, binding, input.sceneUnits) ? {} : { userText: binding.raw }),
    associations: [
      { defPointIndex: 0, geometryId, associationType: 'endpoint', subIndex: binding.edge.from },
      { defPointIndex: 1, geometryId, associationType: 'endpoint', subIndex: binding.edge.to },
    ],
    metadata: { [PDF_VECTOR_IMPORT_META_KEY]: input.sourceKey },
  };
}

/** Μία διάσταση ανά δέσιμο, με τη σειρά των δεσιμάτων. Δέσιμο χωρίς γεωμετρία παραλείπεται (ποτέ throw). */
export function pdfDimensionEntities(input: PdfDimensionEntityInput): PdfDimensionEntities {
  const dimensions = input.bindings.flatMap((b) => dimensionOf(b, input) ?? []);
  const overridden = dimensions.filter((d) => d.userText !== undefined).length;
  return { dimensions, overridden };
}
