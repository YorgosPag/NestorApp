/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2ζ ζ3 · §4.15 — **το πινέλο θολώματος στον επεξεργαστή**.
 *
 * - **♿** — «Θόλωμα στο στόχαστρο» = ένας κύκλος με ένα κλικ (WCAG 2.5.7)· λαβή με πληκτρολόγιο (Delete).
 * - **Σ** — σύρσιμο στην επιφάνεια ⇒ κύκλος με κέντρο το πάτημα και ακτίνα **στη σφαίρα** ως τον δείκτη· κάτω από το κατώφλι ⇒ κλικ.
 * - **Κ** — Space + σύρσιμο ⇒ κοίταγμα, **κανένας** κύκλος.
 * - **Ε** — «Εφαρμογή» ⇒ **μία** κλήση με όλη τη δέσμη· επιτυχία ⇒ άδειο πρόχειρο, έξω από το πινέλο.
 * - **Esc** — ένας ιδιοκτήτης: αποεπιλογή ⇒ έξοδος από το πινέλο ⇒ μόνο τότε ο διάλογος.
 * - **Π** — η προεπισκόπηση φτάνει στη σκηνή (και αδειάζει όταν το εργαλείο «κοιμάται»).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { TourRedactionEdit } from '@/lib/spatial-tour/tour-graph-edit';
import type { PackedRedactionPreview } from '@/lib/spatial-tour/viewer/tour-redaction-preview';
import { CAPTURE } from '@/lib/spatial-tour/__tests__/spatial-tour-fixtures';
import { installPointerEvents } from '@/test-utils/pointer-event';
import type { TourCapture } from '@/types/spatial-tour';

import { createTourCameraStore } from '../../viewer/tour-camera-store';
import type { TourStageScene } from '../../viewer/TourPanoramaStage';
import { TourRedactionOverlay } from '../redaction/TourRedactionOverlay';
import { TourRedactionTools } from '../redaction/TourRedactionTools';
import { useRedactionTool } from '../redaction/useRedactionTool';
import { TourEditorEscapeContext, useTourEditorEscapeOwner, type TourEditorEscape } from '../tour-editor-escape';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

beforeAll(installPointerEvents);

const K = 'spatial-tour:editor.blur';
let seq = 0;
const newId = () => `tred_00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

/** Ψεύτικη σκηνή: x (px) ⇒ yaw = x/1000, πάντα στον ορίζοντα· πέρα από 900 px = έξω από την εικόνα. */
function fakeScene(): TourStageScene & { readonly previews: PackedRedactionPreview[] } {
  const previews: PackedRedactionPreview[] = [];
  return {
    previews,
    stop: { captureId: 'tcap_1', faceSize: 2048 },
    camera: createTourCameraStore(),
    panoramaAtClient: (x: number) => (x > 900 ? null : { yaw: x / 1000, pitch: 0 }),
    centerPanorama: () => ({ yaw: 0.3, pitch: 0 }),
    project: () => ({ x: 10, y: 10 }),
    height: () => 500,
    onFrame: () => () => undefined,
    setRedactionPreview: (p: PackedRedactionPreview) => { previews.push(p); },
  };
}

function Tool({ capture, scene, apply }: {
  readonly capture: TourCapture;
  readonly scene: TourStageScene;
  readonly apply: (captureId: string, edits: readonly TourRedactionEdit[]) => Promise<boolean>;
}) {
  const tool = useRedactionTool(capture, { apply, newId });
  return <><TourRedactionTools tool={tool} scene={scene} /><figure><TourRedactionOverlay scene={scene} tool={tool} /></figure></>;
}

/** Ο ιδιοκτήτης του Esc ΕΞΩ από το εργαλείο — όπως ο διάλογος γύρω από τον επεξεργαστή. */
function Harness({ escape, children }: { readonly escape: { current: TourEditorEscape | null }; readonly children: ReactNode }) {
  const owner = useTourEditorEscapeOwner();
  escape.current = owner;
  return <TourEditorEscapeContext.Provider value={owner}>{children}</TourEditorEscapeContext.Provider>;
}

function setup(apply = jest.fn(async () => true)) {
  const scene = fakeScene();
  const escape: { current: TourEditorEscape | null } = { current: null };
  const utils = render(<Harness escape={escape}><Tool capture={{ ...CAPTURE, id: 'tcap_1' }} scene={scene} apply={apply} /></Harness>);
  return { scene, apply, escape, ...utils };
}

const brushButton = () => screen.getByRole('button', { name: `${K}.brush` });
const surface = (container: HTMLElement) => container.querySelector('figure > [aria-hidden]') as HTMLElement;
const lastEdits = (apply: jest.Mock) => apply.mock.calls.at(-1)?.[1] as TourRedactionEdit[];

describe('♿ — ένα κλικ', () => {
  it('«Θόλωμα στο στόχαστρο» ⇒ κύκλος στο κέντρο της εικόνας, μέγεθος ανάλογο του FOV', async () => {
    const { apply, scene } = setup();
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    fireEvent.click(screen.getByRole('button', { name: `${K}.apply:1` }));
    await act(async () => undefined);
    const [edit] = lastEdits(apply);
    expect(edit).toMatchObject({ op: 'redact', mode: 'create', region: { yawRad: 0.3, pitchRad: 0 } });
    expect(edit?.op === 'redact' && edit.region.radiusRad).toBeCloseTo(scene.camera.get().view.fov * 0.08, 10);
  });
});

describe('Σ — σύρσιμο στη σφαίρα', () => {
  it('πάτημα στο 100 px, άφεση στο 160 px ⇒ κέντρο yaw 0,1 · ακτίνα 0,06 rad', async () => {
    const { apply, container } = setup();
    fireEvent.click(brushButton());
    const el = surface(container);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 130, clientY: 50 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 160, clientY: 50 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 160, clientY: 50 });
    fireEvent.click(screen.getByRole('button', { name: `${K}.apply:1` }));
    await act(async () => undefined);
    const [edit] = lastEdits(apply);
    expect(edit?.op === 'redact' && [edit.region.yawRad, edit.region.radiusRad].map((v) => Number(v.toFixed(6)))).toEqual([0.1, 0.06]);
  });

  it('κίνηση κάτω από το κατώφλι = κλικ ⇒ κανένας κύκλος', () => {
    const { container } = setup();
    fireEvent.click(brushButton());
    const el = surface(container);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 102, clientY: 50 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 102, clientY: 50 });
    expect(screen.getByText(`${K}.empty`)).toBeTruthy();
  });

  it('σύρσιμο ΠΑΝΩ σε κύκλο ⇒ μετακίνηση, όχι νέος κύκλος', async () => {
    const { apply, container } = setup();
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    fireEvent.click(brushButton());
    const el = surface(container);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 300, clientY: 50 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 350, clientY: 50 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 350, clientY: 50 });
    fireEvent.click(screen.getByRole('button', { name: `${K}.apply:1` }));
    await act(async () => undefined);
    const edits = lastEdits(apply);
    expect(edits).toHaveLength(1);
    expect(edits[0]?.op === 'redact' && Number(edits[0].region.yawRad.toFixed(6))).toBe(0.35);
  });
});

describe('Κ — κοίταγμα με Space', () => {
  it('Space + σύρσιμο ⇒ η κάμερα γυρίζει, κανένας κύκλος', () => {
    const { container, scene } = setup();
    fireEvent.click(brushButton());
    const before = scene.camera.get().view.yaw;
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    const el = surface(container);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 200, clientY: 50 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 200, clientY: 50 });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(scene.camera.get().view.yaw).not.toBe(before);
    expect(screen.getByText(`${K}.empty`)).toBeTruthy();
  });
});

describe('Ε — εφαρμογή σε δέσμη', () => {
  it('δύο κύκλοι ⇒ ΜΙΑ κλήση με δύο αλλαγές · επιτυχία ⇒ κανένα εκκρεμές, έξω από το πινέλο', async () => {
    const { apply } = setup();
    fireEvent.click(brushButton());
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    fireEvent.click(screen.getByRole('button', { name: `${K}.apply:2` }));
    await act(async () => undefined);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0]).toBe('tcap_1');
    expect(lastEdits(apply)).toHaveLength(2);
    expect(brushButton().getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: `${K}.apply:2` })).toBeNull();
  });

  it('άρνηση ⇒ το πρόχειρο ΜΕΝΕΙ (τίποτα δεν χάνεται)', async () => {
    const { apply } = setup(jest.fn(async () => false));
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    fireEvent.click(screen.getByRole('button', { name: `${K}.apply:1` }));
    await act(async () => undefined);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: `${K}.apply:1` })).toBeTruthy();
  });

  it('«Απόρριψη» ⇒ πίσω στα εφαρμοσμένα', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    fireEvent.click(screen.getByRole('button', { name: `${K}.discard` }));
    expect(screen.getByText(`${K}.empty`)).toBeTruthy();
  });
});

describe('Esc — ένας ιδιοκτήτης', () => {
  it('επιλογή ⇒ αποεπιλογή · πινέλο ⇒ έξοδος · μετά ο διάλογος', () => {
    const { escape } = setup();
    fireEvent.click(brushButton());
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    let consumed = false;
    act(() => { consumed = escape.current?.consume() ?? false; });
    expect(consumed).toBe(true);
    expect(screen.queryByRole('button', { name: `${K}.handleMove:1`, hidden: true })).toBeNull();
    act(() => { consumed = escape.current?.consume() ?? false; });
    expect(consumed).toBe(true);
    expect(brushButton().getAttribute('aria-pressed')).toBe('false');
    act(() => { consumed = escape.current?.consume() ?? false; });
    expect(consumed).toBe(false);
  });

  it('Delete πάνω στη λαβή ⇒ ο κύκλος φεύγει', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    fireEvent.keyDown(screen.getByRole('button', { name: `${K}.handleMove:1`, hidden: true }), { key: 'Delete' });
    expect(screen.getByText(`${K}.empty`)).toBeTruthy();
  });
});

describe('Π — προεπισκόπηση', () => {
  it('ο πρόχειρος κύκλος φτάνει στη σκηνή· απόρριψη ⇒ άδεια προεπισκόπηση', () => {
    const { scene } = setup();
    fireEvent.click(screen.getByRole('button', { name: `${K}.atReticle` }));
    expect(scene.previews.at(-1)?.count).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: `${K}.discard` }));
    expect(scene.previews.at(-1)?.count).toBe(0);
  });
});
