/**
 * ADR-929 Φ5.3γ — η **κάρτα κλίμακας**: τι λένε οι διαβασμένες διαστάσεις για την κλίμακα της εικόνας, και τι θα γραφτεί
 * αν ο άνθρωπος πει «Εφαρμογή». Ποτέ σιωπηλή εφαρμογή (Δ4): εδώ μόνο **υπολογίζεται** η πρόταση.
 *
 * Τρεις καταστάσεις, από την κατάσταση της σύντηξης:
 *
 * | Σύντηξη | Κάρτα |
 * |---|---|
 * | Χωρίς βαθμονόμηση, κλίμακα από **συναίνεση διαστάσεων** | `proposal`: λύση ελαχίστων τετραγώνων σε όλες τις συμφωνούσες |
 * | Βαθμονόμηση + διαστάσεις που **συμφωνούν** | `confirmed`: «συμφωνεί με N διαστάσεις, μέγιστη απόκλιση x%» (ο έλεγχος του Bluebeam, αυτόματος) |
 * | Βαθμονόμηση + διαστάσεις που **διαφωνούν** (`scale-conflict`) | `proposal` με `replaces`: οι δύο τιμές, αντικατάσταση μόνο με ρητή πράξη |
 *
 * 🔑 **Ό,τι βλέπεις, αυτό γράφεται.** Η κάρτα κρατά τη **λύση** (`solveCalibration`, ο ένας επιλυτής) και τη βάση της
 * (τη σύντηξη και την τοποθέτηση). Το `scaleCardCalibration` φτιάχνει την εγγραφή από **αυτή** τη λύση, όχι από νέο
 * υπολογισμό. Αν άλλαξε η βάση στο μεταξύ, ο ελεγκτής αρνείται (`plan-recognition-session.applyScaleCard`).
 * 🔑 **Στη διαφωνία** η κάρτα θέλει αναφορές **στην κλίμακα των διαστάσεων**, όχι σε εκείνη της βαθμονόμησης (με την
 * οποία δέθηκαν). Γι' αυτό ζητά τη σύντηξη χωρίς γνωστή κλίμακα (`dimensionFusion`), οκνηρά: μόνο όταν χρειάζεται.
 *
 * ΚΑΘΑΡΟ (pure) — μηδέν React/store/DOM.
 *
 * @module subapps/dxf-viewer/systems/plan-recognition/plan-scale-card
 */

import type { BackgroundTransform, CalibrationData } from '../../floorplan-background/providers/types';
import type { PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReadingOutcome } from '../../bim/plan-recognition/plan-recognition-types';
import {
  planScaleReferences,
  type PlanScaleReference,
  type PlanScaleReferenceSet,
  type ReferenceAlignment,
  type RejectedScaleDimension,
} from '../../bim/plan-recognition/fusion/scale-references';
import {
  calibrationNeedsReview,
  solveCalibration,
  type CalibrationReferences,
  type CalibrationSolution,
  type CalibrationSolveFailure,
} from '../../floorplan-background/geometry/calibration-solve';
import { buildCalibrationData, type CalibrationDraftReference } from '../../floorplan-background/geometry/calibration-draft';
import type { RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import type { SceneUnits } from '../../utils/scene-units';

const MM_PER_M = 1000;

/** Πάνω σε ποια σύντηξη και ποια τοποθέτηση υπολογίστηκε η κάρτα: αν άλλαξε κάτι, η κάρτα είναι μπαγιάτικη. */
interface PlanScaleCardBasis {
  readonly fusion: PlanFusionResult;
  readonly transform: BackgroundTransform;
  /** Οι μονάδες της σκηνής της λύσης: η εγγραφή τις κρατά (Φ5.2, §6.1 #1). */
  readonly sceneUnits: SceneUnits;
}

export interface PlanScaleProposal {
  readonly kind: 'proposal';
  readonly basis: PlanScaleCardBasis;
  readonly references: PlanScaleReferenceSet;
  readonly solution: CalibrationSolution;
  /** Σχετική τυπική απόκλιση της κλίμακας από τη συνόρθωση, όταν η κλίμακα ήταν άγνωστος του λύτη. */
  readonly sigmaRel: number | null;
  /** Ανισοτροπία ή υπόλοιπο πάνω από το κατώφλι ⇒ ο άνθρωπος κοιτά ξανά πριν εφαρμόσει. */
  readonly needsReview: boolean;
  /** Στη διαφωνία: η κλίμακα της υπάρχουσας βαθμονόμησης (mm ανά pixel), για να φαίνονται **και οι δύο** τιμές. */
  readonly replacesMmPerPixel: number | null;
}

export interface PlanScaleConfirmed {
  readonly kind: 'confirmed';
  /** Πόσες διαστάσεις ελέγχθηκαν και συμφωνούν με την υπάρχουσα βαθμονόμηση. */
  readonly agreeing: number;
  /** Η μεγαλύτερη σχετική απόκλιση «μετρημένο / γραμμένο − 1» ανάμεσά τους. */
  readonly maxDeviationRel: number;
  readonly rejected: readonly RejectedScaleDimension[];
}

export interface PlanScaleFailed {
  readonly kind: 'failed';
  readonly reason: CalibrationSolveFailure;
  readonly references: PlanScaleReferenceSet;
}

export type PlanScaleCard = PlanScaleProposal | PlanScaleConfirmed | PlanScaleFailed;

export interface PlanScaleCardInput {
  readonly fusion: PlanFusionResult;
  readonly reading: PlanReadingOutcome | null;
  readonly alignment: ReferenceAlignment;
  readonly placement: RasterPlacement;
  readonly sceneUnits: SceneUnits;
  /** Η σύντηξη **χωρίς** γνωστή κλίμακα (οκνηρά: μόνο στη διαφωνία). */
  readonly dimensionFusion: () => PlanFusionResult;
}

function solverReferences(used: readonly PlanScaleReference[]): CalibrationReferences | null {
  const inputs = used.map((r) => ({ a: r.a, b: r.b, lengthMm: r.valueMm }));
  return inputs.length > 0 ? [inputs[0], ...inputs.slice(1)] : null;
}

function proposalFrom(fusion: PlanFusionResult, input: PlanScaleCardInput, replacesMmPerPixel: number | null): PlanScaleProposal | PlanScaleFailed | null {
  const references = planScaleReferences(fusion, input.alignment);
  const solverRefs = solverReferences(references.used);
  if (solverRefs === null) return null;
  const result = solveCalibration({ placement: input.placement, references: solverRefs, sceneUnits: input.sceneUnits, alignToAxis: false });
  if (!result.ok) return { kind: 'failed', reason: result.reason, references };
  return {
    kind: 'proposal',
    basis: { fusion: input.fusion, transform: input.placement.transform, sceneUnits: input.sceneUnits },
    references,
    solution: result.solution,
    sigmaRel: fusion.scale?.sigmaRel ?? null,
    needsReview: calibrationNeedsReview(result.solution),
    replacesMmPerPixel,
  };
}

function confirmedFrom(fusion: PlanFusionResult, alignment: ReferenceAlignment): PlanScaleConfirmed | null {
  let agreeing = 0;
  let maxDeviationRel = 0;
  for (const d of fusion.dimensions) {
    if (d.status !== 'consistent' || d.measuredMm === null) continue;
    agreeing += 1;
    maxDeviationRel = Math.max(maxDeviationRel, Math.abs(d.measuredMm / d.valueMm - 1));
  }
  if (agreeing === 0) return null;
  return { kind: 'confirmed', agreeing, maxDeviationRel, rejected: planScaleReferences(fusion, alignment).rejected };
}

const disagreesWithDimensions = (fusion: PlanFusionResult): boolean =>
  fusion.questions.some((q) => q.kind === 'scale-conflict' && q.other.source === 'dimension-consensus');

/**
 * **Για ποια σύντηξη** μιλά η κάρτα, και με ποια μορφή. Η ΜΙΑ απόφαση: τη διαβάζουν η κάρτα του πάνελ **και** η επικάλυψη
 * του καμβά, ώστε ο άνθρωπος να βλέπει στην εικόνα ακριβώς τις διαστάσεις της λίστας.
 */
export type PlanScaleSubject =
  | { readonly kind: 'proposal'; readonly fusion: PlanFusionResult; readonly replacesMmPerPixel: number | null }
  | { readonly kind: 'confirmed'; readonly fusion: PlanFusionResult };

export function planScaleSubject(
  fusion: PlanFusionResult,
  reading: PlanReadingOutcome | null,
  dimensionFusion: () => PlanFusionResult,
): PlanScaleSubject | null {
  if (reading?.status !== 'read' || fusion.scale === null) return null;
  if (fusion.scale.chosen === 'dimension-consensus') return { kind: 'proposal', fusion, replacesMmPerPixel: null };
  if (fusion.scale.chosen !== 'known-calibration') return null; // γραμμένη κλίμακα / εμβαδά: δεν δίνουν αναφορές
  if (!fusion.scale.evidence.some((e) => e.source === 'dimension-consensus')) return null;
  if (!disagreesWithDimensions(fusion)) return { kind: 'confirmed', fusion };
  return { kind: 'proposal', fusion: dimensionFusion(), replacesMmPerPixel: fusion.scale.metresPerOriginalPx * MM_PER_M };
}

/** Η κάρτα, ή `null` όταν δεν έχει τίποτα να πει (χωρίς ανάγνωση, χωρίς διαστάσεις που αποδεικνύουν κλίμακα). */
export function planScaleCard(input: PlanScaleCardInput): PlanScaleCard | null {
  const subject = planScaleSubject(input.fusion, input.reading, input.dimensionFusion);
  if (subject === null) return null;
  return subject.kind === 'confirmed'
    ? confirmedFrom(subject.fusion, input.alignment)
    : proposalFrom(subject.fusion, input, subject.replacesMmPerPixel);
}

/** Η αναφορά όπως αποθηκεύεται: σε mm, με τη διάσταση-πηγή της (ίχνος ελέγχου). */
function draftOf(r: PlanScaleReference): CalibrationDraftReference {
  return {
    lengthMm: r.valueMm,
    record: { pointA: r.a, pointB: r.b, realDistance: r.valueMm, unit: 'mm', sourceTextId: r.textId },
  };
}

/** Η εγγραφή που γράφει το «Εφαρμογή»: η **ίδια** λύση που δείχνει η κάρτα, με προέλευση `plan-dimensions`. */
export function scaleCardCalibration(
  card: PlanScaleProposal,
  now: number,
): { readonly transform: BackgroundTransform; readonly data: CalibrationData } {
  const drafts = card.references.used.map(draftOf);
  return {
    transform: card.solution.transform,
    data: buildCalibrationData(drafts, card.solution, card.basis.sceneUnits, false, now, 'plan-dimensions'),
  };
}
