/**
 * @jest-environment node
 *
 * ADR-920 Β4.8 5γ — the owner's terrain preview behind the Worker RPC.
 *
 *   Π   packing: lossless both ways, a planimetric point stays planimetric (never z = 0, ADR-720), ΕΓΣΑ mm exact
 *   Η   host: the reply IS `prepareSurveyUpload` + `terrainMapModelOf` (the door's verdict) · same key ⇒ no re-triangulation
 *       (a resize re-draws only the map) · same key + width ⇒ the same reply · a refusal has no map
 *   Κ   client over a FakeWorker (real structured clone): ok · the points' buffer MOVES · latest-only · no Worker ⇒ the
 *       SAME handler on the main thread · warm-up spawns once
 */

import { FakeWorker } from '@/lib/workers/__tests__/fake-worker';

import { terrainMapModelOf } from '../../publication/terrain-map-model';
import type { TopoPoint } from '../../terrain-types';
import { createSurveyPreviewer } from '../survey-preview-client';
import { createSurveyPreviewHost, type SurveyPreviewReply, type SurveyPreviewRequest } from '../survey-preview-host';
import { packSurveyPoints, unpackSurveyPoints } from '../survey-preview-points';
import { prepareSurveyUpload } from '../survey-upload-preparation';

/** A 4 × 4 grid every 5 m in ΕΓΣΑ'87 (WORLD mm), a gentle hill — and one corner surveyed for position only. */
function hill(): TopoPoint[] {
  const points: TopoPoint[] = [];
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      points.push({ x: 401_250_000 + i * 5_000, y: 4_190_120_000 + j * 5_000, z: 50_000 + (i * j % 3) * 400 + i * 250 });
    }
  }
  points.push({ x: 401_247_500, y: 4_190_117_500 });
  return points;
}

const request = (key: number, points: readonly TopoPoint[], widthPx: number | null): SurveyPreviewRequest =>
  ({ key, points: packSurveyPoints(points), widthPx });

describe('Π — packing', () => {
  it('round-trips every point in order, planimetric stays planimetric', () => {
    const points = hill();
    expect(unpackSurveyPoints(packSurveyPoints(points))).toEqual(points);
    expect(unpackSurveyPoints(packSurveyPoints(points)).at(-1)).not.toHaveProperty('z');
  });

  it('a fresh buffer per call (a transfer empties the previous one)', () => {
    const points = hill();
    expect(packSurveyPoints(points).buffer).not.toBe(packSurveyPoints(points).buffer);
  });
});

describe('Η — host', () => {
  it('the reply is the door verdict and its map — nothing re-implemented', () => {
    const points = hill();
    const reply = createSurveyPreviewHost()(request(1, points, 480));
    const direct = prepareSurveyUpload(points);
    expect(reply.preparation).toEqual(direct);
    if (!direct.ok) throw new Error('fixture must be accepted');
    expect(reply.model).toEqual(terrainMapModelOf(direct.snapshot, direct.marks, { widthPx: 480 }));
  });

  it('same key ⇒ the survey is reused (only the map is re-drawn) · same key + width ⇒ the same reply', () => {
    const host = createSurveyPreviewHost();
    const first = host(request(1, hill(), 320));
    const resized = host(request(1, hill(), 960));
    expect(resized.preparation).toBe(first.preparation);
    expect(resized.model).not.toEqual(first.model);
    expect(host(request(1, hill(), 960))).toBe(resized);
    expect(host(request(2, hill(), 960)).preparation).not.toBe(first.preparation);
  });

  it('a refused survey has no map', () => {
    const reply = createSurveyPreviewHost()(request(1, hill().slice(0, 2), null));
    expect(reply.preparation).toMatchObject({ ok: false, code: 'TERRAIN_INSUFFICIENT_SURFACE' });
    expect(reply.model).toBeNull();
  });
});

describe('Κ — client', () => {
  const worker = () => new FakeWorker<SurveyPreviewRequest, SurveyPreviewReply>(createSurveyPreviewHost());

  it('answers through the Worker, and the points travel as a TRANSFERRED buffer', async () => {
    const fake = worker();
    const previewer = createSurveyPreviewer({ spawn: () => fake });
    const result = await previewer.preview({ key: 1, points: hill(), widthPx: 640 });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.value.preparation).toEqual(prepareSurveyUpload(hill()));
    const sent = fake.sent[0] as { body: SurveyPreviewRequest };
    expect(fake.transfers[0]).toEqual([sent.body.points.buffer]);
    expect(sent.body.points.byteLength).toBe(0);
  });

  it('latest-only: the questions in between are superseded without reaching the Worker', async () => {
    const fake = worker();
    const previewer = createSurveyPreviewer({ spawn: () => fake });
    const results = await Promise.all([1, 2, 3].map((key) => previewer.preview({ key, points: hill(), widthPx: null })));
    expect(results.map((r) => r.kind)).toEqual(['ok', 'superseded', 'ok']);
    expect(fake.sent).toHaveLength(2);
  });

  it('no Worker ⇒ the SAME handler on the main thread', async () => {
    const result = await createSurveyPreviewer({ spawn: () => null }).preview({ key: 1, points: hill(), widthPx: null });
    expect(result).toMatchObject({ kind: 'ok', value: { key: 1, preparation: prepareSurveyUpload(hill()) } });
  });

  it('warm-up spawns the Worker once, before any question', () => {
    const spawn = jest.fn(worker);
    const previewer = createSurveyPreviewer({ spawn });
    previewer.warm();
    previewer.warm();
    expect(spawn).toHaveBeenCalledTimes(1);
    previewer.dispose();
  });
});
