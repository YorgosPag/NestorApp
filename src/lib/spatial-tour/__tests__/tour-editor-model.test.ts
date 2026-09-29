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

describe('Ξ — σημείο που ξαναψήνεται μετά από θόλωμα (Φ2ζ ζ3 · §4.15)', () => {
  const REBAKING = { state: 'pending', contentHash: 'k2', faceSize: null, retiredKeys: ['h'] } as const;

  it('η νεότερη λήψη ξαναψήνεται ⇒ ΟΧΙ η παλαιότερη φωτογραφία στη θέση της· το σημείο μένει ως «ετοιμάζεται»', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_old', 'a', '2026-09-01T10:00:00.000Z'),
      capture('c_blur', 'a', '2026-09-05T10:00:00.000Z', { tileset: REBAKING, originalHash: 'h' }),
    ]);
    expect(model.graph.stops.has('a')).toBe(false);
    expect(model.rebaking.map((r) => [r.nodeId, r.capture.id, r.readiness])).toEqual([['a', 'c_blur', 'baking']]);
  });

  it('αποτυχημένη επανα-ψήση ⇒ «failed», ποτέ σιωπηλή επιστροφή σε άλλη λήψη', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_old', 'a', '2026-09-01T10:00:00.000Z'),
      // Το `failed` ΚΡΑΤΑ τα αποσυρμένα κλειδιά (ζ4): «είχε δημοσιευμένα πλακίδια, τίποτα δεν πήρε τη θέση τους».
      capture('c_blur', 'a', '2026-09-05T10:00:00.000Z', { tileset: { state: 'failed', contentHash: 'k2', faceSize: null, retiredKeys: ['h'] }, originalHash: 'h' }),
    ]);
    expect(model.rebaking.map((r) => r.readiness)).toEqual(['failed']);
    expect(model.graph.stops.has('a')).toBe(false);
  });

  it('θολωμένη λήψη που ΕΙΝΑΙ έτοιμη ⇒ κανονική στάση, καμία εκκρεμότητα', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_blur', 'a', '2026-09-05T10:00:00.000Z', { originalHash: 'h' }),
    ]);
    expect(model.graph.stops.get('a')?.stop.captureId).toBe('c_blur');
    expect(model.rebaking).toEqual([]);
  });

  it('το σημείο που ξαναψήνεται κρατά τον ΚΟΜΒΟ του + ομοιόροφα ΣΗΜΕΙΑ με τη σειρά του γράφου (όνομα «Γραφείο 2», όχι ημερομηνία)', () => {
    const office = (id: string): TourNode => ({ ...node(id), room: { types: ['office'], label: null, source: 'manual' } });
    const other = { ...node('z'), levelKey: { kind: 'local', ordinal: 1 } } as const;
    const nodes = [office('a'), node('empty'), office('b'), other];
    const model = buildTourEditorModel({ nodes, levels: LEVELS }, [
      capture('ca', 'a', '2026-09-01T10:00:00.000Z'),
      capture('cz', 'z', '2026-09-01T10:00:00.000Z'),
      capture('c_blur', 'b', '2026-09-05T10:00:00.000Z', { tileset: REBAKING, originalHash: 'h' }),
    ]);
    const [entry] = model.rebaking;
    expect(entry?.node?.id).toBe('b');
    expect(entry?.levelPeers.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('ορφανή λήψη (κόμβος εκτός γράφου) ⇒ κανένας κόμβος — η στήλη πέφτει στην ημερομηνία', () => {
    const model = buildTourEditorModel({ nodes: [], levels: LEVELS }, [
      capture('c_blur', 'gone', '2026-09-05T10:00:00.000Z', { tileset: REBAKING, originalHash: 'h' }),
    ]);
    expect(model.rebaking.map((r) => [r.node, r.levelPeers])).toEqual([[null, []]]);
  });

  it('το ΠΡΩΤΟ ψήσιμο νέας λήψης (χωρίς originalHash) κρατά την παλιά συμπεριφορά (Φ2δ)', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_ready', 'a', '2026-09-01T10:00:00.000Z'),
      capture('c_new', 'a', '2026-09-05T10:00:00.000Z', { tileset: PENDING }),
    ]);
    expect(model.graph.stops.get('a')?.stop.captureId).toBe('c_ready');
    expect(model.rebaking).toEqual([]);
  });

  it('ζ4: η αυτόματη σάρωση άλλαξε το κλειδί ΠΡΙΝ δημοσιευτεί ποτέ (originalHash, κανένα αποσυρμένο) ⇒ ακόμη πρώτο ψήσιμο (Φ2δ)', () => {
    const model = buildTourEditorModel({ nodes: [node('a')], levels: LEVELS }, [
      capture('c_ready', 'a', '2026-09-01T10:00:00.000Z'),
      capture('c_new', 'a', '2026-09-05T10:00:00.000Z', { tileset: { state: 'pending', contentHash: 'k_auto', faceSize: null }, originalHash: 'h' }),
    ]);
    expect(model.graph.stops.get('a')?.stop.captureId).toBe('c_ready');
    expect(model.rebaking).toEqual([]);
  });
});
