/**
 * @fileoverview **Η ΡΟΗ ΠΛΑΚΙΔΙΩΝ** — ποια πλακίδια χρειάζεται τώρα ο επισκέπτης, με ποια σειρά, και τι φεύγει από την ουρά
 * όταν στρίψει/μεγεθύνει/προχωρήσει (ADR-884 Φ2ε · §4.11). Όχι React: συνδρομή στη θέαση, υπολογισμός μία φορά ανά
 * αλλαγή, παράδοση στη μηχανή.
 * @related `lib/spatial-tour/viewer/tour-tile-visibility.ts` (τι φαίνεται — καθαρό) · `lib/async/priority-task-queue.ts`
 *   (η ουρά) · `tour-panorama-source.ts` (από πού) · `tour-panorama-engine.ts` (`putTile` — αγνοεί ξένη στάση)
 * @module components/spatial-tour/viewer/tour-tile-streamer
 *
 * 🏆 **Όπως οι μεγάλοι** (Marzipano · PSV · krpano): μόνο τα ορατά, το κεντρικό πρώτο, επίπεδο κατά πυκνότητα οθόνης·
 *   ό,τι βγήκε από το κάδρο πριν ξεκινήσει, **φεύγει** από την ουρά.
 * 🏆 **Πιο έξυπνο από τους μεγάλους**: η Matterport προφορτώνει γειτονικά πανοράματα **ολόκληρα**. Εδώ η θέαση άφιξης
 *   είναι **γνωστή πριν το κλικ** (`planTransition(...).arrivalYaw`) ⇒ `prefetch` ζητά **ακριβώς** τα πλακίδια που θα φανούν
 *   στην άφιξη, και `prefetchBase` τη βάση (ένα αίτημα) κάθε γείτονα — η μετάβαση ξεκινά πάντα με εικόνα.
 * 🔑 **Κανένας καταναλωτής δεν περιμένει πλακίδιο**: η άφιξη περιμένει μόνο τη βάση (M12)· πλακίδιο που αποτυγχάνει
 *   αφήνει τη βάση από κάτω (M13/M14)· πλακίδιο στάσης που έφυγε το αγνοεί η μηχανή (M11).
 */

import { createPriorityTaskQueue, isTaskCancelled, type PriorityTaskQueue } from '@/lib/async/priority-task-queue';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import {
  chooseTileLevel, type TourTileAddress, type TourTileFrame, type TourTileNeed, visibleTiles,
} from '@/lib/spatial-tour/viewer/tour-tile-visibility';

import type { TourCameraStore } from './tour-camera-store';
import type { TourPanoramaEngine } from './tour-panorama-engine';
import type { TourPanoramaSource } from './tour-panorama-source';

/**
 * Πόσα αιτήματα πλακιδίων ταυτόχρονα: 6 = ό,τι ανοίγει ο browser ανά προέλευση σε HTTP/1.1 (localhost)· σε HTTP/2-3
 * (παραγωγή, `Alt-Svc: h3`) κρατά την ουρά **αναδιατάξιμη** — ό,τι δεν ξεκίνησε μπορεί ακόμη να αλλάξει σειρά ή να φύγει.
 */
export const TILE_CONCURRENCY = 6;

/** Προτεραιότητα προφόρτωσης: πάντα πίσω από κάθε πλακίδιο του κάδρου (η γωνία + περιθώριο είναι < 4π). */
const PREFETCH_PRIORITY_OFFSET = 100;
const BASE_PREFETCH_PRIORITY = 200;

/** Η ταυτότητα μιας στάσης για τη μηχανή — η λήψη (ένα tileset, μία εικόνα). */
export const tourStopKey = (stop: TourManifestStop): string => stop.captureId;

/** Κλειδί πλακιδίου **μέσα** σε έναν κύβο (η μηχανή ξέρει ήδη τη στάση). */
const tileKeyOf = (a: TourTileAddress) => `${a.level}/${a.face}/${a.row}/${a.col}`;
/** Κλειδί εργασίας στην ουρά — **με** τη στάση: το ίδιο πλακίδιο δύο στάσεων είναι δύο λήψεις (ιδεμποτία ανά στάση). */
const taskKeyOf = (stop: TourManifestStop, a: TourTileAddress) => `${tourStopKey(stop)}:${tileKeyOf(a)}`;

export interface TourTileStreamer {
  /** Τα πλακίδια ποιας στάσης ακολουθούν τη θέαση — `null` = καμίας (π.χ. στη μέση μετάβασης). */
  focus(stop: TourManifestStop | null): void;
  /** Ζέσταμα της κρυφής μνήμης με τα πλακίδια που θα φανούν σε **αυτή** τη θέαση της στάσης (χαμηλή προτεραιότητα). */
  prefetch(stop: TourManifestStop, frame: TourTileFrame): void;
  /** Ζέσταμα της βάσης γειτονικών στάσεων (ένα αίτημα η καθεμία). */
  prefetchBase(stops: readonly TourManifestStop[]): void;
  dispose(): void;
}

interface StreamerDeps {
  readonly engine: TourPanoramaEngine;
  readonly camera: TourCameraStore;
  readonly source: TourPanoramaSource;
  readonly queue?: PriorityTaskQueue;
}

/**
 * Ένα πλακίδιο που δεν ήρθε **δεν** είναι βλάβη του θεατή: η βάση μένει από κάτω (M13/M14). Η ακύρωση είναι κανονική ροή.
 */
const tileFailureIsNotFatal = (): undefined => undefined;

/** Οι ανάγκες μιας θέασης για μια στάση: επίπεδο κατά πυκνότητα, μετά τα ορατά του επιπέδου. */
function needsFor(deps: StreamerDeps, stop: TourManifestStop, frame: TourTileFrame): { readonly needs: TourTileNeed[]; readonly levelSize: number } | null {
  const levels = deps.source.tiles?.levels(stop) ?? [];
  if (levels.length === 0) return null;
  const level = chooseTileLevel(levels, deps.engine.viewportHeightDevicePx(), frame.view.fov);
  return { needs: visibleTiles(frame, levels[level], level), levelSize: levels[level] };
}

export function createTourTileStreamer(deps: StreamerDeps): TourTileStreamer {
  const { engine, camera, source } = deps;
  const queue = deps.queue ?? createPriorityTaskQueue(TILE_CONCURRENCY);
  let focused: TourManifestStop | null = null;
  let prefetchGroup: string | null = null;
  let pending = false;
  /** Πλακίδια που απέτυχαν (μετά τις επαναλήψεις του `fetchTileBlob`) — δεν ξαναζητούνται σε κάθε κίνηση της κάμερας. */
  const failed = new Set<string>();

  function stream(): void {
    pending = false;
    const tiles = source.tiles;
    if (focused === null || tiles === null) return;
    const stop = focused;
    const stopKey = tourStopKey(stop);
    const group = `tiles:${stopKey}`;
    const state = camera.get();
    const plan = needsFor(deps, stop, { view: state.view, aspect: state.aspect });
    if (plan === null) return;
    const keep = new Set<string>();
    for (const need of plan.needs) {
      const tileKey = tileKeyOf(need);
      const taskKey = taskKeyOf(stop, need);
      keep.add(taskKey);
      if (engine.hasTile(stopKey, tileKey) || failed.has(taskKey)) continue;
      queue.reprioritize(taskKey, need.priority);
      queue.schedule(taskKey, { priority: need.priority, group }, (signal) => tiles.tile(stop, need, signal)).then(
        (image) => engine.putTile(stopKey, tileKey, need, plan.levelSize, image),
        (error: unknown) => { if (!isTaskCancelled(error)) failed.add(taskKey); },
      );
    }
    queue.retainOnly(group, keep);
  }

  /** Μία φορά ανά «κύμα» αλλαγών: δέκα γεγονότα θέασης στο ίδιο task ⇒ ένας υπολογισμός. */
  function schedule(): void {
    if (pending) return;
    pending = true;
    queueMicrotask(stream);
  }

  const unsubscribe = camera.subscribe(schedule);

  return {
    focus(stop) {
      if (focused !== null && (stop === null || tourStopKey(stop) !== tourStopKey(focused))) queue.cancelGroup(`tiles:${tourStopKey(focused)}`);
      if (stop === null || focused === null || tourStopKey(stop) !== tourStopKey(focused)) failed.clear();
      focused = stop;
      schedule();
    },
    prefetch(stop, frame) {
      const tiles = source.tiles;
      if (tiles === null) return;
      if (prefetchGroup !== null) queue.cancelGroup(prefetchGroup);
      const group = `prefetch:${tourStopKey(stop)}`;
      prefetchGroup = group;
      const plan = needsFor(deps, stop, frame);
      for (const need of plan?.needs ?? []) {
        queue.schedule(taskKeyOf(stop, need), { priority: PREFETCH_PRIORITY_OFFSET + need.priority, group }, (signal) => tiles.tile(stop, need, signal))
          .catch(tileFailureIsNotFatal);
      }
    },
    prefetchBase(stops) {
      for (const stop of stops) {
        queue.schedule(`base:${tourStopKey(stop)}`, { priority: BASE_PREFETCH_PRIORITY, group: 'prefetch-base' }, (signal) => source.base(stop, signal))
          .catch(tileFailureIsNotFatal);
      }
    },
    dispose() {
      unsubscribe();
      if (focused !== null) queue.cancelGroup(`tiles:${tourStopKey(focused)}`);
      if (prefetchGroup !== null) queue.cancelGroup(prefetchGroup);
      queue.cancelGroup('prefetch-base');
      focused = null;
    },
  };
}
