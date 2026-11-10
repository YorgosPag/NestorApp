/**
 * ADR-929 Δ20 · Σ1 — **ανοίγματα διαστάσεων → πραγματικές `LinearDimensionEntity`**: η πρόταση της στρώσης «Διαστάσεις».
 *
 * 🔑 **Καθαρή προβολή, όχι δεύτερη αναγνώριση.** Ό,τι μετρά η διάσταση το έχει ήδη πει το σχέδιο (`dimension-spans.ts`,
 * Φ5.5: οι επεκτάσεις δηλώνουν «από εδώ ως εκεί»)· το είδος του άκρου το έχει ήδη κρίνει ο ταξινομητής
 * (`dimension-terminators.ts`, Φ5.4). Εδώ μόνο **μεταφράζονται** σε οντότητα — καμία νέα απόφαση για το μελάνι.
 * 🔑 **Στη σκηνή μόνο μέσω `alignedToOriginal` + `rasterPixelToScene`** (Δ3): καμία δεύτερη απεικόνιση px → σκηνή.
 * 🔑 **Μετρά τις ΣΥΝΟΡΘΩΜΕΝΕΣ παρειές.** Όταν το πόδι της επέκτασης καταλήγει σε παρειά, η μετατόπιση είναι εκείνη της
 * συνόρθωσης (ίδια με τους τοίχους που θα γραφτούν από τα `adjustedSegments`) ⇒ διάσταση και τοίχος συμφωνούν εξ ορισμού.
 * Χωρίς παρειά ⇒ η μετατόπιση της ίδιας της επέκτασης (άξονας, §6.7) — ποτέ μαντεψιά.
 * 🔑 **Αλυσίδα = ίδια γραμμή.** Ανοίγματα της ίδιας γραμμής διάστασης μοιράζονται `rotation` και γραμμή αναφοράς
 * (`defPoints[2]` πάνω στην ίδια ευθεία), όπως το «continue» του AutoCAD — όχι ψεύτικη ομάδα στο μοντέλο.
 * 🔑 **Το άκρο όπως σχεδιάστηκε.** Λοξή ⇒ `oblique` (ISO 129), βέλος ⇒ `closedFilled`, κουκκίδα ⇒ `dot`, ως `overrides.dimblk`
 * της οντότητας. Χωρίς σαφή ψήφο ⇒ το στυλ αποφασίζει.
 * 🔑 **Η τιμή δεν μαντεύεται.** `userText: '<>'` (η μετρούμενη) ώσπου η τιμή να έρθει από το κείμενο (Σ1.5, τοπικό OCR).
 *
 * Τίποτα δεν γράφεται εδώ: η εγγραφή γίνεται μόνο με την έγκριση του ανθρώπου (ένα βήμα αναίρεσης).
 * Καθαρό, ντετερμινιστικό με δεδομένο `newId`.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/dimension-entities
 */

import { applyHomography, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import { generateDimensionId } from '@/services/enterprise-id-convenience';
import type { Point2D } from '../../../rendering/types/Types';
import { normalizeAngleDeg, radToDeg } from '../../../rendering/entities/shared/geometry-angle-utils';
import { rasterPixelToScene, type RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { LinearDimensionEntity } from '../../../types/dimension';
import type { PlanSegmentRoleVerdict, PlanTerminatorKind, RasterSegment } from '../plan-recognition-types';
import { familyDirection, familyNormal } from './fusion-frame';
import type { DimensionSpan, DimensionSpanEnd, PlanDirectionFamily, PlanFusionResult } from './plan-fusion-types';

/** Ό,τι διαβάζει η προβολή από τη σύντηξη — τίποτα άλλο. */
export type DimensionEntityFusion = Pick<PlanFusionResult, 'families' | 'faceLines' | 'adjustedOffsetPx' | 'dimensionSpans'>;

export interface DimensionEntityInput {
  readonly fusion: DimensionEntityFusion;
  /** Τα τμήματα της Φ2 (αρχικά px): από εδώ ξαναδιαβάζεται η γεωμετρία των επεκτάσεων, ποτέ από αντίγραφο. */
  readonly segments: readonly RasterSegment[];
  readonly originalToAligned: Homography;
  readonly alignedToOriginal: Homography;
  readonly placement: RasterPlacement;
  /** Οι κρίσεις ρόλου της Φ2: φέρνουν το είδος των άκρων ανά τμήμα γραμμής διάστασης. */
  readonly verdicts: readonly PlanSegmentRoleVerdict[];
}

export interface DimensionEntityContext {
  readonly styleId: string;
  readonly layerId: string;
  /** Πηγή ids (N.6). Προεπιλογή: `generateDimensionId`. */
  readonly newId?: () => string;
}

/** Μια προτεινόμενη διάσταση, με το άνοιγμα από το οποίο βγήκε (επισήμανση πίσω στην εικόνα, Δ9). */
export interface PlanDimensionProposal {
  readonly spanId: string;
  readonly entity: LinearDimensionEntity;
}

/** Τα τέσσερα σημεία ενός ανοίγματος στο ευθυγραμμισμένο πλαίσιο: δύο αρχές επεκτάσεων, δύο σημεία της γραμμής διάστασης. */
interface SpanPoints {
  readonly origins: readonly [PlanePoint, PlanePoint];
  readonly onLine: readonly [PlanePoint, PlanePoint];
}

/** Το άκρο του σχεδίου → μπλοκ βέλους του μητρώου (`ARROWHEAD_BLOCKS`). Σταυρός / κανένα ⇒ αποφασίζει το στυλ. */
const TERMINATOR_BLOCK: Readonly<Partial<Record<PlanTerminatorKind, string>>> = {
  tick: 'oblique',
  arrow: 'closedFilled',
  dot: 'dot',
};

const PARALLEL_EPS = 1e-9;
const dot = (a: PlanePoint, b: PlanePoint): number => a.x * b.x + a.y * b.y;

/** Η τομή των ευθειών `nA·p = cA` και `nB·p = cB`· `null` όταν είναι (σχεδόν) παράλληλες. */
function intersect(nA: PlanePoint, cA: number, nB: PlanePoint, cB: number): PlanePoint | null {
  const det = nA.x * nB.y - nA.y * nB.x;
  if (Math.abs(det) < PARALLEL_EPS) return null;
  return { x: (cA * nB.y - nA.y * cB) / det, y: (nA.x * cB - cA * nB.x) / det };
}

/** Η μετατόπιση ενός άκρου: της συνορθωμένης παρειάς όπου καταλήγει το πόδι, αλλιώς της ίδιας της επέκτασης. */
function endOffset(end: DimensionSpanEnd, fusion: DimensionEntityFusion): number {
  if (end.lineId === null) return end.offsetPx;
  const adjusted = fusion.adjustedOffsetPx.get(end.lineId);
  if (adjusted !== undefined) return adjusted;
  return fusion.faceLines.find((l) => l.id === end.lineId)?.offsetPx ?? end.offsetPx;
}

/** Το πόδι της επέκτασης: το άκρο της που απέχει **περισσότερο** από τη γραμμή διάστασης. */
function extensionFoot(ext: RasterSegment, h: Homography, runNormal: PlanePoint, runOffset: number): PlanePoint {
  const a = applyHomography(h, ext.start.x, ext.start.y);
  const b = applyHomography(h, ext.end.x, ext.end.y);
  return Math.abs(dot(runNormal, a) - runOffset) >= Math.abs(dot(runNormal, b) - runOffset) ? a : b;
}

interface SpanFamilies {
  readonly run: PlanDirectionFamily;
  readonly measured: PlanDirectionFamily;
}

function spanFamilies(span: DimensionSpan, fusion: DimensionEntityFusion): SpanFamilies | null {
  const run = fusion.families.find((f) => f.id === span.runFamilyId);
  const measured = fusion.families.find((f) => f.id === span.familyId);
  return run && measured ? { run, measured } : null;
}

/** Ένα άκρο του ανοίγματος: η αρχή της επέκτασης (στο ύψος του ποδιού) και το σημείο της πάνω στη γραμμή διάστασης. */
function endPoints(
  end: DimensionSpanEnd, span: DimensionSpan, fam: SpanFamilies, input: DimensionEntityInput, byId: ReadonlyMap<string, RasterSegment>,
): { readonly origin: PlanePoint; readonly onLine: PlanePoint } | null {
  const ext = byId.get(end.extensionId);
  if (ext === undefined) return null;
  const nM = familyNormal(fam.measured);
  const uM = familyDirection(fam.measured);
  const nR = familyNormal(fam.run);
  const offset = endOffset(end, input.fusion);
  const foot = extensionFoot(ext, input.originalToAligned, nR, span.runOffsetPx);
  const origin = intersect(nM, offset, uM, dot(uM, foot));
  const onLine = intersect(nM, offset, nR, span.runOffsetPx);
  return origin && onLine ? { origin, onLine } : null;
}

function spanPoints(span: DimensionSpan, input: DimensionEntityInput, byId: ReadonlyMap<string, RasterSegment>): SpanPoints | null {
  const fam = spanFamilies(span, input.fusion);
  if (fam === null) return null;
  const a = endPoints(span.ends[0], span, fam, input, byId);
  const b = endPoints(span.ends[1], span, fam, input, byId);
  return a && b ? { origins: [a.origin, b.origin], onLine: [a.onLine, b.onLine] } : null;
}

/** Ευθυγραμμισμένο px → σημείο σκηνής, μέσω του ΕΝΟΣ δρόμου (Δ3). */
function toScene(p: PlanePoint, input: DimensionEntityInput): Point2D {
  return rasterPixelToScene(applyHomography(input.alignedToOriginal, p.x, p.y), input.placement);
}

/** Η πλειοψηφία των σαφών άκρων της γραμμής (όλων των τμημάτων της)· ισοπαλία ή καμία ψήφος ⇒ `null`. */
function terminatorBlock(span: DimensionSpan, verdictById: ReadonlyMap<string, PlanSegmentRoleVerdict>): string | null {
  const votes = new Map<string, number>();
  for (const id of span.segmentIds) {
    for (const kind of verdictById.get(id)?.terminators ?? []) {
      const block = TERMINATOR_BLOCK[kind];
      if (block !== undefined) votes.set(block, (votes.get(block) ?? 0) + 1);
    }
  }
  const ranked = [...votes].sort((x, y) => y[1] - x[1]);
  if (ranked.length === 0 || (ranked.length > 1 && ranked[0][1] === ranked[1][1])) return null;
  return ranked[0][0];
}

function proposalOf(
  span: DimensionSpan, points: SpanPoints, block: string | null, input: DimensionEntityInput, ctx: DimensionEntityContext,
): PlanDimensionProposal {
  const [o1, o2] = points.origins.map((p) => toScene(p, input));
  const [d1, d2] = points.onLine.map((p) => toScene(p, input));
  const entity: LinearDimensionEntity = {
    id: (ctx.newId ?? generateDimensionId)(),
    type: 'dimension',
    layerId: ctx.layerId,
    dimensionType: 'linear',
    styleId: ctx.styleId,
    defPoints: [o1, o2, d1],
    rotation: normalizeAngleDeg(radToDeg(Math.atan2(d2.y - d1.y, d2.x - d1.x))),
    userText: '<>',
    ...(block !== null ? { overrides: { dimblk: block } } : {}),
  };
  return { spanId: span.id, entity };
}

/**
 * Η πρόταση της στρώσης «Διαστάσεις»: μία `LinearDimensionEntity` ανά άνοιγμα, με τη σειρά των ανοιγμάτων. Άνοιγμα του
 * οποίου η γεωμετρία δεν ξαναδιαβάζεται (λείπει η επέκταση, εκφυλισμένη τομή) **παραλείπεται** — ποτέ μαντεψιά.
 */
export function planDimensionEntities(input: DimensionEntityInput, ctx: DimensionEntityContext): PlanDimensionProposal[] {
  const byId = new Map(input.segments.map((s) => [s.id, s]));
  const verdictById = new Map(input.verdicts.map((v) => [v.segmentId, v]));
  return input.fusion.dimensionSpans.flatMap((span) => {
    const points = spanPoints(span, input, byId);
    return points === null ? [] : [proposalOf(span, points, terminatorBlock(span, verdictById), input, ctx)];
  });
}
