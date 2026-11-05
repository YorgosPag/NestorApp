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
import type { PlanInputKind, PlanReadingOutcome } from '../../bim/plan-recognition/plan-recognition-types';
import { getFloorBackground, getFloorProvider } from '../../floorplan-background/stores/floorplanBackgroundStore';
import { resolveRasterPixelScale } from '../../floorplan-background/geometry/raster-pixel-scale';
import type { FloorplanBackground } from '../../floorplan-background/providers/types';
import type { ProposalLineSource } from '../model-from-drawing/proposal-line-source';
import { planRecognitionStore, type PlanRecognitionFailure, type PlanRecognitionRun } from './plan-recognition-store';

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
  });
}

/** Η πηγή γραμμών για τον βοηθό: τα **συνορθωμένα** τμήματα (η πρόταση της Φ4), με ταυτότητα έκδοσης. */
function lineSourceOf(run: PlanRecognitionRun, fusion: PlanFusionResult, version: number): RasterLineSource {
  return { kind: 'raster', recognitionId: `${run.id}.${version}`, floorId: run.floorId, segments: fusion.adjustedSegments };
}

function fail(failure: PlanRecognitionFailure): null {
  planRecognitionStore.patch({ phase: 'idle', run: null, fusion: null, reading: null, failure });
  return null;
}

let fusionVersion = 0;

export const planRecognitionSession = {
  /**
   * Αναγνώριση του υποβάθρου ενός ορόφου. Επιστρέφει την πηγή γραμμών, ή `null` (αποτυχία με όνομα στο store, ή
   * νεότερο `run` πήρε τη θέση του).
   */
  async run(floorId: string): Promise<RasterLineSource | null> {
    const sequence = ++runSequence;
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
    const run: PlanRecognitionRun = {
      id: `rec${sequence}`,
      floorId,
      backgroundId: background.id,
      kind: inputKindOf(background, reply.value.alignment),
      alignment: reply.value.alignment,
      segments,
      knownScale,
    };
    const fusion = fuse(run, null);
    planRecognitionStore.patch({ phase: 'ready', run, reading: null, fusion, failure: null });
    return lineSourceOf(run, fusion, ++fusionVersion);
  },

  /** Η τρέχουσα πηγή γραμμών (μετά από κάθε επανάληψη της σύντηξης), ή `null` χωρίς αποτέλεσμα. */
  currentLineSource(): RasterLineSource | null {
    const { run, fusion } = planRecognitionStore.get();
    return run && fusion ? lineSourceOf(run, fusion, fusionVersion) : null;
  },

  /** Κλείσιμο: σβήνει το αποτέλεσμα, ακυρώνει ό,τι τρέχει, τερματίζει τον Worker. */
  close(): void {
    runSequence += 1;
    planRecognitionStore.reset();
    aligner?.dispose();
    aligner = null;
  },
};

/** Μόνο για tests: ψεύτικος ευθυγραμμιστής (Worker-less). */
export function __setPlanAlignerForTests(next: PlanAligner | null): void {
  aligner?.dispose();
  aligner = next;
}
