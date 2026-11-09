/**
 * ADR-929 §6.10 Α2 — η όψη του ανθρώπου (crop + περιοχές απόκρυψης) μετρά **και** στην εξαγωγή τμημάτων:
 *   · χωρίς μάσκα ⇒ ακριβώς η πρόταση της ευθυγράμμισης (ίδια τμήματα, ίδια ids)·
 *   · η μάσκα **αφαιρεί μελάνι**, δεν αλλάζει κατώφλια (`minLengthPx` της περιοχής σχεδίου)·
 *   · ο Worker δεν κρατά κατάσταση: η ερώτηση `segments` φέρνει **αντίγραφο** της μάσκας μελανιού.
 * Αλήθεια: οι συνθετικοί τοίχοι, και η ίδια η εξαγωγή χωρίς μάσκα (ποτέ δικός της αριθμός).
 */

import { describe, expect, it, jest } from '@jest/globals';
import { applyHomography } from '@/lib/geometry/homography';
import { alignPlan } from '../alignment/align-plan';
import { createPlanAligner } from '../alignment/plan-align-client';
import {
  handlePlanSegments,
  handlePlanWorker,
  planAlignRequestTransfer,
  planWorkerReplyTransfer,
  type PlanSegmentsMessage,
  type PlanWorkerMessage,
  type PlanWorkerReply,
} from '../alignment/plan-align-host';
import type { AlignedRectPx, PlanAlignment } from '../alignment/plan-alignment-types';
import type { RasterSegment } from '../plan-recognition-types';
import {
  DEFAULT_PLAN_SEGMENTS,
  extractPlanSegments,
  minFillPxFor,
  type PlanInkMask,
} from '../segments/plan-segments';
import { renderSyntheticPlan, SAMPLE_HOUSE_WALLS, type SyntheticPlanSpec } from '../testing/synthetic-plan-raster';

const SPEC: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS, pxPerMm: 0.06, marginMm: 600, wallStyle: 'outlined', strokePx: 2, rotationDeg: 0, degradation: null,
};
const SCALE = { metresPerPixelX: 0.001 / SPEC.pxPerMm, metresPerPixelY: 0.001 / SPEC.pxPerMm, source: 'gallery-scale' as const };

const alignment: PlanAlignment = alignPlan(renderSyntheticPlan(SPEC).image, { deskew: false });
const OPTIONS = { ...DEFAULT_PLAN_SEGMENTS, minFillPx: minFillPxFor(alignment, SCALE) };
const FULL: AlignedRectPx = { minX: 0, minY: 0, maxX: alignment.image.width, maxY: alignment.image.height };
const baseline = extractPlanSegments(alignment, OPTIONS);

/** Το μέσο ενός τμήματος στα px της ευθυγραμμισμένης εικόνας. */
function alignedMid(s: RasterSegment): { x: number; y: number } {
  const a = applyHomography(alignment.originalToAligned, s.start.x, s.start.y);
  const b = applyHomography(alignment.originalToAligned, s.end.x, s.end.y);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const inside = (p: { x: number; y: number }, r: AlignedRectPx): boolean =>
  p.x >= r.minX && p.x < r.maxX && p.y >= r.minY && p.y < r.maxY;

/** Το μέσο οριζόντιο σημείο ανάμεσα στους δύο πιο απομακρυσμένους κατακόρυφους τοίχους: χωρίζει το σπίτι στα δύο. */
function splitX(): number {
  const xs = baseline.segments.map((s) => alignedMid(s).x);
  return Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
}

describe('ADR-929 §6.10 Α2 — μάσκα στην εξαγωγή τμημάτων', () => {
  it('το δείγμα έχει τμήματα και καμία πινακίδα (αλλιώς τα παρακάτω δεν λένε τίποτα)', () => {
    expect(baseline.segments.length).toBeGreaterThan(4);
    expect(alignment.sheet?.annotations ?? []).toHaveLength(0);
  });

  it('χωρίς μάσκα = η μάσκα της πρότασης, ρητά: ίδια τμήματα, ίδια ids, ίδιοι ρόλοι', () => {
    const proposal: PlanInkMask = { region: alignment.sheet?.drawing.aligned ?? FULL, excluded: [] };
    expect(extractPlanSegments(alignment, OPTIONS, proposal)).toEqual(baseline);
    expect(extractPlanSegments(alignment, OPTIONS, null)).toEqual(baseline);
  });

  it('crop: μένουν ΜΟΝΟ τμήματα μέσα στο crop, και λιγότερα από πριν', () => {
    const region: AlignedRectPx = { ...FULL, maxX: splitX() };
    const masked = extractPlanSegments(alignment, OPTIONS, { region, excluded: [] });
    expect(masked.segments.length).toBeGreaterThan(0);
    expect(masked.segments.length).toBeLessThan(baseline.segments.length);
    for (const s of masked.segments) {
      expect(applyHomography(alignment.originalToAligned, s.start.x, s.start.y).x).toBeLessThanOrEqual(region.maxX);
      expect(applyHomography(alignment.originalToAligned, s.end.x, s.end.y).x).toBeLessThanOrEqual(region.maxX);
    }
  });

  it('περιοχή απόκρυψης: κανένα τμήμα δεν βγαίνει μέσα της· έξω της, ό,τι υπήρχε και πριν μακριά από το όριο', () => {
    const hidden: AlignedRectPx = { ...FULL, minX: splitX() };
    const masked = extractPlanSegments(alignment, OPTIONS, { region: FULL, excluded: [hidden] });
    expect(masked.segments.length).toBeGreaterThan(0);
    for (const s of masked.segments) expect(inside(alignedMid(s), hidden)).toBe(false);
    // Τμήματα ολόκληρα μακριά από την περιοχή: το μελάνι τους δεν αγγίχτηκε ⇒ βγαίνουν ξανά, στο ίδιο σημείο.
    const maxX = (s: RasterSegment): number => Math.max(
      applyHomography(alignment.originalToAligned, s.start.x, s.start.y).x,
      applyHomography(alignment.originalToAligned, s.end.x, s.end.y).x,
    );
    const untouched = baseline.segments.filter((s) => maxX(s) < hidden.minX - 20);
    expect(untouched.length).toBeGreaterThan(0);
    const keptMids = masked.segments.map(alignedMid);
    for (const s of untouched) {
      const m = alignedMid(s);
      expect(keptMids.some((k) => Math.hypot(k.x - m.x, k.y - m.y) < 1)).toBe(true);
    }
  });

  it('απόκρυψη ΟΛΗΣ της περιοχής ⇒ μηδέν τμήματα, και το κατώφλι μήκους ΔΕΝ αλλάζει', () => {
    const masked = extractPlanSegments(alignment, OPTIONS, { region: FULL, excluded: [FULL] });
    expect(masked.segments).toEqual([]);
    expect(masked.minLengthPx).toBe(baseline.minLengthPx);
    const small = extractPlanSegments(alignment, OPTIONS, { region: { minX: 0, minY: 0, maxX: 120, maxY: 120 }, excluded: [] });
    expect(small.minLengthPx).toBe(baseline.minLengthPx);
  });

  it('το κατώφλι μήκους έρχεται ΠΑΝΤΑ από την περιοχή σχεδίου, όχι από τη μάσκα (εικόνα αρκετά μεγάλη για να διαφέρουν)', () => {
    // 3000 px ⇒ autoMinLength = 18· ένα crop 300 px θα έδινε το κάτω όριο 8. Κενό μελάνι: φτάνει μέχρι το κατώφλι.
    const big = { image: { width: 3000, height: 3000 }, ink: new Uint8Array(3000 * 3000), sheet: null,
      alignedToOriginal: alignment.alignedToOriginal, originalToAligned: alignment.originalToAligned };
    const unmasked = extractPlanSegments(big, OPTIONS);
    const masked = extractPlanSegments(big, OPTIONS, { region: { minX: 0, minY: 0, maxX: 300, maxY: 300 }, excluded: [] });
    expect(unmasked.minLengthPx).toBe(18);
    expect(masked.minLengthPx).toBe(unmasked.minLengthPx);
  });

  it('όρια έξω από την εικόνα ή αναποδογυρισμένα: κανένα σφάλμα, κανένα μελάνι εκτός εικόνας', () => {
    const huge: AlignedRectPx = { minX: -50, minY: -50, maxX: FULL.maxX + 50, maxY: FULL.maxY + 50 };
    expect(extractPlanSegments(alignment, OPTIONS, { region: huge, excluded: [] })).toEqual(baseline);
    const empty = extractPlanSegments(alignment, OPTIONS, { region: { minX: 100, minY: 0, maxX: 50, maxY: 50 }, excluded: [] });
    expect(empty.segments).toEqual([]);
  });

  it('η εξαγωγή διαβάζει ΜΟΝΟ τις διαστάσεις της εικόνας: χωρίς pixel δίνει τα ίδια', () => {
    const { image, ink, sheet, alignedToOriginal, originalToAligned } = alignment;
    const source = { image: { width: image.width, height: image.height }, ink, sheet, alignedToOriginal, originalToAligned };
    expect(extractPlanSegments(source, OPTIONS)).toEqual(baseline);
  });
});

describe('ADR-929 §6.10 Α2 — η ερώτηση `segments` στον Worker (χωρίς κατάσταση)', () => {
  const MASK: PlanInkMask = { region: FULL, excluded: [{ ...FULL, minX: splitX() }] };

  function message(): PlanSegmentsMessage {
    const { image, ink, sheet, alignedToOriginal, originalToAligned, workingScale } = alignment;
    return {
      kind: 'segments',
      source: { image: { width: image.width, height: image.height }, ink: ink.slice(), sheet, alignedToOriginal, originalToAligned, workingScale },
      mask: MASK,
      request: { scale: SCALE },
    };
  }

  it('ό,τι και η άμεση κλήση, με το όριο γεμίσματος από την κλίμακα (SSoT)· ο χειριστής του Worker τη δρομολογεί', async () => {
    const direct = extractPlanSegments(alignment, OPTIONS, MASK);
    expect(handlePlanSegments(message()).extraction).toEqual(direct);
    expect(await handlePlanWorker(message())).toEqual({ extraction: direct });
  });

  it('μετακομίζει το αντίγραφο της μάσκας μελανιού· η απάντηση δεν μεταφέρει κανένα buffer', () => {
    const msg = message();
    expect(planAlignRequestTransfer(msg)).toEqual([msg.source.ink.buffer]);
    expect(planWorkerReplyTransfer(handlePlanSegments(msg))).toEqual([]);
  });

  it('ο πελάτης στέλνει ΑΝΤΙΓΡΑΦΟ: η μάσκα του store μένει ακέραιη, το αποτέλεσμα ίδιο', async () => {
    const seen: PlanWorkerMessage[] = [];
    const fallback = jest.fn(async (m: PlanWorkerMessage): Promise<PlanWorkerReply> => { seen.push(m); return handlePlanWorker(m); });
    const aligner = createPlanAligner({ spawn: () => null, fallback });
    const before = Array.from(alignment.ink);
    const { kind: _kind, ...request } = message();
    const reply = await aligner.extractSegments({ ...request, source: { ...request.source, ink: alignment.ink } });
    aligner.dispose();
    expect(reply.kind).toBe('ok');
    if (reply.kind === 'ok') expect(reply.value.extraction).toEqual(extractPlanSegments(alignment, OPTIONS, MASK));
    const sent = seen[0];
    expect(sent.kind).toBe('segments');
    if (sent.kind === 'segments') expect(sent.source.ink).not.toBe(alignment.ink);
    expect(Array.from(alignment.ink)).toEqual(before);
  });

  it('απάντηση άλλου είδους ⇒ σφάλμα πρωτοκόλλου, ποτέ σιωπή', async () => {
    const aligner = createPlanAligner({ spawn: () => null, fallback: async () => ({ blob: new Blob([]), widthPx: 1, heightPx: 1 }) });
    const { kind: _kind, ...request } = message();
    expect(await aligner.extractSegments(request)).toEqual({ kind: 'failed', error: 'plan-worker-reply-mismatch' });
    aligner.dispose();
  });
});
