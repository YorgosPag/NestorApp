/**
 * ADR-929 Φ5.3β — ο **έλεγχος της όψης πριν φύγει**: οι πράξεις της ανάγνωσης μέσα στον ελεγκτή της αναγνώρισης.
 * Μέρος του **ενός** γραφέα του `planRecognitionStore` (το `plan-recognition-session.ts` τις εκθέτει· κανείς άλλος δεν
 * τις καλεί).
 *
 * Δύο βήματα, όπως το Acrobat «Mark → Apply»:
 *   1. **Σήμανση** (`begin` · `edit` · `reset` · `setTool`): crop + περιοχές απόκρυψης. Τίποτα βαρύ δεν τρέχει.
 *   2. **Έλεγχος** (`prepare`): στον Worker τα pixel της όψης + PNG· sha256 από τα **ίδια** bytes· μικρογραφία από το
 *      **ίδιο** Blob· παράλληλα ο προέλεγχος (εκτίμηση · υπόλοιπο · λόγος).
 * Η **αποστολή** (`send`) χρησιμοποιεί **ΜΟΝΟ** το πακέτο του βήματος 2. Κάθε επεξεργασία το σβήνει. Ο διακομιστής
 * απαντά με το sha256 που **έλαβε**· ασυμφωνία ⇒ η ανάγνωση δεν μπαίνει στη σύντηξη (απόδειξη παραλαβής).
 *
 * 🔑 Αγώνες: σειριακός αριθμός ανά πράξη + ταυτότητα `run`. Αποτέλεσμα για παλιά όψη ή παλιό `run` **αγνοείται**.
 * 🔑 ADR-929 §6.10 Α2: κάθε δεσμευμένη αλλαγή της όψης πάει και στους τοίχους (`onViewCommitted`). Όσο ξαναβγαίνουν,
 *   ο «Έλεγχος» περιμένει: το πακέτο πρέπει να φέρει τα τμήματα της όψης που βλέπει ο άνθρωπος.
 * 🔒 Ποτέ αυτόματη αποστολή· με άρνηση (κλειστός διακόπτης, νομική πύλη, όριο) η γεωμετρία μένει ως έχει.
 *
 * Zero React.
 *
 * @see ./plan-recognition-session.ts (ο ιδιοκτήτης)
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { PlanAligner } from '../../bim/plan-recognition/alignment/plan-align-client';
import type { PlanReading, PlanReadingOutcome } from '../../bim/plan-recognition/plan-recognition-types';
import { proposedReadingView, viewSegmentsOf, type PlanReadingView } from '../../bim/plan-recognition/reading/plan-reading-view';
import { readingViewSize } from '../../bim/plan-recognition/reading/plan-reading-view-raster';
import { planReadingFromView } from '../../bim/plan-recognition/reading/plan-reading-from-view';
import type { PlanReadingRouteResult } from '../../bim/plan-recognition/reading/plan-reading-contract';
import type { PlanReadingApi } from './plan-reading-api-client';
import type { PlanReadingRestore } from './plan-segment-mask-controller';
import {
  WALLS_FOLLOWING,
  planRecognitionStore,
  type PlanReadingCounts,
  type PlanReadingPacket,
  type PlanReadingPreflightState,
  type PlanReadingReview,
  type PlanReadingTool,
  type PlanRecognitionRun,
} from './plan-recognition-store';

export interface PlanReadingReviewDeps<T> {
  readonly renderer: () => Pick<PlanAligner, 'renderView'>;
  /** Νέο buffer της **αρχικής** εικόνας ανά κλήση (`provider.getPlanRaster`). */
  readonly raster: (floorId: string) => PlanRaster | null;
  readonly api: PlanReadingApi;
  readonly hash: (bytes: ArrayBuffer) => Promise<string>;
  readonly objectUrl: { readonly create: (blob: Blob) => string; readonly revoke: (url: string) => void };
  /** Ο ιδιοκτήτης ξανατρέχει **μόνο** τη σύντηξη με την ανάγνωση και δίνει τη νέα πηγή γραμμών. */
  readonly adoptReading: (outcome: PlanReadingOutcome) => T | null;
  /** ADR-929 §6.10 Α2 — δεσμευμένη όψη ⇒ οι τοίχοι· `before` = η όψη πριν την αλλαγή (για την αναίρεση). */
  readonly onViewCommitted: (view: PlanReadingView, before: PlanReadingReview) => void;
  /** Η όψη άνοιξε ή έκλεισε: ό,τι τρέχει για τους τοίχους ακυρώνεται. */
  readonly onReviewReset: () => void;
  /** Αναίρεση του σβησίματος της ανάγνωσης· η όψη πριν την πρώτη αλλαγή, ή `null`. */
  readonly undoReadingDrop: () => PlanReadingRestore | null;
}

const IDLE_PREFLIGHT: PlanReadingPreflightState = { status: 'idle' };

function countsOf(reading: PlanReading): PlanReadingCounts {
  return { texts: reading.texts.length, dimensions: reading.dimensions.length, rooms: reading.rooms.length, openings: reading.openings.length };
}

/**
 * Ο ελεγκτής της όψης. `T` = ο τύπος της πηγής γραμμών που επιστρέφει ο ιδιοκτήτης μετά την ανάγνωση. Οι εξαρτήσεις
 * διαβάζονται τη στιγμή της πράξης (`depsOf`), ώστε τα tests να τις αντικαθιστούν χωρίς δεύτερο ελεγκτή.
 */
export function createPlanReadingReview<T>(depsOf: () => PlanReadingReviewDeps<T>) {
  let sequence = 0;

  const review = (): PlanReadingReview | null => planRecognitionStore.get().review;
  const patchReview = (next: Partial<PlanReadingReview>): void => {
    const current = review();
    if (current) planRecognitionStore.patch({ review: { ...current, ...next } });
  };
  const revokePacket = (packet: PlanReadingPacket | null | undefined): void => {
    if (packet) depsOf().objectUrl.revoke(packet.previewUrl);
  };
  const isCurrent = (seq: number, runId: string): boolean =>
    seq === sequence && review() !== null && planRecognitionStore.get().run?.id === runId;

  async function renderPacket(run: PlanRecognitionRun, view: PlanReadingView): Promise<PlanReadingPacket | null> {
    const raster = depsOf().raster(run.floorId);
    if (!raster) return null;
    const { alignedToOriginal, workingScale } = run.alignment;
    const reply = await depsOf().renderer().renderView({ raster, alignment: { alignedToOriginal, workingScale }, view });
    if (reply.kind !== 'ok') return null;
    const { blob, widthPx, heightPx } = reply.value;
    const sha256 = await depsOf().hash(await blob.arrayBuffer());
    const segments = viewSegmentsOf(run.segments, run.alignment.originalToAligned, view);
    return { view, segments, blob, previewUrl: depsOf().objectUrl.create(blob), sha256, widthPx, heightPx };
  }

  async function checkAllowance(run: PlanRecognitionRun, view: PlanReadingView): Promise<PlanReadingPreflightState> {
    const size = readingViewSize(run.alignment, view);
    const segments = viewSegmentsOf(run.segments, run.alignment.originalToAligned, view);
    try {
      const result = await depsOf().api.preflight(run.backgroundId, { image: { widthPx: size.width, heightPx: size.height }, segments });
      return { status: 'done', result };
    } catch {
      return { status: 'failed' };
    }
  }

  /** Νέα όψη από τον επεξεργαστή: το πακέτο και ο προέλεγχος παλιώνουν ⇒ σβήνονται. Όχι όσο στέλνεται. */
  function edit(view: PlanReadingView): void {
    const current = review();
    if (!current || current.send.status === 'sending') return;
    sequence += 1;
    revokePacket(current.packet);
    // Μετά από κάθε αλλαγή, πίσω στην επιλογή (Figma: ένα ορθογώνιο ανά «Προσθήκη»).
    patchReview({ view, tool: 'select', packet: null, preflight: IDLE_PREFLIGHT, send: { status: 'idle' } });
    depsOf().onViewCommitted(view, current);
  }

  /** Η απάντηση του διακομιστή ⇒ κατάσταση· η ανάγνωση μπαίνει στη σύντηξη **μόνο** με επιβεβαιωμένη παραλαβή. */
  function settle(result: PlanReadingRouteResult | null, packet: PlanReadingPacket, run: PlanRecognitionRun): T | null {
    if (result === null) {
      patchReview({ send: { status: 'failed' } });
      return null;
    }
    if (result.status === 'unavailable') {
      patchReview({ send: { status: 'unavailable', reason: result.reason } });
      return null;
    }
    if (result.imageSha256 !== packet.sha256) {
      patchReview({ send: { status: 'receipt-mismatch' } });
      return null;
    }
    const reading = planReadingFromView(result.reading, packet.view, run.alignment.alignedToOriginal, {
      model: result.model,
      schemaVersion: result.schemaVersion,
    });
    const source = depsOf().adoptReading({ status: 'read', reading });
    patchReview({ send: { status: 'read', counts: countsOf(reading), cacheHit: result.cacheHit } });
    return source;
  }

  return {
    /**
     * Άνοιγμα: η πρόταση της ευθυγράμμισης, για να τη δει και να τη διορθώσει ο άνθρωπος (Δ15 #4) — ή, αν οι τοίχοι
     * βγήκαν ήδη από όψη του ανθρώπου, **εκείνη** η όψη: ό,τι βλέπει, αυτό μετρά (§6.10 Α2).
     */
    begin(): void {
      const { run } = planRecognitionStore.get();
      if (!run) return;
      sequence += 1;
      revokePacket(review()?.packet);
      depsOf().onReviewReset();
      const proposed = proposedReadingView(run.alignment);
      planRecognitionStore.patch({
        review: {
          proposed, view: run.maskView ?? proposed, tool: 'select', packet: null, preflight: IDLE_PREFLIGHT,
          send: { status: 'idle' }, walls: WALLS_FOLLOWING,
        },
      });
    },

    edit,

    reset(): void {
      const current = review();
      if (current) edit(current.proposed);
    },

    setTool(tool: PlanReadingTool): void {
      patchReview({ tool });
    },

    /** «Προσθήκη περιοχής»: εναλλαγή· όσο στέλνεται, η όψη δεν αλλάζει. */
    toggleAddRegion(): void {
      const current = review();
      if (!current || current.send.status === 'sending') return;
      patchReview({ tool: current.tool === 'add-redaction' ? 'select' : 'add-redaction' });
    },

    /** ADR-929 §6.10 Α2 — «Αναίρεση»: η ανάγνωση που σβήστηκε επιστρέφει, μαζί με την όψη πριν την πρώτη αλλαγή. */
    undoReadingDrop(): void {
      const current = review();
      if (!current || current.send.status === 'sending') return;
      const restored = depsOf().undoReadingDrop();
      if (!restored) return;
      sequence += 1;
      revokePacket(current.packet);
      patchReview({
        view: restored.view, tool: 'select', packet: null, preflight: IDLE_PREFLIGHT, send: restored.send, walls: WALLS_FOLLOWING,
      });
    },

    /** Κλείσιμο: ακυρώνει ό,τι τρέχει και ανακαλεί τη μικρογραφία. */
    end(): void {
      sequence += 1;
      revokePacket(review()?.packet);
      depsOf().onReviewReset();
      planRecognitionStore.patch({ review: null });
    },

    /** «Έλεγχος πριν την αποστολή»: πακέτο + προέλεγχος, παράλληλα. Όχι όσο οι τοίχοι ξαναβγαίνουν (§6.10 Α2). */
    async prepare(): Promise<void> {
      const { run } = planRecognitionStore.get();
      const current = review();
      if (!run || !current || current.send.status === 'sending' || current.walls.status === 'updating') return;
      const seq = ++sequence;
      revokePacket(current.packet);
      patchReview({ packet: null, preflight: { status: 'checking' }, send: { status: 'preparing' } });
      const [packet, preflight] = await Promise.all([
        renderPacket(run, current.view).catch(() => null),
        checkAllowance(run, current.view),
      ]);
      if (!isCurrent(seq, run.id)) {
        revokePacket(packet);
        return;
      }
      patchReview({ packet, preflight, send: packet ? { status: 'idle' } : { status: 'prepare-failed' } });
    },

    /** Αποστολή **του πακέτου**. Επιστρέφει τη νέα πηγή γραμμών όταν η ανάγνωση μπήκε στη σύντηξη, αλλιώς `null`. */
    async send(): Promise<T | null> {
      const { run } = planRecognitionStore.get();
      const current = review();
      const packet = current?.packet;
      const allowed = current?.preflight.status === 'done' && current.preflight.result.status === 'allowed';
      if (!run || !current || !packet || !allowed || current.send.status === 'sending') return null;
      const seq = ++sequence;
      patchReview({ send: { status: 'sending' } });
      const result = await depsOf().api
        .read(run.backgroundId, packet.blob, { view: packet.view, segments: [...packet.segments] })
        .catch(() => null);
      return isCurrent(seq, run.id) ? settle(result, packet, run) : null;
    },
  };
}

export type PlanReadingReviewController<T> = ReturnType<typeof createPlanReadingReview<T>>;
