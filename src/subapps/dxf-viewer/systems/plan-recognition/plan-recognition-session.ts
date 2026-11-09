/**
 * ADR-929 Φ5 — ο **ελεγκτής** της αναγνώρισης κάτοψης στον πελάτη: ο ΕΝΑΣ που γράφει στο `planRecognitionStore`.
 *
 * Κύκλος: `run(floorId)` — pixel από τον provider (μία αποκωδικοποίηση, §6.2 #6) → ευθυγράμμιση + τμήματα σε **ένα**
 * ταξίδι του Worker (§6.3 #8) → σύντηξη χωρίς ανάγνωση (η γεωμετρία μόνη της, Δ15 #1) → η πηγή γραμμών για τον
 * βοηθό του ADR-911. Κάθε νέα είσοδος (ανάγνωση, απάντηση ανθρώπου) ξανατρέχει **μόνο** τη σύντηξη, που είναι
 * καθαρή και ντετερμινιστική: ίδια είσοδος ⇒ ίδιο αποτέλεσμα, χωρίς δεύτερο ταξίδι στον Worker.
 *
 * 🔒 Τίποτα εδώ δεν γράφει στη σκηνή ή στον διακομιστή. Οι τοίχοι γράφονται μόνο από την έγκριση του ADR-911.
 * 🔑 Αγώνας: κάθε `run` παίρνει σειριακό αριθμό· αποτέλεσμα παλαιότερου `run` που τελειώνει αργότερα **αγνοείται**.
 *
 * Zero React.
 *
 * @see ./plan-recognition-store.ts
 * @see ../model-from-drawing/proposal-line-source.ts (η πηγή που παράγει)
 */

import { createPlanAligner, type PlanAligner } from '../../bim/plan-recognition/alignment/plan-align-client';
import type { PlanAlignment } from '../../bim/plan-recognition/alignment/plan-alignment-types';
import { fusePlan } from '../../bim/plan-recognition/fusion/plan-fusion';
import type { PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanInputKind, PlanReadingOutcome, RasterSegment } from '../../bim/plan-recognition/plan-recognition-types';
import { getFloorBackground, getFloorProvider } from '../../floorplan-background/stores/floorplanBackgroundStore';
import { resolveRasterPixelScale } from '../../floorplan-background/geometry/raster-pixel-scale';
import type { FloorplanBackground } from '../../floorplan-background/providers/types';
import type { ProposalLineSource } from '../model-from-drawing/proposal-line-source';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { sha256Hex } from '@/lib/hash/sha256';
import { planRecognitionStore, type PlanRecognitionFailure, type PlanRecognitionRun } from './plan-recognition-store';
import { meetsConfidenceTier } from './plan-confidence';
import { emptyRoleMarkCounts, planRoleMarkKind, type PlanRoleMarkKind } from './plan-role-marks';
import { extensionAnchorMap, isWallCandidateRole, segmentRoleMap } from '../../bim/plan-recognition/classify/segment-roles';
import { createPlanReadingReview, type PlanReadingReviewDeps } from './plan-reading-review';
import { planReadingApi } from './plan-reading-api-client';
import { createPlanScaleController, type PlanScaleControllerDeps } from './plan-scale-controller';
import { createPlanSegmentMaskController, type PlanSegmentMaskDeps } from './plan-segment-mask-controller';
import { commitCalibration } from '../../floorplan-background/services/commit-calibration';
import { createExternalStore } from '../../stores/createExternalStore';

export type RasterLineSource = Extract<ProposalLineSource, { kind: 'raster' }>;

let aligner: PlanAligner | null = null;
let runSequence = 0;

function alignerInstance(): PlanAligner {
  aligner ??= createPlanAligner();
  return aligner;
}

/** Το είδος εισόδου της σύντηξης: PDF ⇒ σελίδα PDF· αλλιώς ό,τι έκρινε η δυαδοποίηση (σάρωση · αγγελία). */
function inputKindOf(background: FloorplanBackground, alignment: PlanAlignment): PlanInputKind {
  return background.providerId === 'pdf-page' ? 'multipage-pdf' : alignment.binarization;
}

function fuse(run: PlanRecognitionRun, reading: PlanReadingOutcome | null): PlanFusionResult {
  return fusePlan({
    kind: run.kind,
    alignment: run.alignment,
    segments: run.segments,
    reading,
    knownScale: run.knownScale,
    sourceDpi: null,
    segmentRoles: segmentRoleMap(run.segmentRoles ?? []),
    extensionAnchors: extensionAnchorMap(run.segmentRoles ?? []),
  });
}

/** Ό,τι διαβάζει η πολιτική «είσοδος τοίχων» από τη σύντηξη — τίποτα άλλο. */
type WallEvidenceInput = Pick<PlanFusionResult, 'segmentRoles' | 'segmentConfidence'>;

/**
 * ADR-929 Φ5.2ε + Φ5.4 — γίνεται αυτό το τμήμα είσοδος τοίχων; Ο ΕΝΑΣ τόπος της πολιτικής (πηγή + πάνελ ρωτούν εδώ):
 * ρόλος υποψήφιας παρειάς (ποτέ διάσταση, επέκταση ή σημείωση) **και** βεβαιότητα ≥ του ορίου.
 */
export function isWallEvidence(fusion: WallEvidenceInput, segmentId: string): boolean {
  return isWallCandidateRole(fusion.segmentRoles.get(segmentId)) && meetsWallEvidenceTier(fusion, segmentId);
}

function meetsWallEvidenceTier(fusion: WallEvidenceInput, segmentId: string): boolean {
  return meetsConfidenceTier(
    fusion.segmentConfidence.get(segmentId)?.score,
    MODEL_FROM_DRAWING_LIMITS.RASTER_WALL_EVIDENCE_MIN_TIER,
  );
}

/** ADR-929 Φ5.4β — γιατί δεν έγιναν τοίχοι τα τμήματα: ανά σημάδι ρόλου, ή (υποψήφια παρειά) από χαμηλή βεβαιότητα. */
export interface WallEvidenceExclusions {
  readonly byRole: Readonly<Record<PlanRoleMarkKind, number>>;
  readonly lowConfidence: number;
}

/** Χωρίς αποτέλεσμα: τίποτα εκτός τοίχων. */
export const NO_WALL_EVIDENCE_EXCLUSIONS: WallEvidenceExclusions = { byRole: emptyRoleMarkCounts(), lowConfidence: 0 };

/**
 * Η ανάλυση του «εκτός τοίχων» με την ΙΔΙΑ πολιτική με το `isWallEvidence`: ο ρόλος κρίνει πρώτος (ένα τμήμα διάστασης
 * μετρά ως διάσταση, όποια κι αν είναι η βεβαιότητά του), και μόνο οι υποψήφιες παρειές μετρούν ως «χαμηλή βεβαιότητα».
 * Άθροισμα = πλήθος τμημάτων που δεν περνούν το `isWallEvidence`.
 */
export function wallEvidenceExclusions(
  fusion: WallEvidenceInput,
  segments: readonly Pick<RasterSegment, 'id'>[],
): WallEvidenceExclusions {
  const byRole = emptyRoleMarkCounts();
  let lowConfidence = 0;
  for (const { id } of segments) {
    const roleMark = planRoleMarkKind(fusion.segmentRoles.get(id));
    if (roleMark) byRole[roleMark] += 1;
    else if (!meetsWallEvidenceTier(fusion, id)) lowConfidence += 1;
  }
  return { byRole, lowConfidence };
}

/**
 * Η πηγή γραμμών για τον βοηθό: τα **συνορθωμένα** τμήματα (η πρόταση της Φ4) με βεβαιότητα ≥ του ορίου, με ταυτότητα
 * έκδοσης. Τα χαμηλά μένουν στην επικάλυψη («κοίτα την εικόνα»), όχι στους τοίχους: στη ζωντανή επαλήθευση ήταν
 * αυτοκίνητα, διαστάσεις και κείμενα.
 */
function lineSourceOf(run: PlanRecognitionRun, fusion: PlanFusionResult, version: number): RasterLineSource {
  const segments = fusion.adjustedSegments.filter((s) => isWallEvidence(fusion, s.id));
  return { kind: 'raster', recognitionId: `${run.id}.${version}`, floorId: run.floorId, segments };
}

let fusionVersion = 0;

/** Νέα έκδοση πηγής γραμμών για αποτέλεσμα που **ήδη** γράφτηκε στο store. */
function nextLineSource(run: PlanRecognitionRun, fusion: PlanFusionResult): RasterLineSource {
  return lineSourceOf(run, fusion, ++fusionVersion);
}

/**
 * ADR-929 §6.10 Α2 — η τελευταία πηγή γραμμών που ο wiring **δεν** ζήτησε άμεσα (επανεξαγωγή · αναίρεση), στο ΕΝΑ
 * pub/sub του έργου. Κάθε δημοσίευση είναι νέο αντικείμενο (νέα έκδοση) ⇒ ειδοποιεί πάντα.
 */
const publishedLineSource = createExternalStore<RasterLineSource | null>(null);

const DEFAULT_MASK_DEPS: PlanSegmentMaskDeps<RasterLineSource> = {
  extractor: () => alignerInstance(),
  fuse,
  lineSource: nextLineSource,
  publish: (source) => publishedLineSource.set(source),
};
let maskDeps = DEFAULT_MASK_DEPS;

/** Οι τοίχοι ακολουθούν την όψη — μέρος ΑΥΤΟΥ του ελεγκτή (ένας γραφέας), μέσω του ελέγχου της όψης. */
const segmentMask = createPlanSegmentMaskController<RasterLineSource>(() => maskDeps);

/**
 * ADR-929 Φ5.3β — η ανάγνωση μπαίνει στη σύντηξη: ξανατρέχει **μόνο** η `fusePlan` (καθαρή, χωρίς Worker), με νέα έκδοση
 * πηγής γραμμών. Ο σειριακός έλεγχος (`run` ίδιο με εκείνο της αποστολής) γίνεται στον ελεγκτή της όψης. Νέα ανάγνωση ⇒
 * η αναίρεση του σβησίματος της παλιάς (§6.10 Α2) δεν σημαίνει πια τίποτα.
 */
function adoptReading(outcome: PlanReadingOutcome): RasterLineSource | null {
  const { run } = planRecognitionStore.get();
  if (!run) return null;
  const fusion = fuse(run, outcome);
  planRecognitionStore.patch({ reading: outcome, fusion });
  segmentMask.forgetReadingUndo();
  return nextLineSource(run, fusion);
}

const DEFAULT_REVIEW_DEPS: PlanReadingReviewDeps<RasterLineSource> = {
  renderer: () => alignerInstance(),
  raster: (floorId) => getFloorProvider(floorId)?.getPlanRaster() ?? null,
  api: planReadingApi,
  hash: (bytes) => sha256Hex(bytes),
  objectUrl: { create: (blob) => URL.createObjectURL(blob), revoke: (url) => URL.revokeObjectURL(url) },
  adoptReading,
  onViewCommitted: (view, before) => { void segmentMask.apply(view, before); },
  onReviewReset: () => segmentMask.cancel(),
  undoReadingDrop: () => segmentMask.undo(),
};
let reviewDeps = DEFAULT_REVIEW_DEPS;

/** Ο έλεγχος της όψης πριν την αποστολή — μέρος ΑΥΤΟΥ του ελεγκτή (ένας γραφέας). */
const readingReview = createPlanReadingReview<RasterLineSource>(() => reviewDeps);

/** ADR-929 Φ5.3γ — νέα σύντηξη για το ίδιο αποτέλεσμα γεωμετρίας (π.χ. νέα κλίμακα): store + νέα έκδοση πηγής γραμμών. */
function adoptFusion(run: PlanRecognitionRun, fusion: PlanFusionResult): RasterLineSource {
  planRecognitionStore.patch({ run, fusion });
  return nextLineSource(run, fusion);
}

const DEFAULT_SCALE_DEPS: PlanScaleControllerDeps<RasterLineSource> = {
  fuse,
  adoptFusion,
  background: (floorId) => getFloorBackground(floorId) ?? null,
  commit: commitCalibration,
  now: () => Date.now(),
};
let scaleDeps = DEFAULT_SCALE_DEPS;

/** Η κάρτα κλίμακας — μέρος ΑΥΤΟΥ του ελεγκτή (ένας γραφέας). */
const scaleController = createPlanScaleController<RasterLineSource>(() => scaleDeps);

function fail(failure: PlanRecognitionFailure): null {
  readingReview.end();
  segmentMask.track(null, null);
  planRecognitionStore.patch({ phase: 'idle', run: null, fusion: null, reading: null, failure, scaleHoverTextId: null });
  return null;
}

export const planRecognitionSession = {
  /**
   * Αναγνώριση του υποβάθρου ενός ορόφου. Επιστρέφει την πηγή γραμμών, ή `null` (αποτυχία με όνομα στο store, ή
   * νεότερο `run` πήρε τη θέση του).
   */
  async run(floorId: string): Promise<RasterLineSource | null> {
    const sequence = ++runSequence;
    readingReview.end(); // νέα αναγνώριση ⇒ η όψη της παλιάς δεν σημαίνει τίποτα
    const background = getFloorBackground(floorId);
    const provider = getFloorProvider(floorId);
    if (!background || !provider) return fail('no-background');
    const raster = provider.getPlanRaster();
    if (!raster) return fail('no-pixels');
    planRecognitionStore.patch({ phase: 'running', failure: null });
    const knownScale = resolveRasterPixelScale(background);
    const reply = await alignerInstance().align(raster, { segments: { scale: knownScale } });
    if (sequence !== runSequence || reply.kind === 'superseded') return null;
    if (reply.kind === 'failed') return fail('aligner-failed');
    const segments = reply.value.segments?.segments ?? [];
    if (segments.length === 0) return fail('no-segments');
    const segmentRoles = reply.value.segments?.classification.verdicts ?? [];
    const run: PlanRecognitionRun = {
      id: `rec${sequence}`,
      floorId,
      backgroundId: background.id,
      kind: inputKindOf(background, reply.value.alignment),
      alignment: reply.value.alignment,
      segments,
      segmentRoles,
      knownScale,
    };
    const fusion = fuse(run, null);
    segmentMask.track(run, knownScale);
    planRecognitionStore.patch({ phase: 'ready', run, reading: null, fusion, failure: null, scaleHoverTextId: null });
    return nextLineSource(run, fusion);
  },

  /**
   * ADR-929 §6.10 Α2 — πηγές γραμμών που ο wiring **δεν** ζήτησε άμεσα (οι τοίχοι ξαναβγήκαν από νέα όψη · αναίρεση).
   * Επιστρέφει την απεγγραφή.
   */
  onLineSource(listener: (source: RasterLineSource) => void): () => void {
    return publishedLineSource.subscribe(() => {
      const source = publishedLineSource.get();
      if (source) listener(source);
    });
  },

  /** Η τρέχουσα πηγή γραμμών (μετά από κάθε επανάληψη της σύντηξης), ή `null` χωρίς αποτέλεσμα. */
  currentLineSource(): RasterLineSource | null {
    const { run, fusion } = planRecognitionStore.get();
    return run && fusion ? lineSourceOf(run, fusion, fusionVersion) : null;
  },

  /**
   * ADR-929 Φ5.3β — η όψη που ελέγχει ο άνθρωπος πριν την ανάγνωση: `begin` · `edit` · `reset` · `setTool` · `prepare`
   * («Έλεγχος πριν την αποστολή») · `send` (μόνο το πακέτο) · `end`.
   */
  review: readingReview,

  /**
   * ADR-929 Φ5.3γ — η κάρτα κλίμακας από τις διαβασμένες διαστάσεις: `card` · `apply` (μόνο με ρητή πράξη, από τη μία
   * πόρτα `commitCalibration`) · `syncKnownScale` (μετά από κάθε βαθμονόμηση) · `hover`.
   */
  scale: scaleController,

  /** Κλείσιμο: σβήνει το αποτέλεσμα, ακυρώνει ό,τι τρέχει, τερματίζει τον Worker. */
  close(): void {
    runSequence += 1;
    readingReview.end();
    segmentMask.track(null, null);
    planRecognitionStore.reset();
    aligner?.dispose();
    aligner = null;
  },
};

/** Μόνο για tests: ψεύτικες εξαρτήσεις του ελέγχου όψης (δίκτυο, pixel, Worker, URL). `null` ⇒ οι πραγματικές. */
export function __setPlanReadingReviewDepsForTests(next: Partial<PlanReadingReviewDeps<RasterLineSource>> | null): void {
  reviewDeps = next ? { ...DEFAULT_REVIEW_DEPS, ...next } : DEFAULT_REVIEW_DEPS;
}

/** Μόνο για tests: ψεύτικες εξαρτήσεις της κάρτας κλίμακας (εγγραφή, υπόβαθρο, ρολόι). `null` ⇒ οι πραγματικές. */
export function __setPlanScaleDepsForTests(next: Partial<PlanScaleControllerDeps<RasterLineSource>> | null): void {
  scaleDeps = next ? { ...DEFAULT_SCALE_DEPS, ...next } : DEFAULT_SCALE_DEPS;
}

/** Μόνο για tests: ψεύτικες εξαρτήσεις των τοίχων που ακολουθούν την όψη (Worker). `null` ⇒ οι πραγματικές. */
export function __setPlanSegmentMaskDepsForTests(next: Partial<PlanSegmentMaskDeps<RasterLineSource>> | null): void {
  maskDeps = next ? { ...DEFAULT_MASK_DEPS, ...next } : DEFAULT_MASK_DEPS;
}

/** Μόνο για tests: ψεύτικος ευθυγραμμιστής (Worker-less). */
export function __setPlanAlignerForTests(next: PlanAligner | null): void {
  aligner?.dispose();
  aligner = next;
}
