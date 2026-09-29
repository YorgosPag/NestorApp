/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΝΙΧΝΕΥΣΗ ΣΕ ΜΕΤΡΑ, ΠΙΣΩ ΑΠΟ ΤΟ RPC** (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14 · §12 Δ8.1–Δ8.2).
 *
 * - **Μ** — μέτρα ⇄ pixel παραγώγου: η κλίμακα είναι του ΠΡΩΤΟΤΥΠΟΥ (σφάλμα (ε) της Β1, 17%) · κορυφές στο χιλιοστό · y βορράς.
 * - **Φ** — host: ΜΙΑ αποκωδικοποίηση ανά κάτοψη (και σε ταυτόχρονες) · αποτυχία ⇒ ξαναδοκιμή · νέα κάτοψη ⇒ νέα.
 * - **Π** — ο πελάτης χωρίς Worker πέφτει στον ΙΔΙΟ host (δίχτυ) · λάθος είδος απάντησης ⇒ failed.
 */

import { pointInPolygon } from '@/lib/geometry/planar-polygon';

import { createSpaceDetector } from '../space-detect-client';
import { createSpaceDetectHost, type SpaceDetectReply } from '../space-detect-host';
import { detectPlanSpace, rasterMetresPerPixel, type PlanDetectRequest, type PlanDetectResult } from '../space-detect-plan';
import { prepareSpaceRaster } from '../space-detect';
import type { PlanRaster } from '../space-detect-types';
import { FIXTURE_MPP, LEFT_ROOM_AREA_M2, twoRoomPlan } from './plan-fixture';

type Found = Extract<PlanDetectResult, { ok: true }>;

/** Το ΠΡΩΤΟΤΥΠΟ είναι `ratio` φορές πλατύτερο από το παράγωγο που αναλύεται (1200/1024 στο περιστατικό της Β1). */
function request(raster: PlanRaster, seedImageM: [number, number], ratio: number, extra: Partial<PlanDetectRequest> = {}): PlanDetectRequest {
  const [x, y] = seedImageM;
  return {
    seed: { x, y: -y }, otherStops: [], separations: [],
    metresPerPixel: FIXTURE_MPP / ratio, imageWidth: raster.width * ratio, ...extra,
  };
}

function found(result: PlanDetectResult): Found {
  if (!result.ok) throw new Error(`αναμενόταν χώρος, ήρθε «${result.refusal}»`);
  return result;
}

const areaOf = (outline: readonly { x: number; y: number }[]) =>
  Math.abs(outline.reduce((sum, p, i) => { const q = outline[(i + 1) % outline.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;

describe('Μ — μέτρα κάτοψης ⇄ pixel παραγώγου', () => {
  it.each([1, 1200 / 1024, 2])('πρωτότυπο ×%p του παραγώγου ⇒ ΙΔΙΟ δωμάτιο σε μέτρα (±1%), όχι ×ratio²', (ratio) => {
    const plan = twoRoomPlan(0.9);
    const r = found(detectPlanSpace(prepareSpaceRaster(plan.raster), request(plan.raster, [2, 4], ratio)));
    expect(r.areaM2).toBeGreaterThan(LEFT_ROOM_AREA_M2 * 0.99);
    expect(r.areaM2).toBeLessThan(LEFT_ROOM_AREA_M2 * 1.01);
    expect(areaOf(r.outline)).toBeCloseTo(r.areaM2, 1);
  });

  it('το περίγραμμα είναι σε μέτρα ΚΑΤΟΨΗΣ (y βορράς = αρνητικό κάτω) και περιέχει το σημείο — κορυφές στο χιλιοστό', () => {
    // Κλίμακα που ΔΕΝ συμπίπτει με το χιλιοστό (0,01563 m/pixel · Β1: 0,015596): με 0,02 ή 0,0156 οι γωνίες (πολλαπλάσια 5 pixel) θα έπεφταν ήδη σε ακέραια χιλιοστά και θα έκρυβαν
    // τη στρογγύλευση (η μετάλλαξη «χωρίς χιλιοστό» επέζησε με αυτήν).
    const plan = twoRoomPlan(0.9);
    const k = 0.01563 / FIXTURE_MPP;
    const r = found(detectPlanSpace(prepareSpaceRaster(plan.raster),
      request(plan.raster, [2, 4], 1, { metresPerPixel: 0.01563, seed: { x: 2 * k, y: -4 * k } })));
    expect(pointInPolygon({ x: 2 * k, y: -4 * k }, r.outline)).toBe(true);
    expect(pointInPolygon({ x: 6 * k, y: -4 * k }, r.outline)).toBe(false);
    const onMm = (v: number) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6;
    expect(r.outline.every((p) => p.y <= 0 && onMm(p.x) && onMm(p.y))).toBe(true);
  });

  it('Δ8.2 — ενιαίος χώρος με δύο σημεία ⇒ πρόταση γραμμής σε ΜΕΤΡΑ, άνοιγμα ≈ 2 m στο x ≈ 4,5', () => {
    const plan = twoRoomPlan(2.0);
    const r = found(detectPlanSpace(prepareSpaceRaster(plan.raster), request(plan.raster, [2, 4], 2, { otherStops: [{ x: 6.5, y: -4 }] })));
    expect(r.separation).not.toBeNull();
    expect(r.separation?.widthM).toBeGreaterThan(1.8);
    expect(r.separation?.widthM).toBeLessThan(2.3);
    expect(Math.abs((r.separation?.segment.a.x ?? 0) - 4.5)).toBeLessThan(0.2);
    expect(r.separation?.otherStopIndex).toBe(0);
  });

  it('η νοητή γραμμή (σε μέτρα) χωρίζει τον ενιαίο χώρο · ρυθμιστικό πόρτας 2,5 m σφραγίζει το άνοιγμα των 2 m', () => {
    const plan = twoRoomPlan(2.0);
    const prepared = prepareSpaceRaster(plan.raster);
    const joined = found(detectPlanSpace(prepared, request(plan.raster, [2, 4], 2)));
    const split = found(detectPlanSpace(prepared, request(plan.raster, [2, 4], 2, { separations: [{ a: { x: 4.5, y: -2 }, b: { x: 4.5, y: -4 } }] })));
    const door = found(detectPlanSpace(prepared, request(plan.raster, [2, 4], 2, { doorWidthM: 2.5 })));
    expect(joined.areaM2).toBeGreaterThan(LEFT_ROOM_AREA_M2 * 1.5);
    expect(split.areaM2).toBeLessThan(LEFT_ROOM_AREA_M2 * 1.02);
    expect(door.areaM2).toBeLessThan(LEFT_ROOM_AREA_M2 * 1.02);
  });

  it('αρνήσεις με όνομα: σημείο έξω από την εικόνα · χωρίς κλίμακα · πλάτος παραγώγου 0 ⇒ NaN', () => {
    const plan = twoRoomPlan(0.9);
    const prepared = prepareSpaceRaster(plan.raster);
    expect(detectPlanSpace(prepared, request(plan.raster, [20, 4], 1))).toEqual({ ok: false, refusal: 'seed-outside' });
    expect(detectPlanSpace(prepared, request(plan.raster, [2, 4], 1, { metresPerPixel: 0 }))).toEqual({ ok: false, refusal: 'uncalibrated' });
    expect(rasterMetresPerPixel(0.01, 1000, 0)).toBeNaN();
    expect(rasterMetresPerPixel(0.01, 2048, 1024)).toBeCloseTo(0.02, 12);
  });
});

describe('Φ — ο host: μία κάτοψη στη μνήμη', () => {
  const plan = twoRoomPlan(0.9);
  const ask = request(plan.raster, [2, 4], 1);

  it('φόρτωση + δύο ανιχνεύσεις, και ΤΑΥΤΟΧΡΟΝΑ ⇒ μία αποκωδικοποίηση', async () => {
    const decode = jest.fn(async () => plan.raster);
    const host = createSpaceDetectHost(decode);
    const [loaded, first] = await Promise.all([host({ kind: 'load', url: 'u1' }), host({ kind: 'detect', url: 'u1', request: ask })]);
    await host({ kind: 'detect', url: 'u1', request: ask });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual({ kind: 'loaded', width: plan.raster.width, height: plan.raster.height });
    expect(first).toMatchObject({ kind: 'detected', result: { ok: true } });
  });

  it('αποτυχία λήψης ⇒ πετά (ο πελάτης: failed) και η ΕΠΟΜΕΝΗ ξαναδοκιμάζει · νέα κάτοψη ⇒ νέα αποκωδικοποίηση', async () => {
    const decode = jest.fn<Promise<PlanRaster>, [string]>()
      .mockRejectedValueOnce(new Error('image-pixels-http-503'))
      .mockResolvedValue(plan.raster);
    const host = createSpaceDetectHost(decode);
    await expect(host({ kind: 'load', url: 'u1' })).rejects.toThrow('image-pixels-http-503');
    await expect(host({ kind: 'load', url: 'u1' })).resolves.toMatchObject({ kind: 'loaded' });
    await host({ kind: 'load', url: 'u2' });
    expect(decode.mock.calls.map(([url]) => url)).toEqual(['u1', 'u1', 'u2']);
  });
});

describe('Π — ο πελάτης του επεξεργαστή', () => {
  const plan = twoRoomPlan(0.9);
  const ask = request(plan.raster, [2, 4], 1);

  it('χωρίς Worker ⇒ ο ΙΔΙΟΣ host στον κύριο νήμα (δίχτυ): φόρτωση και ανίχνευση', async () => {
    const detector = createSpaceDetector({ spawn: () => null, fallback: createSpaceDetectHost(async () => plan.raster) });
    await expect(detector.load('u1')).resolves.toEqual({ kind: 'ok', value: { width: plan.raster.width, height: plan.raster.height } });
    const result = await detector.detect('u1', ask);
    expect(result.kind === 'ok' && result.value.ok).toBe(true);
  });

  it('λάθος είδος απάντησης ⇒ failed (βλάβη συμβολαίου, ποτέ σιωπηλή) · σφάλμα λήψης ⇒ failed', async () => {
    const wrong = createSpaceDetector({ spawn: () => null, fallback: async (): Promise<SpaceDetectReply> => ({ kind: 'loaded', width: 1, height: 1 }) });
    await expect(wrong.detect('u1', ask)).resolves.toEqual({ kind: 'failed', error: 'space-detect-unexpected-loaded' });
    const broken = createSpaceDetector({ spawn: () => null, fallback: createSpaceDetectHost(async () => { throw new Error('image-pixels-http-404'); }) });
    await expect(broken.load('u1')).resolves.toEqual({ kind: 'failed', error: 'image-pixels-http-404' });
  });
});
