/**
 * ADR-941 Φ2α · Φ2β — οι δεμένες γραμμένες τιμές (`pdf-vector-dimension-binding`) ως **πραγματικές διαστάσεις** της σκηνής.
 * Καθαρό.
 *
 * 🔑 **Δ13 — ό,τι θα έφτιαχνε ο χρήστης:** `aligned` (όπως το «επιλέγω γραμμή» με κάθετο τράβηγμα,
 *   `dimension-create-entity-pick-builder`): `defPoints` = τα δύο μετρούμενα σημεία + ένα σημείο της γραμμής διάστασης.
 *   `associations` `endpoint` **ανά άκρο**, προς την κορυφή της γεωμετρίας που το κρατά (ο δείκτης κορυφής είναι και το
 *   `subIndex` — για `line` 0 = αρχή, 1 = τέλος· τα δύο άκρα μπορεί να ανήκουν σε **διαφορετικές** γραμμές, Φ2β) ⇒ τέντωμα,
 *   μετακίνηση, λαβές: η διάσταση ακολουθεί (ADR-362). Άκρο χωρίς κορυφή ⇒ χωρίς συσχέτιση σε εκείνο το άκρο.
 * 🔑 **Δ14 — ζωντανή τιμή, ορατή διαφωνία:** μετρημένο ≈ γραμμένο (μέσα σε ένα ψηφίο γραφής) ⇒ **χωρίς** `userText` (η
 *   μετρούμενη τιμή, όπως στη χειροκίνητη)· αλλιώς το γραμμένο κείμενο ως αντικατάσταση, που ο καλών **μετρά** (`overridden`).
 * 🔑 **Δ20 — οι απολήξεις του σχεδίου:** Φ2β ⇒ `overrides.dimblk1/dimblk2` = τα μπλοκ που αναγνωρίστηκαν (η ίδια
 *   βιβλιοθήκη που ζωγραφίζει). Και τα δύο ρητά: το `dimblk1 || dimblk` του στυλ δεν μπορεί έτσι να τα σκιάσει. Μέγεθος,
 *   κείμενο, χρώμα: του ενεργού στυλ.
 * 🔑 **ΕΝΑΣ δρόμος συντεταγμένων:** `rasterPixelToScene`, ο ίδιος με τη γεωμετρία της εισαγωγής (Δ1).
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-dimension-entities
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AlignedDimensionEntity, DimensionAssociation } from '../../types/dimension';
import { rasterPixelToScene, type RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import type { PxPoint } from '../../pdf-background/services/pdf-vector-content';
import { generateDimensionId } from '@/services/enterprise-id-convenience';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { PDF_VECTOR_IMPORT_META_KEY } from './pdf-vector-entities';
import type { PdfDimensionBinding } from './pdf-vector-dimension-binding';

export interface PdfDimensionEntityInput {
  readonly bindings: readonly PdfDimensionBinding[];
  /** Τα ids των οντοτήτων γεωμετρίας, με τη σειρά του `content.polylines` (`null` = απορροφήθηκε, Δ19). */
  readonly geometryIds: readonly (string | null)[];
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

/** Η συσχέτιση κάθε άκρου με την κορυφή που το κρατά — μόνο όταν η γεωμετρία της γράφεται. */
function associationsOf(binding: PdfDimensionBinding, geometryIds: readonly (string | null)[]): DimensionAssociation[] {
  return binding.measured.flatMap((m, defPointIndex): DimensionAssociation[] => {
    const geometryId = m.vertex ? geometryIds[m.vertex.polylineIndex] : null;
    return m.vertex && geometryId
      ? [{ defPointIndex, geometryId, associationType: 'endpoint', subIndex: m.vertex.index }]
      : [];
  });
}

function dimensionOf(binding: PdfDimensionBinding, input: PdfDimensionEntityInput): AlignedDimensionEntity | null {
  const a = toScene(binding.measured[0].point, input.placement);
  const b = toScene(binding.measured[1].point, input.placement);
  if (!(Math.hypot(b.x - a.x, b.y - a.y) > 0)) return null;
  const associations = associationsOf(binding, input.geometryIds);
  return {
    id: (input.newId ?? generateDimensionId)(),
    type: 'dimension',
    dimensionType: 'aligned',
    layerId: input.layerId,
    styleId: input.styleId,
    defPoints: [a, b, toScene(binding.linePoint, input.placement)],
    ...(agreesWithWritten(a, b, binding, input.sceneUnits) ? {} : { userText: binding.raw }),
    ...(associations.length > 0 ? { associations } : {}),
    ...(binding.arrowheads ? { overrides: { dimblk1: binding.arrowheads[0], dimblk2: binding.arrowheads[1] } } : {}),
    metadata: { [PDF_VECTOR_IMPORT_META_KEY]: input.sourceKey },
  };
}

/** Μία διάσταση ανά δέσιμο, με τη σειρά των δεσιμάτων. Δέσιμο μηδενικού μήκους παραλείπεται (ποτέ throw). */
export function pdfDimensionEntities(input: PdfDimensionEntityInput): PdfDimensionEntities {
  const dimensions = input.bindings.flatMap((b) => dimensionOf(b, input) ?? []);
  const overridden = dimensions.filter((d) => d.userText !== undefined).length;
  return { dimensions, overridden };
}
