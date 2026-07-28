/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-726 §Φ1 + ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-726-frame-budget-instrumentation-and-attribution.md
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * Frame-scheduler perf bridge — **ΜΗΔΕΝ νέο σύστημα μετρήσεων**.
 *
 * ## Το πρόβλημα που λύνει (ADR-726 §6 Φ1)
 *
 * Ο `UnifiedFrameScheduler` **ήδη** μετράει ανά σύστημα (`lastRenderTime` / `averageRenderTime` /
 * `renderCount` / `skipCount`, `UnifiedFrameScheduler.ts:255-261`), με `collectMetrics: true` by
 * default, και τα εκθέτει στο `FrameMetrics.systemMetrics`. **Κανείς δεν τα διάβαζε** — ούτε
 * window, ούτε UI, ούτε log. Μετρούσαμε και πετούσαμε.
 *
 * Ταυτόχρονα το LoAF έδειξε ότι το rAF callback (`processFrame`) είναι το **74%** του script
 * χρόνου (3.183ms / 49s, μέσος 32,8ms — διπλάσιο του budget). Ποιο *σύστημα* μέσα του φταίει, το
 * LoAF **δομικά δεν μπορεί** να το πει: όλα τα systems καλούνται από το ίδιο σημείο του stack.
 *
 * ⇒ Αυτό το αρχείο είναι **μόνο μια γέφυρα** από τα υπάρχοντα metrics προς τον **υπάρχοντα**
 * aggregator `systems/cursor/mouse-handler-perf.ts` (`recordSample` / `snapshotPerfRows`), πίσω
 * από το **υπάρχον** flag `localStorage['dxf-perf-trace'] === '1'`. Ίδιο flag, ίδιος aggregator,
 * ίδιο `console.table`. **Κανένα νέο global, καμία νέα εξάρτηση, κανένα νέο module μετρήσεων.**
 *
 * ## Κόστος όταν το flag είναι κλειστό
 *
 * Ένα boolean call ανά καρέ ({@link isPerfEnabled}) και έξοδος — ακριβώς το ίδιο σχήμα με το
 * `withPerf`. Ο listener μένει εγγεγραμμένος ώστε το `window.__dxfPerfRefresh()` να ανάβει τη
 * μέτρηση χωρίς reload (δεν έχει νόημα να «απο-εγγράφεται» κάτι που κοστίζει μια σύγκριση).
 *
 * ## 🔴 Ο κανόνας εγκυρότητας είναι ΜΕΡΟΣ του οργάνου (ADR-726 §1.2)
 *
 * Η Phase 1 ξόδεψε τρεις διαγνώσεις για να ανακαλύψει ότι **καρέ σε κρυμμένο tab είναι άκυρα**
 * (ο Chrome παγώνει το rAF· τα «22 FPS σε ηρεμία» ήταν φάντασμα). Ο κανόνας «καμία μέτρηση χωρίς
 * `visibilityState` ανά δείγμα» είναι δεσμευτικός — γι' αυτό **επιβάλλεται εδώ, στο όργανο**, όχι
 * σε ένα σχόλιο που ο επόμενος θα προσπεράσει. Καρέ με `visibilityState !== 'visible'`
 * **απορρίπτονται πριν καταγραφούν**.
 *
 * ⚠️ Δεν καλείται `perfTick()`: ο ρυθμός αναφοράς έχει **έναν** ιδιοκτήτη, το
 * `mouse-handler-move.ts` (N.7.2 #7). Υπό ανθρώπινο pan/zoom — το μόνο έγκυρο σενάριο μέτρησης
 * (ADR-726 §3) — τα pointermove αφθονούν. On demand: `window.__dxfPerfReport()`.
 */

import { UnifiedFrameScheduler } from './UnifiedFrameScheduler';
import type { FrameMetrics } from './frame-scheduler-types';
import { isPerfEnabled, recordSample } from '../../systems/cursor/mouse-handler-perf';

/**
 * Πρόθεμα των per-system γραμμών στο κοινό `console.table`, ώστε να ξεχωρίζουν με μια ματιά από
 * τα cursor stages που ήδη ζουν στον ίδιο aggregator.
 */
export const FRAME_STAGE_PREFIX = 'frame:';

/** Η γραμμή του ΣΥΝΟΛΙΚΟΥ χρόνου του rAF callback — ο παρονομαστής κάθε attribution. */
export const FRAME_TOTAL_STAGE = `${FRAME_STAGE_PREFIX}TOTAL`;

/**
 * Καταγράφει ένα καρέ στον κοινό aggregator. Εξάγεται για να μπορεί να ελεγχθεί χωρίς rAF/DOM.
 *
 * Καταγράφονται **μόνο** τα συστήματα που πραγματικά ζωγράφισαν: ένα skipped σύστημα κοστίζει 0ms
 * και θα αραίωνε τον μέσο όρο κρύβοντας την αλήθεια. Η συχνότητα φαίνεται από τη σύγκριση του
 * `count` κάθε γραμμής με το `count` της {@link FRAME_TOTAL_STAGE}.
 */
export function recordFrameAttribution(metrics: FrameMetrics): void {
  if (!isPerfEnabled()) return;
  // ADR-726 §1.2 — δεσμευτικός κανόνας εγκυρότητας: κρυμμένο/throttled tab ⇒ το δείγμα πετιέται.
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  for (const [systemId, sample] of metrics.systemMetrics) {
    if (sample.skipped) continue;
    recordSample(`${FRAME_STAGE_PREFIX}${systemId}`, sample.renderTime);
  }
  recordSample(FRAME_TOTAL_STAGE, metrics.totalFrameTime);
}

/** Ο ένας listener στον scheduler, όσο κι αν είναι οι κάτοχοι (refcount). */
let detachListener: (() => void) | null = null;
let holders = 0;

/**
 * Συνδέει τη γέφυρα στον `UnifiedFrameScheduler` και επιστρέφει τη δική σου αποσύνδεση.
 *
 * Refcounted **και** idempotent ανά handle: διπλή κλήση της ίδιας αποσύνδεσης δεν μετράει δύο
 * φορές, και ο listener φεύγει μόνο όταν φύγει ο τελευταίος κάτοχος. Χωρίς αυτό, το διπλό
 * mount/unmount του React StrictMode (dev) θα άφηνε τη γέφυρα νεκρή μετά το πρώτο cleanup.
 */
export function installFrameSchedulerPerfBridge(): () => void {
  holders++;
  if (!detachListener) detachListener = UnifiedFrameScheduler.onFrame(recordFrameAttribution);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders--;
    if (holders === 0 && detachListener) {
      detachListener();
      detachListener = null;
    }
  };
}
