/**
 * ADR-743 Φ0 — το λεξιλόγιο των stages: κανένα όνομα δεν πατάει σε άλλο.
 *
 * ## Γιατί χρειάζεται φύλακας για… ονόματα
 *
 * Ο aggregator (`mouse-handler-perf`) είναι ΕΝΑ `Map<string, number[]>` για **όλα** τα υποσυστήματα.
 * Δύο stages με το ίδιο όνομα δεν σπάνε τίποτα — **συγχωνεύονται σιωπηλά** και παράγουν έναν
 * αριθμό που δεν σημαίνει τίποτα. Η attribution θα «δούλευε» και θα ήταν λάθος: ακριβώς το είδος
 * αστοχίας που το ADR-726 πλήρωσε τέσσερις φορές (μέτρησε `totalFrameTime` και το διάβασε ως
 * διάστημα καρέ — ίδια ετικέτα, άλλο μέγεθος).
 *
 * Ειδικά η σύγκρουση με το `frame:` namespace θα ήταν καταστροφική: εκεί ζει ο **παρονομαστής**
 * της attribution (`frame:dxf-canvas`). Αν ένα `dxfc:*` προσγειωνόταν στην ίδια γραμμή, θα
 * συγκρίναμε το μέρος με τον εαυτό του συν το όλον.
 */

import {
  DXF_CANVAS_STAGES,
  RASTER_STAGES,
  DXF_CANVAS_STAGE_PREFIX,
  RASTER_STAGE_PREFIX,
  COUNTER_PREFIX,
  CEILING_PROBE_FLAG,
  isCeilingProbeActive,
  rasterRebuildReasonCounter,
} from '../dxf-canvas-perf-stages';
// Εισάγεται ΕΠΙΤΗΔΕΣ το αληθινό πρόθεμα του scheduler bridge αντί για το literal 'frame:':
// αν κάποιος το μετονομάσει εκεί, ο έλεγχος πρέπει να ακολουθήσει αυτόματα, όχι να μείνει
// να φυλάει έναν αριθμό που δεν ισχύει πια.
import { FRAME_STAGE_PREFIX } from '../../../rendering/core/frame-scheduler-perf-bridge';

const ALL_STAGES: readonly string[] = [
  ...Object.values(DXF_CANVAS_STAGES),
  ...Object.values(RASTER_STAGES),
];

describe('dxf-canvas-perf-stages — το λεξιλόγιο της attribution', () => {
  it('κάθε όνομα stage είναι μοναδικό', () => {
    expect(new Set(ALL_STAGES).size).toBe(ALL_STAGES.length);
  });

  it('🔴 κανένα stage δεν εισβάλλει στο `frame:` namespace του scheduler bridge', () => {
    for (const stage of ALL_STAGES) {
      expect(stage.startsWith(FRAME_STAGE_PREFIX)).toBe(false);
    }
  });

  it('τα δύο προθέματα είναι διακριτά και κάθε stage ανήκει σε ακριβώς ένα', () => {
    expect(DXF_CANVAS_STAGE_PREFIX).not.toBe(RASTER_STAGE_PREFIX);
    for (const stage of ALL_STAGES) {
      const owners = [DXF_CANVAS_STAGE_PREFIX, RASTER_STAGE_PREFIX].filter((p) => stage.startsWith(p));
      expect(owners).toHaveLength(1);
    }
  });

  it('ΜΕΤΡΗΤΕΣ ≠ ΧΡΟΝΟΣ: κάθε μετρητής ξεκινά με `n:` και κανένα χρονικό stage δεν το κάνει', () => {
    // Η στήλη `sum` ενός μετρητή είναι πλήθος, όχι ms. Το πρόθεμα είναι η ΜΟΝΗ ένδειξη που
    // επιβιώνει σε ένα `console.table` — γι' αυτό ελέγχεται, αντί να μείνει σύμβαση σε σχόλιο.
    expect(rasterRebuildReasonCounter('idle-due', true).startsWith(COUNTER_PREFIX)).toBe(true);
    for (const stage of ALL_STAGES) {
      expect(stage.startsWith(COUNTER_PREFIX)).toBe(false);
    }
  });

  it('ο μετρητής κωδικοποιεί ΚΑΙ την αιτία ΚΑΙ την κατάσταση χειρονομίας', () => {
    expect(rasterRebuildReasonCounter('idle-due', true)).toContain('idle-due');
    expect(rasterRebuildReasonCounter('idle-due', true)).toContain('@gesture');
    expect(rasterRebuildReasonCounter('idle-due', false)).toContain('@rest');
    expect(rasterRebuildReasonCounter('idle-due', true))
      .not.toBe(rasterRebuildReasonCounter('idle-due', false));
  });
});

describe('πείραμα οροφής — το flag που παγώνει τη ζωγραφική', () => {
  afterEach(() => window.localStorage.removeItem(CEILING_PROBE_FLAG));

  it('ανενεργό εξ ορισμού — ένα ξεχασμένο flag δεν παγώνει την εφαρμογή κανενός', () => {
    expect(isCeilingProbeActive()).toBe(false);
  });

  it('ενεργό ΜΟΝΟ με ακριβώς "1" (ένα «true» ή «0» δεν το ανάβει κατά λάθος)', () => {
    window.localStorage.setItem(CEILING_PROBE_FLAG, '1');
    expect(isCeilingProbeActive()).toBe(true);
    window.localStorage.setItem(CEILING_PROBE_FLAG, 'true');
    expect(isCeilingProbeActive()).toBe(false);
    window.localStorage.setItem(CEILING_PROBE_FLAG, '0');
    expect(isCeilingProbeActive()).toBe(false);
  });

  it('διαβάζεται ανά κλήση ⇒ ανάβει/σβήνει χωρίς reload της σελίδας', () => {
    expect(isCeilingProbeActive()).toBe(false);
    window.localStorage.setItem(CEILING_PROBE_FLAG, '1');
    expect(isCeilingProbeActive()).toBe(true);
    window.localStorage.removeItem(CEILING_PROBE_FLAG);
    expect(isCeilingProbeActive()).toBe(false);
  });

  it('δεν χρησιμοποιεί το κλειδί του υπάρχοντος perf flag (δύο ανεξάρτητοι διακόπτες)', () => {
    expect(CEILING_PROBE_FLAG).not.toBe('dxf-perf-trace');
  });
});
