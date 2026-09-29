/**
 * @fileoverview **ΤΟ ΒΗΜΑ «ΧΩΡΟΙ» ΑΠΟ ΑΚΡΗ ΣΕ ΑΚΡΗ** (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ8 · Δ9) — με τον ΠΡΑΓΜΑΤΙΚΟ χάρτη, λαβές,
 * πένα, πάνελ και κριτή· ψεύτικα μόνο ο Worker ανίχνευσης και οι εντολές προς τον διακομιστή.
 *
 * Κάτοψη 1000 × 500 px, 1 cm/px ⇒ 10 × 5 m· το `<svg>` πιάνει 1000 × 500 css px ⇒ **1 css px = 1 cm**, client (x, y) ⇒ κάτοψη
 * (x/100, −y/100). Εγκεκριμένος χώρος S1 = 0..4 × 0..−4 με το σημείο «a» μέσα· το σημείο «b» (7, −2) χωρίς χώρο.
 *
 * - **Α** — αυτόματες προτάσεις (Δ9.2) · έγκριση = `create` με το οριστικό id της πρότασης (Δ9.6)
 * - **Κ** — ο κριτής πριν το κουμπί (Δ9.6) · φύλακας 15% (Δ9.4)
 * - **Λ** — λαβές: σύρσιμο ⇒ ΜΙΑ `replace` · πληκτρολόγιο (WCAG 2.1.1)
 * - **Π** — πένα (Δ9.5) · κλικ στην κάτοψη · διαχωρισμός (Δ8.2) · πόρτα (Δ9.7)
 */

import { act, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { installPointerEvents } from '@/test-utils/pointer-event';

import type { PlanDetectRequest, PlanDetectResult } from '@/lib/spatial-tour/space-detect/space-detect-plan';
import type { TourViewerGraph, TourViewerLevel, ViewerLevelEntry, ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';
import type { TourNode } from '@/types/spatial-tour';

import type { TourPanoramaSource } from '../../../viewer/tour-panorama-source';
import type { TourEditorActions } from '../../useTourEditorActions';
import { TourSpacesWorkspace } from '../TourSpacesWorkspace';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, v?: Record<string, unknown>) => (v === undefined ? key : `${key}:${JSON.stringify(v)}`), isNamespaceReady: true }),
}));

type Reply = WorkerRpcResult<PlanDetectResult>;
const detect = jest.fn<Promise<Reply>, [string, PlanDetectRequest]>();
jest.mock('@/lib/spatial-tour/space-detect/space-detect-client', () => ({
  createSpaceDetector: () => ({ load: jest.fn(async () => ({ kind: 'ok', value: { width: 1, height: 1 } })), detect, dispose: jest.fn() }),
}));

const L0 = { kind: 'local', ordinal: 0 } as const;
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const PLAN = { fileId: 'f1', source: 'engineer' as const, image: { width: 1000, height: 500, contentHash: 'h1' }, metresPerPixel: 0.01 };
const S1 = { id: 'tspc_11111111-1111-4111-8111-111111111111', points: rect(0, 0, 4, -4), source: 'detected' as const };
const found = (outline: { x: number; y: number }[], separation: Extract<PlanDetectResult, { ok: true }>['separation'] = null): Reply =>
  ({ kind: 'ok', value: { ok: true, outline, orthogonal: true, areaM2: 12, separation } });

function node(id: string, x: number, y: number): TourNode {
  return { id, levelKey: L0, position: { x, y, z: 0 }, links: [] };
}
const NODES = [node('a', 2, -2), node('b', 7, -2)];

function graphOf(entry: ViewerLevelEntry): TourViewerGraph {
  const stop = (n: TourNode, number: number): ViewerStop =>
    ({ stop: { captureId: `c-${n.id}`, nodeId: n.id, capturedAt: '', headingRad: 0, tilesetHash: 'h', faceSize: 1024 }, node: n, levelId: 'l0', number });
  return { stops: new Map(NODES.map((n, i) => [n.id, stop(n, i + 1)])), levels: [entry], adjacency: new Map(), spaceAreas: 'shown' };
}

let seq = 0;
function fakeActions(): TourEditorActions {
  return {
    busy: false, place: jest.fn(), unplace: jest.fn(), placeArrow: jest.fn(), unlink: jest.fn(), name: jest.fn(), choosePlan: jest.fn(),
    calibrate: jest.fn(), position: jest.fn(), orient: jest.fn(),
    space: jest.fn(async () => true), unspace: jest.fn(async () => true), separate: jest.fn(async () => true), unseparate: jest.fn(async () => true),
    newSpaceId: jest.fn(() => `tspc_00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`),
  };
}

const SOURCE = { tiles: null, base: jest.fn(), planImageUrl: jest.fn(() => 'plan.webp') } as unknown as TourPanoramaSource;

function renderWorkspace(spaces = [S1], actions = fakeActions(), onOpenChange = jest.fn()) {
  const entry: ViewerLevelEntry = { id: 'l0', label: null, ordinal: 0, nodeIds: ['a', 'b'], hasPlan: true, plan: PLAN, spaces, separations: [] };
  const levels: TourViewerLevel[] = [{ key: L0, label: null, ordinal: 0, plan: PLAN, spaces, separations: [] }];
  render(<TourSpacesWorkspace open onOpenChange={onOpenChange} graph={graphOf(entry)} levelId="l0" levelKey={L0} nodes={NODES}
    levels={levels} source={SOURCE} actions={actions} nameOf={(id) => `Σ-${id}`} />);
  return { actions, map: screen.getByRole('group', { name: 'spatial-tour:spaceEditor.map' }) };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** Στην εφαρμογή ο `TooltipProvider` είναι καθολικός (η μπάρα ζουμ έχει tooltips). */
const render = (ui: ReactElement) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

beforeAll(() => {
  // 1 css px = 1 cm: το `<svg>` 1000 × 500 css px πάνω σε κάτοψη 10 × 5 m.
  Object.defineProperty(SVGElement.prototype, 'getBoundingClientRect', {
    configurable: true, value: () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0 }),
  });
  installPointerEvents();
});
beforeEach(() => { detect.mockReset(); seq = 0; });

describe('Α — προτάσεις και έγκριση', () => {
  it('στο άνοιγμα: πρόταση ΜΟΝΟ για το σημείο χωρίς χώρο · Έγκριση ⇒ `create` με το ΙΔΙΟ id που είχε η πρόταση', async () => {
    detect.mockResolvedValue(found(rect(5, -1, 9, -4)));
    const { actions } = renderWorkspace();
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(1));
    expect(detect.mock.calls[0][1]).toMatchObject({ seed: { x: 7, y: -2 }, otherStops: [{ x: 2, y: -2 }], doorWidthM: 1 });
    fireEvent.click(await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.approve' }));
    await waitFor(() => expect(actions.space).toHaveBeenCalledTimes(1));
    const [, target, draft] = (actions.space as jest.Mock).mock.calls[0];
    expect(target).toEqual({ mode: 'create', spaceId: (actions.newSpaceId as jest.Mock).mock.results[0].value });
    expect(draft).toMatchObject({ points: rect(5, -1, 9, -4), source: 'detected', declaredArea: null });
  });
});

describe('Α2 — η πρόταση είναι τοπική και ζωντανή', () => {
  it('σύρσιμο γωνίας πρότασης ⇒ ΚΑΜΙΑ εγγραφή · η ΛΙΣΤΑ δείχνει το νέο εμβαδόν (όχι το παλιό της ανίχνευσης)', async () => {
    detect.mockResolvedValue(found(rect(5, -1, 9, -4)));
    const { actions } = renderWorkspace();
    const corner = await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.vertex:{"index":2,"total":4}' });
    fireEvent.pointerDown(corner, { pointerId: 1, button: 0, clientX: 900, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 950, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 1000, clientY: 100 });
    fireEvent.pointerUp(corner, { pointerId: 1, clientX: 1000, clientY: 100 });
    expect(actions.space).not.toHaveBeenCalled();
    const list = screen.getByRole('navigation');
    expect(within(list).getByText(/measuredValue:\{"area":"14"\}/)).toBeTruthy();
  });
});

describe('Κ — κριτής πριν το κουμπί · φύλακας', () => {
  it('πρόταση που μπαίνει στον S1 ⇒ Έγκριση ανενεργή, με τον λόγο (`space-overlap`)', async () => {
    detect.mockResolvedValue(found(rect(3, -1, 9, -4)));
    renderWorkspace();
    expect(await screen.findByText('spatial-tour:refusal.spaceOverlap')).toBeTruthy();
    expect((button('spatial-tour:spaceEditor.approve') as HTMLButtonElement).disabled).toBe(true);
  });

  it('δηλωμένο 20 για ≈ 12 ⇒ προειδοποίηση ΧΩΡΙΣ φραγή · χωρίς πηγή ⇒ φραγή', async () => {
    detect.mockResolvedValue(found(rect(5, -1, 9, -4)));
    renderWorkspace();
    fireEvent.change(await screen.findByLabelText('spatial-tour:spaceEditor.declared'), { target: { value: '20' } });
    expect(screen.getByText('spatial-tour:spaceEditor.declaredSourceRequired')).toBeTruthy();
    expect((button('spatial-tour:spaceEditor.approve') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Λ — λαβές εγκεκριμένου χώρου', () => {
  async function selectS1() {
    detect.mockResolvedValue({ kind: 'superseded' });
    const rendered = renderWorkspace();
    fireEvent.click(rendered.map, { clientX: 100, clientY: 100 });
    await screen.findByRole('heading', { name: 'spatial-tour:spaceEditor.approvedSpace' });
    return rendered;
  }

  it('κλικ μέσα στον χώρο ⇒ επιλογή του (όχι νέα ανίχνευση) · σύρσιμο γωνίας ⇒ ΜΙΑ `replace` στην απελευθέρωση', async () => {
    const { actions } = await selectS1();
    const calls = detect.mock.calls.length;
    const corner = button('spatial-tour:spaceEditor.vertex:{"index":1,"total":4}');
    fireEvent.pointerDown(corner, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 30, clientY: 20 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(actions.space).not.toHaveBeenCalled();
    fireEvent.pointerUp(corner, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(detect.mock.calls.length).toBe(calls);
    expect(actions.space).toHaveBeenCalledTimes(1);
    const [, target, draft] = (actions.space as jest.Mock).mock.calls[0];
    expect(target).toEqual({ mode: 'replace', spaceId: S1.id });
    expect(draft.points[0]).toEqual({ x: 0.5, y: -0.5 });
    expect(draft.points.slice(1)).toEqual(S1.points.slice(1));
  });

  it('σε ΜΕΓΕΘΥΝΣΗ, το σύρσιμο γωνίας ΔΕΝ σέρνει την κάτοψη από κάτω (`data-plan-handle`)', async () => {
    const { map } = await selectS1();
    fireEvent.click(button('spatial-tour:viewer.planZoomIn'));
    const zoomed = map.getAttribute('viewBox');
    const corner = button('spatial-tour:spaceEditor.vertex:{"index":1,"total":4}');
    fireEvent.pointerDown(corner, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 180, clientY: 160 });
    fireEvent.pointerUp(corner, { pointerId: 1, clientX: 180, clientY: 160 });
    expect(map.getAttribute('viewBox')).toBe(zoomed);
  });

  it('σύρσιμο που θα ΑΡΝΙΟΤΑΝ ο γραφέας (μπαίνει στον S2) ⇒ καμία εγγραφή, μένει πρόχειρο με τον λόγο', async () => {
    detect.mockResolvedValue({ kind: 'superseded' });
    const S2 = { id: 'tspc_22222222-2222-4222-8222-222222222222', points: rect(5, 0, 9, -4), source: 'manual' as const };
    const { actions, map } = renderWorkspace([S1, S2]);
    fireEvent.click(map, { clientX: 100, clientY: 100 });
    const corner = await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.vertex:{"index":2,"total":4}' });
    fireEvent.pointerDown(corner, { pointerId: 1, button: 0, clientX: 400, clientY: 0 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 700, clientY: 100 });
    fireEvent.pointerUp(corner, { pointerId: 1, clientX: 700, clientY: 100 });
    expect(actions.space).not.toHaveBeenCalled();
    expect(screen.getByText('spatial-tour:refusal.spaceOverlap')).toBeTruthy();
  });

  it('πληκτρολόγιο: → ×2 ⇒ πρόχειρο (καμία εγγραφή) · Enter ⇒ ΜΙΑ `replace` 20 cm δεξιά', async () => {
    const { actions } = await selectS1();
    const corner = button('spatial-tour:spaceEditor.vertex:{"index":2,"total":4}');
    fireEvent.keyDown(corner, { key: 'ArrowRight' });
    fireEvent.keyDown(corner, { key: 'ArrowRight' });
    expect(actions.space).not.toHaveBeenCalled();
    fireEvent.keyDown(corner, { key: 'Enter' });
    expect((actions.space as jest.Mock).mock.calls[0][2].points[1].x).toBeCloseTo(4.2);
  });
});

describe('Π — πένα · κλικ · διαχωρισμός · πόρτα', () => {
  it('πένα: τρεις γωνίες + Enter ⇒ πρόταση `manual` · Έγκριση ⇒ `create` με τις γωνίες', async () => {
    detect.mockResolvedValue({ kind: 'superseded' });
    const { actions, map } = renderWorkspace();
    fireEvent.click(button(/spatial-tour:spaceEditor.toolPen/));
    for (const [x, y] of [[600, 300], [900, 300], [900, 450]]) fireEvent.click(map, { clientX: x, clientY: y });
    fireEvent.keyDown(map, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.approve' }));
    await waitFor(() => expect(actions.space).toHaveBeenCalled());
    const draft = (actions.space as jest.Mock).mock.calls[0][2];
    expect(draft.source).toBe('manual');
    expect(draft.points).toEqual([{ x: 6, y: -3 }, { x: 9, y: -3 }, { x: 9, y: -4.5 }]);
  });

  it('πένα: κλικ ΞΑΝΑ στην πρώτη γωνία ⇒ κλείνει (Figma) · Esc με άδεια πένα ⇒ έξοδος από την πένα, ΟΧΙ από την οθόνη', async () => {
    detect.mockResolvedValue({ kind: 'superseded' });
    const onOpenChange = jest.fn();
    const { map } = renderWorkspace([S1], fakeActions(), onOpenChange);
    fireEvent.click(button(/spatial-tour:spaceEditor.toolPen/));
    fireEvent.keyDown(map, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button(/spatial-tour:spaceEditor.toolSelect/).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button(/spatial-tour:spaceEditor.toolPen/));
    for (const [x, y] of [[600, 300], [900, 300], [900, 450], [603, 302]]) fireEvent.click(map, { clientX: x, clientY: y });
    expect(await screen.findByRole('heading', { name: 'spatial-tour:spaceEditor.proposal' })).toBeTruthy();
  });

  it('ο διακομιστής αρνείται την έγκριση ⇒ η πρόταση ΞΑΝΑΓΥΡΙΖΕΙ (ίδιο id), δεν χάνεται', async () => {
    detect.mockResolvedValue(found(rect(5, -1, 9, -4)));
    const actions = fakeActions();
    (actions.space as jest.Mock).mockResolvedValueOnce(false);
    renderWorkspace([S1], actions);
    fireEvent.click(await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.approve' }));
    await waitFor(() => expect(actions.space).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.approve' })).toBeTruthy();
  });

  it('κλικ σε κενό σημείο ⇒ ανίχνευση ΕΚΕΙ (αποθήκη χωρίς σημείο λήψης)', async () => {
    detect.mockResolvedValue({ kind: 'superseded' });
    const { map } = renderWorkspace();
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(1));
    fireEvent.click(map, { clientX: 850, clientY: 400 });
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(2));
    expect(detect.mock.calls[1][1]).toMatchObject({ seed: { x: 8.5, y: -4 }, otherStops: [{ x: 2, y: -2 }, { x: 7, y: -2 }] });
  });

  it('πρόταση διαχωρισμού ⇒ «Διαχωρισμός» γράφει τη γραμμή και ξαναρωτά τα σημεία', async () => {
    const segment = { a: { x: 6, y: -1 }, b: { x: 6, y: -4 } };
    detect.mockResolvedValueOnce(found(rect(5, -1, 9, -4), { segment, widthM: 3, otherStopIndex: 0 }));
    detect.mockResolvedValue(found(rect(6.05, -1, 9, -4)));
    const { actions } = renderWorkspace([]);
    fireEvent.click(await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.separationApply' }));
    await waitFor(() => expect(actions.separate).toHaveBeenCalledWith(L0, null, segment.a, segment.b));
    await waitFor(() => expect(detect.mock.calls.length).toBeGreaterThan(1));
  });

  it('πόρτα: → στο ρυθμιστικό ⇒ ξανά η επιλεγμένη πρόταση, με 1,05 m', async () => {
    detect.mockResolvedValue(found(rect(5, -1, 9, -4)));
    renderWorkspace();
    await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.approve' });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'spatial-tour:spaceEditor.door' }), { key: 'ArrowRight' });
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(2));
    expect(detect.mock.calls[1][1]).toMatchObject({ seed: { x: 7, y: -2 }, doorWidthM: 1.05 });
  });

  it('Esc με πρόχειρες γωνίες ΔΕΝ κλείνει την οθόνη — ακυρώνει τις γωνίες', async () => {
    detect.mockResolvedValue({ kind: 'superseded' });
    const onOpenChange = jest.fn();
    const entry: ViewerLevelEntry = { id: 'l0', label: null, ordinal: 0, nodeIds: ['a', 'b'], hasPlan: true, plan: PLAN, spaces: [S1], separations: [] };
    render(<TourSpacesWorkspace open onOpenChange={onOpenChange} graph={graphOf(entry)} levelId="l0" levelKey={L0} nodes={NODES}
      levels={[{ key: L0, label: null, ordinal: 0, plan: PLAN, spaces: [S1], separations: [] }]} source={SOURCE} actions={fakeActions()} nameOf={(id) => id} />);
    fireEvent.click(screen.getByRole('group', { name: 'spatial-tour:spaceEditor.map' }), { clientX: 100, clientY: 100 });
    const corner = await screen.findByRole('button', { name: 'spatial-tour:spaceEditor.vertex:{"index":1,"total":4}' });
    fireEvent.keyDown(corner, { key: 'ArrowRight' });
    await act(async () => { fireEvent.keyDown(corner, { key: 'Escape' }); });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'spatial-tour:spaceEditor.approvedSpace' })).toBeTruthy();
  });
});
