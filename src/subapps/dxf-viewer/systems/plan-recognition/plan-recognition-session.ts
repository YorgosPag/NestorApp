/**
 * ADR-929 Φ5 — ο **ελεγκτής** της αναγνώρισης κάτοψης στον πελάτη: ο ΕΝΑΣ που γράφει στο `planRecognitionStore`.
 *
 * Κύκλος: `run(floorId)` — pixel από τον provider (μία αποκωδικοποίηση, §6.2 #6) → ευθυγράμμιση + τμήματα σε **ένα**
 * ταξίδι του Worker (§6.3 #8) → σύντηξη χωρίς ανάγνωση (η γεωμετρία μόνη της, Δ15 #1) → η πηγή γραμμών για τον
 * βοηθό του ADR-911. Κάθε νέα είσοδος (ανάγνωση, απάντηση ανθρώπου) ξανατρέχει **μόνο** τη σύντηξη, που είναι
 * καθαρή και ντετερμινιστική: ίδια είσοδος ⇒ ίδιο αποτέλεσμα, χωρίς δεύτερο ταξίδι στον Worker.
 *
 * ADR-929 Φ0.6 — μόλις η αναγνώριση γίνει `ready`, η **τοπική ανάγνωση** (OCR στη συσκευή) ξεκινά μόνη της στο παρασκήνιο
 * και μπαίνει από την ΙΔΙΑ πόρτα (`adoptReading`) με την ανάγνωση AI — κανένας δεύτερος δρόμος (`plan-ocr-controller.ts`).
 *
 * ADR-929 Δ21 (δ) — οι **διορθώσεις τιμών** του ανθρώπου εφαρμόζονται σε **ένα** σημείο, τη `fuse` αυτού του αρχείου, που
 * τη μοιράζονται όλοι οι υπο-ελεγκτές (όψη · κλίμακα · διορθώσεις): καμία σύντηξη δεν τις προσπερνά. Νέα ανάγνωση ⇒ σβήνουν.
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
import type { ProposalLineSource, RasterDimensionSource } from '../model-from-drawing/proposal-line-source';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { sha256Hex } from '@/lib/hash/sha256';
import { OCR_IDLE, planRecognitionStore, type PlanRecognitionFailure, type PlanRecognitionRun } from './plan-recognition-store';
import { meetsConfidenceTier } from './plan-confidence';
import { emptyRoleMarkCounts, planRoleMarkKind, type PlanRoleMarkKind } from './plan-role-marks';
import { extensionAnchorMap, isWallCandidateRole, segmentRoleMap } from '../../bim/plan-recognition/classify/segment-roles';
import { createPlanReadingReview, type PlanReadingReviewDeps } from './plan-reading-review';
import { planReadingApi } from './plan-reading-api-client';
import { createPlanScaleController, type PlanScaleControllerDeps } from './plan-scale-controller';
import { createPlanSegmentMaskController, type PlanSegmentMaskDeps } from './plan-segment-mask-controller';
import { commitCalibration } from '../../floorplan-background/services/commit-calibration';
import { createExternalStore } from '../../stores/createExternalStore';
import { createPlanOcrReader, type PlanOcrReader } from '../../bim/plan-recognition/ocr/plan-ocr-client';
import { resolveOcrAssets } from '../../bim/plan-recognition/ocr/ocr-model-assets';
import { localOcrModelId } from '../../bim/plan-recognition/ocr/ocr-reading';
import { createPlanOcrController, type PlanOcrControllerDeps } from './plan-ocr-controller';
import {
  applyReadingCorrectionsToOutcome,
  NO_READING_CORRECTIONS,
  type PlanReadingCorrections,
} from '../../bim/plan-recognition/reading/reading-corrections';
import { createPlanReadingCorrectionsController, type PlanReadingCorrectionsDeps } from './plan-reading-corrections';

export type RasterLineSource = Extract<ProposalLineSource, { kind: 'raster' }>;

let aligner: PlanAligner | null = null;
let ocrReader: PlanOcrReader | null = null;
let runSequence = 0;

function alignerInstance(): PlanAligner {
  aligner ??= createPlanAligner();
  return aligner;
}

/** ADR-929 Φ0.6 — ένας αναγνώστης κειμένων ανά επεξεργαστή (ο Worker του γεννιέται στην πρώτη ανάγνωση). */
function ocrReaderInstance(): PlanOcrReader {
  ocrReader ??= createPlanOcrReader();
  return ocrReader;
}

/** Το είδος εισόδου της σύντηξης: PDF ⇒ σελίδα PDF· αλλιώς ό,τι έκρινε η δυαδοποίηση (σάρωση · αγγελία). */
function inputKindOf(background: FloorplanBackground, alignment: PlanAlignment): PlanInputKind {
  return background.providerId === 'pdf-page' ? 'multipage-pdf' : alignment.binarization;
}

/** Η σύντηξη με **ρητές** διορθώσεις του ανθρώπου πάνω στην ανάγνωση της μηχανής (Δ21 (δ)). */
function fuseWith(
  run: PlanRecognitionRun, reading: PlanReadingOutcome | null, corrections: PlanReadingCorrections,
): PlanFusionResult {
  return fusePlan({
    kind: run.kind,
    alignment: run.alignment,
    segments: run.segments,
    reading: applyReadingCorrectionsToOutcome(reading, corrections),
    knownScale: run.knownScale,
    sourceDpi: null,
    segmentRoles: segmentRoleMap(run.segmentRoles ?? []),
    extensionAnchors: extensionAnchorMap(run.segmentRoles ?? []),
  });
}

/** Η σύντηξη με τις διορθώσεις που ισχύουν τώρα — η ΜΙΑ που μοιράζονται όψη, κλίμακα και ανάγνωση. */
function fuse(run: PlanRecognitionRun, reading: PlanReadingOutcome | null): PlanFusionResult {
  return fuseWith(run, reading, planRecognitionStore.get().readingCorrections);
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
function dimensionSourceOf(run: PlanRecognitionRun, fusion: PlanFusionResult): RasterDimensionSource {
  return {
    fusion,
    segments: run.segments,
    originalToAligned: run.alignment.originalToAligned,
    alignedToOriginal: run.alignment.alignedToOriginal,
    verdicts: run.segmentRoles ?? [],
  };
}

function lineSourceOf(run: PlanRecognitionRun, fusion: PlanFusionResult, version: number): RasterLineSource {
  const segments = fusion.adjustedSegments.filter((s) => isWallEvidence(fusion, s.id));
  return {
    kind: 'raster', recognitionId: `${run.id}.${version}`, floorId: run.floorId, backgroundId: run.backgroundId, segments,
    dimensions: dimensionSourceOf(run, fusion),
  };
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

const publishLineSource = (source: RasterLineSource): void => publishedLineSource.set(source);

const DEFAULT_MASK_DEPS: PlanSegmentMaskDeps<RasterLineSource> = {
  extractor: () => alignerInstance(),
  fuse,
  lineSource: nextLineSource,
  publish: publishLineSource,
  readingFor: (run) => ocrController.readingFor(run),
};
let maskDeps = DEFAULT_MASK_DEPS;

/** Οι τοίχοι ακολουθούν την όψη — μέρος ΑΥΤΟΥ του ελεγκτή (ένας γραφέας), μέσω του ελέγχου της όψης. */
const segmentMask = createPlanSegmentMaskController<RasterLineSource>(() => maskDeps);

/**
 * ADR-929 Φ5.3β — η ανάγνωση μπαίνει στη σύντηξη: ξανατρέχει **μόνο** η `fusePlan` (καθαρή, χωρίς Worker), με νέα έκδοση
 * πηγής γραμμών. Ο σειριακός έλεγχος (`run` ίδιο με εκείνο της αποστολής) γίνεται στον ελεγκτή της όψης. Νέα ανάγνωση ⇒
 * η αναίρεση του σβησίματος της παλιάς (§6.10 Α2) δεν σημαίνει πια τίποτα — ούτε οι διορθώσεις της (Δ21 (δ)): τα `id`
 * κειμένων μιας νέας ανάγνωσης δεν μιλούν για τα ίδια κείμενα.
 */
function adoptReading(outcome: PlanReadingOutcome): RasterLineSource | null {
  const { run } = planRecognitionStore.get();
  if (!run) return null;
  const fusion = fuseWith(run, outcome, NO_READING_CORRECTIONS);
  planRecognitionStore.patch({ reading: outcome, fusion, readingCorrections: NO_READING_CORRECTIONS, readHoverTextId: null });
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

const DEFAULT_OCR_DEPS: PlanOcrControllerDeps<RasterLineSource> = {
  reader: () => ocrReaderInstance(),
  // ADR-929 §6.16 βήμα 4: πυκνότερη εικόνα για το OCR όταν υπάρχει (σάρωση PDF στην εγγενή της ανάλυση)
  recognitionRaster: async (floorId) => (await getFloorProvider(floorId)?.getRecognitionRaster()) ?? null,
  model: () => localOcrModelId(resolveOcrAssets()),
  adoptReading,
  publish: publishLineSource,
};
let ocrDeps = DEFAULT_OCR_DEPS;

/** ADR-929 Φ0.6 — η τοπική ανάγνωση στο παρασκήνιο — μέρος ΑΥΤΟΥ του ελεγκτή (ένας γραφέας). */
const ocrController = createPlanOcrController<RasterLineSource>(() => ocrDeps);

/** ADR-929 Δ21 (δ) — οι διορθώσεις τιμών του ανθρώπου — μέρος ΑΥΤΟΥ του ελεγκτή (ένας γραφέας). */
const CORRECTIONS_DEPS: PlanReadingCorrectionsDeps<RasterLineSource> = {
  fuse: fuseWith,
  lineSource: nextLineSource,
  publish: publishLineSource,
};
const readingCorrections = createPlanReadingCorrectionsController<RasterLineSource>(() => CORRECTIONS_DEPS);

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
  ocrController.reset();
  planRecognitionStore.patch({
    phase: 'idle', run: null, fusion: null, reading: null, failure, scaleHoverTextId: null, ocr: OCR_IDLE,
    readingCorrections: NO_READING_CORRECTIONS, readHoverTextId: null,
  });
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
    ocrController.reset(); // …και η τοπική της ανάγνωση
    const background = getFloorBackground(floorId);
    const provider = getFloorProvider(floorId);
    if (!background || !provider) return fail('no-background');
    const raster = provider.getPlanRaster();
    if (!raster) return fail('no-pixels');
    planRecognitionStore.patch({ phase: 'running', failure: null, ocr: OCR_IDLE });
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
    planRecognitionStore.patch({
      phase: 'ready', run, reading: null, fusion, failure: null, scaleHoverTextId: null, ocr: OCR_IDLE,
      readingCorrections: NO_READING_CORRECTIONS, readHoverTextId: null,
    });
    void ocrController.start(run); // Φ0.6: αυτόματα, στο παρασκήνιο — τίποτα δεν φεύγει από τη συσκευή
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

  /**
   * ADR-929 Φ0.6 — η τοπική ανάγνωση που ξεκινά μόνη της μετά την αναγνώριση: `cancel` («Ακύρωση») · `retry` («Ξανά»).
   */
  ocr: { cancel: () => ocrController.cancel(), retry: () => ocrController.retry() },

  /**
   * ADR-929 Δ21 (δ) — η λίστα «Τι διάβασα»: `correct` (διόρθωση τιμής) · `markNotDimension` · `confirm` · `revert` · `hover` · `preview`. Κάθε
   * αλλαγή ξανατρέχει μόνο τη σύντηξη και δίνει νέα πηγή γραμμών από το `onLineSource`.
   */
  corrections: readingCorrections,

  /** Κλείσιμο: σβήνει το αποτέλεσμα, ακυρώνει ό,τι τρέχει, τερματίζει τους Workers. */
  close(): void {
    runSequence += 1;
    readingReview.end();
    segmentMask.track(null, null);
    ocrController.reset();
    planRecognitionStore.reset();
    aligner?.dispose();
    aligner = null;
    ocrReader?.dispose();
    ocrReader = null;
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

/** Μόνο για tests: ψεύτικες εξαρτήσεις της τοπικής ανάγνωσης (Worker, pixel, μητρώο). `null` ⇒ οι πραγματικές. */
export function __setPlanOcrDepsForTests(next: Partial<PlanOcrControllerDeps<RasterLineSource>> | null): void {
  ocrDeps = next ? { ...DEFAULT_OCR_DEPS, ...next } : DEFAULT_OCR_DEPS;
}

/** Μόνο για tests: ψεύτικος ευθυγραμμιστής (Worker-less). */
export function __setPlanAlignerForTests(next: PlanAligner | null): void {
  aligner?.dispose();
  aligner = next;
}
