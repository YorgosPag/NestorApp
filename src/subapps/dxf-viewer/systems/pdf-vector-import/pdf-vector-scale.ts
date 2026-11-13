/**
 * ADR-941 Δ15 — η **κάρτα κλίμακας** της εισαγωγής διανυσματικού PDF: τι λένε οι γραμμένες τιμές που δέθηκαν σε ακμές
 * (`bindPdfDimensions`) για την κλίμακα του υποβάθρου, και τι θα γραφτεί αν ο άνθρωπος πει «Βαθμονόμηση και εισαγωγή».
 * Ποτέ σιωπηλή εφαρμογή: εδώ μόνο **υπολογίζεται** η πρόταση (πρότυπο: `plan-scale-card.ts`, ADR-929 Φ5.3γ).
 *
 * | Υπόβαθρο | Κάρτα |
 * |---|---|
 * | Αβαθμονόμητο, η συναίνεση των τιμών αποδείχθηκε | `proposal`: λύση ελαχίστων τετραγώνων σε όλα τα δεσίματα |
 * | Βαθμονομημένο, κάθε τιμή συμφωνεί μέσα στο ψηφίο γραφής της | `confirmed`: «συμφωνεί με N διαστάσεις» |
 * | Βαθμονομημένο, κάποια τιμή διαφωνεί | `proposal` με `replacesMmPerPixel`: οι δύο κλίμακες, αντικατάσταση μόνο ρητά |
 *
 * 🔑 **Ένας επιλυτής, ένας χώρος.** Τα άκρα των ακμών είναι ήδη φυσικά px του υποβάθρου (`PdfVectorContent`) — ο ίδιος
 *   χώρος με το `CalibrationReferenceInput`. Η λύση είναι του `solveCalibration`· η εγγραφή φτιάχνεται από **την ίδια**
 *   λύση (`buildCalibrationData`), όχι από νέο υπολογισμό. Ό,τι βλέπεις, αυτό γράφεται.
 * 🔑 **Μπαγιάτικη κάρτα** = άλλο υπόβαθρο ή άλλη τοποθέτηση από τη βάση της (`isPdfVectorScaleCurrent`): ο καλών αρνείται.
 *
 * ΚΑΘΑΡΟ (pure) — μηδέν React/store/DOM.
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-scale
 */

import type { BackgroundTransform, CalibrationData, FloorplanBackground } from '../../floorplan-background/providers/types';
import {
  calibrationNeedsReview,
  solveCalibration,
  type CalibrationReferences,
  type CalibrationSolution,
  type CalibrationSolveFailure,
} from '../../floorplan-background/geometry/calibration-solve';
import { buildCalibrationData, type CalibrationDraftReference } from '../../floorplan-background/geometry/calibration-draft';
import { rasterPixelToScene, type RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { PdfVectorContent, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import type { PdfDimensionBinding, PdfDimensionReading } from './pdf-vector-dimension-binding';

/** Μία γραμμένη τιμή ως αναφορά της βαθμονόμησης: τα άκρα της ακμής της, σε φυσικά px του υποβάθρου. */
export interface PdfVectorScaleReference {
  readonly raw: string;
  readonly valueMm: number;
  readonly a: { readonly x: number; readonly y: number };
  readonly b: { readonly x: number; readonly y: number };
}

export interface PdfVectorScaleProposal {
  readonly kind: 'proposal';
  /** Πάνω σε ποιο υπόβαθρο και ποια τοποθέτηση υπολογίστηκε. */
  readonly basis: { readonly backgroundId: string; readonly transform: BackgroundTransform; readonly sceneUnits: SceneUnits };
  readonly references: readonly PdfVectorScaleReference[];
  readonly solution: CalibrationSolution;
  /** Ανισοτροπία ή υπόλοιπο πάνω από το κατώφλι ⇒ ο άνθρωπος κοιτά ξανά πριν εφαρμόσει. */
  readonly needsReview: boolean;
  /** Υπάρχουσα βαθμονόμηση που διαφωνεί: η κλίμακά της (mm ανά px), για να φαίνονται **και οι δύο** τιμές. */
  readonly replacesMmPerPixel: number | null;
}

export interface PdfVectorScaleConfirmed {
  readonly kind: 'confirmed';
  readonly agreeing: number;
  /** Η μεγαλύτερη σχετική απόκλιση «μετρημένο / γραμμένο − 1». */
  readonly maxDeviationRel: number;
}

export interface PdfVectorScaleFailed {
  readonly kind: 'failed';
  readonly reason: CalibrationSolveFailure;
}

export type PdfVectorScale = PdfVectorScaleProposal | PdfVectorScaleConfirmed | PdfVectorScaleFailed;

export interface PdfVectorScaleInput {
  readonly reading: PdfDimensionReading;
  readonly content: PdfVectorContent;
  readonly background: Pick<FloorplanBackground, 'id' | 'transform' | 'naturalBounds' | 'calibration'>;
  readonly sceneUnits: SceneUnits;
}

const pointOf = (p: PxPoint): { readonly x: number; readonly y: number } => ({ x: p[0], y: p[1] });

function referenceOf(binding: PdfDimensionBinding, content: PdfVectorContent): PdfVectorScaleReference | null {
  const points = content.polylines[binding.edge.polylineIndex]?.points;
  const from = points?.[binding.edge.from];
  const to = points?.[binding.edge.to];
  if (from === undefined || to === undefined) return null;
  return { raw: binding.raw, valueMm: binding.valueMm, a: pointOf(from), b: pointOf(to) };
}

/** Το μήκος της ακμής στη σκηνή, σε mm, με την **τρέχουσα** τοποθέτηση. */
function measuredMm(ref: PdfVectorScaleReference, placement: RasterPlacement, sceneUnits: SceneUnits): number {
  const a = rasterPixelToScene(ref.a, placement);
  const b = rasterPixelToScene(ref.b, placement);
  return Math.hypot(b.x - a.x, b.y - a.y) / mmToSceneUnits(sceneUnits);
}

function confirmedFrom(refs: readonly PdfVectorScaleReference[], bindings: readonly PdfDimensionBinding[], input: PdfVectorScaleInput): PdfVectorScaleConfirmed | null {
  let maxDeviationRel = 0;
  for (const [i, ref] of refs.entries()) {
    const measured = measuredMm(ref, input.background, input.sceneUnits);
    if (Math.abs(measured - ref.valueMm) > bindings[i].precisionMm) return null;
    maxDeviationRel = Math.max(maxDeviationRel, Math.abs(measured / ref.valueMm - 1));
  }
  return { kind: 'confirmed', agreeing: refs.length, maxDeviationRel };
}

/** mm ανά px της υπάρχουσας τοποθέτησης, μετρημένα πάνω στην πρώτη αναφορά. */
function currentMmPerPixel(ref: PdfVectorScaleReference, input: PdfVectorScaleInput): number {
  return measuredMm(ref, input.background, input.sceneUnits) / Math.hypot(ref.b.x - ref.a.x, ref.b.y - ref.a.y);
}

/** Η κάρτα, ή `null` όταν οι γραμμένες τιμές δεν αποδεικνύουν κλίμακα (καμία συναίνεση, κανένα δέσιμο). */
export function pdfVectorScale(input: PdfVectorScaleInput): PdfVectorScale | null {
  if (input.reading.pxPerMm === null) return null;
  const paired = input.reading.bindings.flatMap((b) => { const r = referenceOf(b, input.content); return r ? [{ b, r }] : []; });
  if (paired.length === 0) return null;
  const refs = paired.map((p) => p.r);
  const calibrated = input.background.calibration !== null;
  if (calibrated) {
    const confirmed = confirmedFrom(refs, paired.map((p) => p.b), input);
    if (confirmed) return confirmed;
  }
  const solverRefs: CalibrationReferences = [
    { a: refs[0].a, b: refs[0].b, lengthMm: refs[0].valueMm },
    ...refs.slice(1).map((r) => ({ a: r.a, b: r.b, lengthMm: r.valueMm })),
  ];
  const result = solveCalibration({ placement: input.background, references: solverRefs, sceneUnits: input.sceneUnits, alignToAxis: false });
  if (!result.ok) return { kind: 'failed', reason: result.reason };
  return {
    kind: 'proposal',
    basis: { backgroundId: input.background.id, transform: input.background.transform, sceneUnits: input.sceneUnits },
    references: refs,
    solution: result.solution,
    needsReview: calibrationNeedsReview(result.solution),
    replacesMmPerPixel: calibrated ? currentMmPerPixel(refs[0], input) : null,
  };
}

const sameTransform = (a: BackgroundTransform, b: BackgroundTransform): boolean =>
  a.scaleX === b.scaleX && a.scaleY === b.scaleY && a.rotation === b.rotation && a.translateX === b.translateX && a.translateY === b.translateY;

/** Ισχύει ακόμη η πρόταση για αυτό το υπόβαθρο; (ίδια ταυτότητα, ίδια τοποθέτηση) */
export function isPdfVectorScaleCurrent(
  proposal: PdfVectorScaleProposal,
  background: Pick<FloorplanBackground, 'id' | 'transform'> | null,
): boolean {
  return background !== null && background.id === proposal.basis.backgroundId && sameTransform(background.transform, proposal.basis.transform);
}

function draftOf(r: PdfVectorScaleReference): CalibrationDraftReference {
  return { lengthMm: r.valueMm, record: { pointA: r.a, pointB: r.b, realDistance: r.valueMm, unit: 'mm' } };
}

/** Η εγγραφή του «Βαθμονόμηση και εισαγωγή»: η **ίδια** λύση που δείχνει η κάρτα, προέλευση `pdf-vector-dimensions`. */
export function pdfVectorScaleCalibration(
  proposal: PdfVectorScaleProposal,
  now: number,
): { readonly transform: BackgroundTransform; readonly data: CalibrationData } {
  return {
    transform: proposal.solution.transform,
    data: buildCalibrationData(proposal.references.map(draftOf), proposal.solution, proposal.basis.sceneUnits, false, now, 'pdf-vector-dimensions'),
  };
}
