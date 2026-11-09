/**
 * ADR-929 §6.10 Α2 — οι **τοίχοι ακολουθούν την όψη**: ό,τι αποφάσισε ο άνθρωπος στην όψη της ανάγνωσης (crop + περιοχές
 * απόκρυψης) μετρά και για την εξαγωγή των τμημάτων. Υπο-module του ενός γραφέα (`planRecognitionSession.mask`), όπως το
 * `plan-scale-controller`.
 *
 * - `apply(view)` — μετά από **δεσμευμένη** αλλαγή της όψης (απελευθέρωση του ποντικιού, όπως το Cinema 4D· όσο σέρνεις,
 *   το πρόχειρο της χειρονομίας είναι η φθηνή όψη). Ίδια όψη με εκείνη των τοίχων ⇒ τίποτα (ιδεμποτία). Όψη = πρόταση
 *   ⇒ η **αρχική** εξαγωγή, από μνήμη, χωρίς Worker. Αλλιώς ο Worker (χωρίς κατάσταση) με σειριακό αριθμό: αποτέλεσμα
 *   για παλιά αλλαγή ή άλλη αναγνώριση **αγνοείται**.
 * - Υπήρχε ανάγνωση AI ⇒ σβήνεται (τα ids των τμημάτων της δεν υπάρχουν πια), με **Αναίρεση ενός επιπέδου** (`undo`):
 *   επιστρέφουν αναγνώριση, σύντηξη, ανάγνωση και η όψη πριν την πρώτη αλλαγή.
 *
 * 🔒 Τίποτα εδώ δεν γράφει στη σκηνή ή στον διακομιστή: η νέα πηγή γραμμών πηγαίνει στον βοηθό του ADR-911 (`publish`).
 * Zero React.
 *
 * @see ./plan-recognition-session.ts (ο ιδιοκτήτης)
 * @see ../../bim/plan-recognition/segments/plan-segments.ts (`PlanInkMask`)
 */

import type { PlanAligner } from '../../bim/plan-recognition/alignment/plan-align-client';
import type { PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReadingOutcome, PlanSegmentRoleVerdict, RasterSegment } from '../../bim/plan-recognition/plan-recognition-types';
import { proposedReadingView, type PlanReadingView } from '../../bim/plan-recognition/reading/plan-reading-view';
import { readingViewKey } from '../../bim/plan-recognition/reading/plan-reading-view-edit';
import type { RasterPixelScale } from '../../floorplan-background/geometry/raster-pixel-scale';
import {
  planRecognitionStore,
  type PlanReadingReview,
  type PlanReadingSendState,
  type PlanReadingWalls,
  type PlanRecognitionRun,
} from './plan-recognition-store';

export interface PlanSegmentMaskDeps<TSource> {
  readonly extractor: () => Pick<PlanAligner, 'extractSegments'>;
  /** Η σύντηξη (καθαρή): ίδια με εκείνη της συνεδρίας. */
  readonly fuse: (run: PlanRecognitionRun, reading: PlanReadingOutcome | null) => PlanFusionResult;
  /** Νέα έκδοση πηγής γραμμών για αποτέλεσμα που **ήδη** γράφτηκε στο store. */
  readonly lineSource: (run: PlanRecognitionRun, fusion: PlanFusionResult) => TSource;
  /** Παράδοση στον βοηθό: πηγή που δεν ζήτησε άμεσα ο wiring. */
  readonly publish: (source: TSource) => void;
}

/** Ό,τι χρειάζεται η όψη για να επιστρέψει στο σημείο πριν την πρώτη αλλαγή. */
export interface PlanReadingRestore {
  readonly view: PlanReadingView;
  readonly send: PlanReadingSendState;
}

interface Extraction {
  readonly segments: readonly RasterSegment[];
  readonly segmentRoles: readonly PlanSegmentRoleVerdict[];
}

/** Η αρχική εξαγωγή μιας αναγνώρισης (η πρόταση) και η κλίμακα με την οποία βγήκε. */
interface OriginalExtraction extends Extraction {
  readonly rootId: string;
  readonly scale: RasterPixelScale | null;
}

interface ReadingSnapshot extends PlanReadingRestore {
  readonly run: PlanRecognitionRun;
  readonly reading: PlanReadingOutcome;
}

export function createPlanSegmentMaskController<TSource>(depsOf: () => PlanSegmentMaskDeps<TSource>) {
  let sequence = 0;
  let version = 0;
  let original: OriginalExtraction | null = null;
  /** Η κατάσταση πριν την πρώτη αλλαγή με ζωντανή ανάγνωση· γίνεται `undoable` μόνο όταν η ανάγνωση πράγματι σβηστεί. */
  let pending: ReadingSnapshot | null = null;
  let undoable: ReadingSnapshot | null = null;

  const belongs = (run: PlanRecognitionRun, root: OriginalExtraction): boolean =>
    run.id === root.rootId || run.id.startsWith(`${root.rootId}.`);

  function setWalls(next: Partial<PlanReadingWalls>): void {
    const { review } = planRecognitionStore.get();
    if (review) planRecognitionStore.patch({ review: { ...review, walls: { ...review.walls, ...next } } });
  }

  async function extract(run: PlanRecognitionRun, view: PlanReadingView, root: OriginalExtraction): Promise<Extraction | null> {
    const { image, ink, sheet, alignedToOriginal, originalToAligned, workingScale } = run.alignment;
    const reply = await depsOf().extractor().extractSegments({
      source: { image: { width: image.width, height: image.height }, ink, sheet, alignedToOriginal, originalToAligned, workingScale },
      mask: { region: view.crop, excluded: view.redacted },
      request: { scale: root.scale },
    }).catch(() => null);
    if (reply?.kind !== 'ok') return null;
    const { segments, classification } = reply.value.extraction;
    return { segments, segmentRoles: classification.verdicts };
  }

  /** Νέο `run` από την εξαγωγή · σύντηξη χωρίς ανάγνωση · store · νέα πηγή γραμμών. */
  function adopt(root: OriginalExtraction, extraction: Extraction, maskView: PlanReadingView | undefined): void {
    const { run, reading, review } = planRecognitionStore.get();
    if (!run) return;
    const next: PlanRecognitionRun = {
      ...run, id: `${root.rootId}.m${++version}`, segments: extraction.segments, segmentRoles: extraction.segmentRoles, maskView,
    };
    const fusion = depsOf().fuse(next, null);
    if (reading !== null) undoable = pending ?? undoable;
    pending = null;
    const walls: PlanReadingWalls = { status: 'following', readingDropped: undoable !== null };
    planRecognitionStore.patch({ run: next, fusion, reading: null, review: review ? { ...review, walls } : null });
    depsOf().publish(depsOf().lineSource(next, fusion));
  }

  return {
    /** Νέα αναγνώριση (ή καμία): η αρχική εξαγωγή της είναι η πρόταση. Ακυρώνει ό,τι τρέχει. */
    track(run: PlanRecognitionRun | null, scale: RasterPixelScale | null): void {
      sequence += 1;
      pending = null;
      undoable = null;
      original = run ? { rootId: run.id, segments: run.segments, segmentRoles: run.segmentRoles ?? [], scale } : null;
    },

    /** Η όψη άνοιξε ή έκλεισε: ό,τι τρέχει ακυρώνεται, η αναίρεση χάνεται. Οι τοίχοι μένουν της τελευταίας όψης. */
    cancel(): void {
      sequence += 1;
      pending = null;
      undoable = null;
    },

    /** Νέα ανάγνωση μπήκε στη σύντηξη: η αναίρεση της παλιάς δεν σημαίνει πια τίποτα. */
    forgetReadingUndo(): void {
      pending = null;
      undoable = null;
      setWalls({ readingDropped: false });
    },

    /** Η όψη που δέσμευσε ο άνθρωπος· `before` = η όψη όπως ήταν **πριν** την αλλαγή (για την αναίρεση). */
    async apply(view: PlanReadingView, before: PlanReadingReview): Promise<void> {
      const seq = ++sequence;
      const { run, reading } = planRecognitionStore.get();
      const root = original;
      if (!run || !root || !belongs(run, root)) return;
      const proposalKey = readingViewKey(proposedReadingView(run.alignment));
      const targetKey = readingViewKey(view);
      if (targetKey === (run.maskView ? readingViewKey(run.maskView) : proposalKey)) {
        pending = null;
        setWalls({ status: 'following' });
        return;
      }
      if (reading !== null) pending ??= { run, reading, view: before.view, send: before.send };
      if (targetKey === proposalKey) {
        adopt(root, root, undefined);
        return;
      }
      setWalls({ status: 'updating' });
      const extraction = await extract(run, view, root);
      if (seq !== sequence || planRecognitionStore.get().run?.id !== run.id) return;
      if (extraction) adopt(root, extraction, view);
      else setWalls({ status: 'failed' });
    },

    /**
     * Αναίρεση του σβησίματος της ανάγνωσης: αναγνώριση + ανάγνωση όπως ήταν, με τη **σημερινή** κλίμακα (η σύντηξη
     * ξανατρέχει, καθαρή). Επιστρέφει την όψη για τον έλεγχο της όψης, ή `null` όταν δεν υπάρχει τίποτα να αναιρεθεί.
     */
    undo(): PlanReadingRestore | null {
      const snapshot = undoable;
      const { run } = planRecognitionStore.get();
      if (!snapshot || !run) return null;
      sequence += 1;
      pending = null;
      undoable = null;
      const restored: PlanRecognitionRun = { ...snapshot.run, knownScale: run.knownScale };
      const fusion = depsOf().fuse(restored, snapshot.reading);
      planRecognitionStore.patch({ run: restored, fusion, reading: snapshot.reading });
      depsOf().publish(depsOf().lineSource(restored, fusion));
      return { view: snapshot.view, send: snapshot.send };
    },
  };
}

export type PlanSegmentMaskController<TSource> = ReturnType<typeof createPlanSegmentMaskController<TSource>>;
