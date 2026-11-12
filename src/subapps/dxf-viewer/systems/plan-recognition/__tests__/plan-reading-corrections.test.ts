/**
 * @jest-environment node
 *
 * ⚓ ADR-929 Δ21 (δ) — ο ελεγκτής των διορθώσεων τιμών (`planRecognitionSession.corrections`):
 *   · βήμα 5: `preview` = τι θα γινόταν το κείμενο, από τον ΙΔΙΟ δρόμο με την αποθήκευση, διαβασμένο τη στιγμή της κλήσης·
 *     καμία εγγραφή, καμία σύντηξη·
 *   · `correct` ίσο με ό,τι διάβασε η μηχανή ⇒ καμία σύντηξη (ιδεμποτία, `effectiveReadingCorrection`)·
 *   · διόρθωση ⇒ ΜΙΑ σύντηξη + ΜΙΑ δημοσίευση.
 * Ψεύτικα: σύντηξη, πηγή γραμμών. Πραγματικά: store, ελεγκτής, μετατροπή κειμένων OCR → ανάγνωση, διορθώσεις.
 */

import { IDENTITY_HOMOGRAPHY, type Quad } from '@/lib/geometry/homography';
import type { PlanAlignment } from '../../../bim/plan-recognition/alignment/plan-alignment-types';
import type { PlanFusionResult } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import type { OcrText } from '../../../bim/plan-recognition/ocr/ocr-engine';
import { planReadingFromOcr } from '../../../bim/plan-recognition/ocr/ocr-reading';
import type { PlanReadingOutcome } from '../../../bim/plan-recognition/plan-recognition-types';
import type { PlanReadingCorrections } from '../../../bim/plan-recognition/reading/reading-corrections';
import type { RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import { createPlanReadingCorrectionsController } from '../plan-reading-corrections';
import { sceneTextRing } from '../plan-overlay-geometry';
import { NO_READ_REVIEW, planRecognitionStore, type PlanRecognitionRun } from '../plan-recognition-store';

const MODEL = 'local-ocr:test';
const ALIGNMENT = { alignedToOriginal: IDENTITY_HOMOGRAPHY, originalToAligned: IDENTITY_HOMOGRAPHY } as unknown as PlanAlignment;
const RUN: PlanRecognitionRun = {
  id: 'rec', floorId: 'flr', backgroundId: 'bg', kind: 'scan', alignment: ALIGNMENT, segments: [], knownScale: null,
};
const FUSION = { dimensions: [] } as unknown as PlanFusionResult;

const quad = (x: number): Quad => [{ x, y: 0 }, { x: x + 40, y: 0 }, { x: x + 40, y: 10 }, { x, y: 10 }];
const ocr = (text: string, x: number): OcrText => ({ text, recScore: 0.8, detScore: 0.8, rotation: 0, polygon: quad(x), reader: 'primary' });

/** t1 «2.05» (το σχέδιο γράφει μέτρα ⇒ οι σκέτοι ακέραιοι είναι εκατοστά) · t2 «4.15» · t3 «μ.μ». */
const READING: PlanReadingOutcome = {
  status: 'read',
  reading: planReadingFromOcr({ texts: [ocr('2.05', 0), ocr('4.15', 100), ocr('μ.μ', 200)], toOriginal: IDENTITY_HOMOGRAPHY, model: MODEL }),
};

const PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 1000, height: 800 },
  transform: { translateX: 2500, translateY: -1200, scaleX: 8.78, scaleY: 8.82, rotation: 0 },
};

function harness(placement: RasterPlacement | null = PLACEMENT) {
  const fused: PlanReadingCorrections[] = [];
  const published: string[] = [];
  const controller = createPlanReadingCorrectionsController<string>(() => ({
    fuse: (_run, _reading, corrections) => { fused.push(corrections); return FUSION; },
    lineSource: () => `src#${fused.length}`,
    publish: (source) => { published.push(source); },
    placement: (floorId) => (floorId === 'flr' ? placement : null),
  }));
  return { controller, fused, published };
}

beforeEach(() => {
  planRecognitionStore.reset();
  planRecognitionStore.patch({ phase: 'ready', run: RUN, reading: READING });
});

describe('Δ21 (δ) βήμα 5 — preview: ζωντανή ερμηνεία χωρίς εγγραφή', () => {
  it('σκέτος ακέραιος ⇒ εκατοστά, γιατί το σχέδιο γράφει μέτρα· τίποτα δεν γράφεται, καμία σύντηξη', () => {
    const h = harness();
    const before = planRecognitionStore.get();
    expect(h.controller.preview('t3', '412')).toEqual({ kind: 'dimension', valueMm: 4120 });
    expect(planRecognitionStore.get()).toBe(before);
    expect(h.fused).toEqual([]);
  });

  it('διαβάζει το store τη στιγμή της κλήσης: χωρίς ανάγνωση ⇒ null', () => {
    const h = harness();
    planRecognitionStore.patch({ reading: null });
    expect(h.controller.preview('t2', '4.12')).toBeNull();
  });

  it('λαμβάνει υπόψη τις διορθώσεις που ήδη ισχύουν (ίδιος δρόμος με την αποθήκευση)', () => {
    const h = harness();
    h.controller.markNotDimension('t1'); // χωρίς μέτρα στο σχέδιο, ο σκέτος ακέραιος δεν αποδεικνύεται
    h.controller.markNotDimension('t2');
    expect(h.controller.preview('t3', '412')).toEqual({ kind: 'dimension', valueMm: null });
  });
});

describe('Δ21 (δ) — commit με τον κοινό κανόνα «ίδιο με τη μηχανή ⇒ επαναφορά»', () => {
  it('διόρθωση ίση με ό,τι διάβασε η μηχανή ⇒ καμία σύντηξη, καμία δημοσίευση', () => {
    const h = harness();
    expect(h.controller.correct('t2', ' 4.15 ')).toBe(true);
    expect(h.fused).toEqual([]);
    expect(h.published).toEqual([]);
  });

  it('διόρθωση ⇒ ΜΙΑ σύντηξη + ΜΙΑ δημοσίευση· ίδια διόρθωση ξανά ⇒ τίποτα', () => {
    const h = harness();
    h.controller.correct('t2', '4.12');
    h.controller.correct('t2', '4.12');
    expect(h.fused).toHaveLength(1);
    expect(h.published).toEqual(['src#1']);
    expect(planRecognitionStore.get().readingCorrections.byTextId).toEqual({ t2: { kind: 'value', raw: '4.12' } });
  });
});

describe('Δ21 (δ) βήμα 3 — confirm', () => {
  it('«Σωστό ✓» ⇒ ΜΙΑ σύντηξη· ξανά ⇒ τίποτα· επαναφορά ⇒ ξανά η μηχανή', () => {
    const h = harness();
    h.controller.confirm('t2');
    h.controller.confirm('t2');
    expect(h.fused).toHaveLength(1);
    expect(planRecognitionStore.get().readingCorrections.byTextId).toEqual({ t2: { kind: 'confirmed' } });
    h.controller.revert('t2');
    expect(planRecognitionStore.get().readingCorrections.byTextId).toEqual({});
    expect(h.fused).toHaveLength(2);
  });
});

describe('Δ21 (δ) βήμα 2 — focusTarget: «Εστίαση στην πηγή»', () => {
  it('το πλαίσιο του κειμένου στη σκηνή από την ΙΔΙΑ αντιστοίχιση με την επισήμανση· πρώτο άλμα πλαισιώνει, επόμενο κεντράρει', () => {
    const h = harness();
    const t2 = READING.status === 'read' ? READING.reading.texts[1] : null;
    expect(h.controller.focusTarget('t2')).toEqual({ points: sceneTextRing(t2!.rect, PLACEMENT), preserveZoom: false });
    expect(planRecognitionStore.get().readFocusTextId).toBe('t2');
    expect(h.controller.focusTarget('t1')?.preserveZoom).toBe(true);
    expect(h.fused).toEqual([]);
  });

  it('νέα ανάγνωση/αναγνώριση (NO_READ_REVIEW) ⇒ το επόμενο άλμα είναι ξανά «πρώτο»', () => {
    const h = harness();
    h.controller.focusTarget('t2');
    planRecognitionStore.patch({ ...NO_READ_REVIEW });
    expect(h.controller.focusTarget('t2')?.preserveZoom).toBe(false);
  });

  it('άγνωστο κείμενο ή χωρίς υπόβαθρο ⇒ null, και τίποτα δεν θυμάται', () => {
    expect(harness().controller.focusTarget('t99')).toBeNull();
    expect(harness(null).controller.focusTarget('t2')).toBeNull();
    expect(planRecognitionStore.get().readFocusTextId).toBeNull();
  });
});
