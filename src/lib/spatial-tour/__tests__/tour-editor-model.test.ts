/**
 * @fileoverview **ΤΟ ΜΟΝΤΕΛΟ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** (ADR-884 Φ2δ · §4.10) — καθαρό.
 *
 * - **Ε** — εισερχόμενα: μόνο ατοποθέτητες, νεότερη πρώτη, με ετοιμότητα από τον ΕΝΑ ορισμό (`isCaptureViewable`).
 * - **Σ** — σημεία: η πιο πρόσφατη **έτοιμη** λήψη ανά σημείο (άψητη νεότερη **δεν** κρύβει το σημείο από τον υπεύθυνο)·
 *   κάθε κοινό μετρά (ο υπεύθυνος βλέπει και τις ιδιωτικές).
 * - **Ν** — αρίθμηση: ακολουθεί τη σειρά των **κόμβων**, όχι των λήψεων ⇒ «Σημείο 2» είναι το ίδιο στην οθόνη και στον θεατή.
 * - **Β** — «λείπει βελάκι»: μόνο σύνδεσμος χωρίς βελάκι **και** χωρίς θέσεις κάτοψης· η επιστροφή δεν μαντεύεται.
 */

import { buildTourEditorModel, newestCaptureFirst, previewGraphOf } from '../tour-editor-model';
import { buildViewerGraph } from '../viewer/tour-viewer-graph';
import type { TourCapture, TourNode } from '@/types/spatial-tour';

import { CAPTURE } from './spatial-tour-fixtures';

const L0 = { kind: 'local', ordinal: 0 } as const;
const LEVELS = [{ key: L0, label: null, ordinal: 0 }];
const READY = { state: 'ready', contentHash: 'h', faceSize: 1024 } as const;
const PENDING = { state: 'pending', contentHash: null, faceSize: null } as const;

const node = (id: string, links: TourNode['links'] = [], position: TourNode['position'] = null): TourNode =>
  ({ id, levelKey: L0, position, links });
const capture = (id: string, nodeId: string | null, capturedAt: string, extra: Partial<TourCapture> = {}): TourCapture =>
  ({ ...CAPTURE, id, nodeId, capturedAt, tileset: READY, ...extra });

describe('Ε — εισερχόμενα', () => {
  it('μόνο ατοποθέτητες, νεότερη πρώτη, με ετοιμότητα', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_old', null, '2026-09-01T10:00:00.000Z'),
      capture('c_new', null, '2026-09-03T10:00:00.000Z', { tileset: PENDING }),
      capture('c_bad', null, '2026-09-02T10:00:00.000Z', { tileset: { state: 'failed', contentHash: 'h', faceSize: null } }),
      capture('c_on_a', 'a', '2026-09-04T10:00:00.000Z'),
    ]);
    expect(model.inbox.map((e) => [e.capture.id, e.readiness])).toEqual([['c_new', 'baking'], ['c_bad', 'failed'], ['c_old', 'ready']]);
  });

  it('ισοπαλία ημερομηνίας ⇒ σταθερή σειρά (id)', () => {
    const at = '2026-09-01T10:00:00.000Z';
    expect([capture('x1', null, at), capture('x2', null, at)].sort(newestCaptureFirst).map((c) => c.id)).toEqual(['x2', 'x1']);
  });
});

describe('Σ — σημεία', () => {
  it('νεότερη άψητη λήψη ΔΕΝ κρύβει το σημείο — δείχνεται η πιο πρόσφατη έτοιμη', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_ready', 'a', '2026-09-01T10:00:00.000Z'),
      capture('c_pending', 'a', '2026-09-05T10:00:00.000Z', { tileset: PENDING }),
    ]);
    expect(model.graph.stops.get('a')?.stop.captureId).toBe('c_ready');
    expect(model.capturesOnNode.get('a')).toBe(2);
  });

  it('ο υπεύθυνος βλέπει και σημείο με ιδιωτική λήψη', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_priv', 'a', '2026-09-01T10:00:00.000Z', { audience: 'project-team' }),
    ]);
    expect(model.graph.stops.has('a')).toBe(true);
  });
});

describe('Ν — αρίθμηση κατά κόμβο', () => {
  it('ίδια αρίθμηση όποια κι αν είναι η σειρά των λήψεων — οθόνη και θεατής συμφωνούν', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const captures = [capture('c3', 'c', '2026-09-01T10:00:00.000Z'), capture('c1', 'a', '2026-09-01T10:00:00.000Z'), capture('c2', 'b', '2026-09-01T10:00:00.000Z')];
    const model = buildTourEditorModel({ nodes, levels: LEVELS }, captures);
    const numbers = (ids: readonly string[], graph: typeof model.graph) => ids.map((id) => graph.stops.get(id)?.number);
    expect(numbers(['a', 'b', 'c'], model.graph)).toEqual([1, 2, 3]);
    const stops = [...model.graph.stops.values()].map((s) => s.stop).reverse();
    expect(numbers(['a', 'b', 'c'], buildViewerGraph({ nodes, stops }, LEVELS))).toEqual([1, 2, 3]);
  });
});

describe('Β — βελάκια που λείπουν', () => {
  const at = '2026-09-01T10:00:00.000Z';
  it('βελάκι μόνο στη μία πλευρά ⇒ λείπει στην άλλη (η επιστροφή δεν μαντεύεται)', () => {
    const nodes = [node('a', [{ toNodeId: 'b', via: 'manual', bearingRad: 1 }]), node('b', [{ toNodeId: 'a', via: 'manual', bearingRad: null }])];
    const model = buildTourEditorModel({ nodes, levels: LEVELS }, [capture('ca', 'a', at), capture('cb', 'b', at)]);
    expect(model.missingArrows.get('a')).toBeUndefined();
    expect(model.missingArrows.get('b')).toEqual(['a']);
  });

  it('με θέσεις κάτοψης η διόπτευση παράγεται ⇒ τίποτα δεν λείπει', () => {
    const nodes = [
      node('a', [{ toNodeId: 'b', via: 'manual', bearingRad: null }], { x: 0, y: 0, z: 0 }),
      node('b', [{ toNodeId: 'a', via: 'manual', bearingRad: null }], { x: 3, y: 0, z: 0 }),
    ];
    const model = buildTourEditorModel({ nodes, levels: LEVELS }, [capture('ca', 'a', at), capture('cb', 'b', at)]);
    expect(model.missingArrows.size).toBe(0);
  });
});

describe('προεπισκόπηση', () => {
  it('έτοιμη ατοποθέτητη ⇒ ένας γράφος ενός σημείου με τη στάση της· άψητη ⇒ τίποτα', () => {
    const preview = previewGraphOf(capture('c1', null, '2026-09-01T10:00:00.000Z'));
    expect(preview?.graph.stops.get(preview.nodeId)?.stop.captureId).toBe('c1');
    expect(previewGraphOf(capture('c2', null, '2026-09-01T10:00:00.000Z', { tileset: PENDING }))).toBeNull();
  });
});
