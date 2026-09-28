/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ1 — ο θεατής πάνω στην **εικονική περιήγηση** (`demo/demo-tour.ts`, η ίδια με το `/test-harness/tour-viewer`).
 * Η μηχανή three.js αντικαθίσταται (jsdom δεν έχει WebGL)· ελέγχεται **η συμπεριφορά του θεατή**: τι προσφέρει, πού πηγαίνει,
 * τι λέει όταν κάτι λείπει.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { TourPanoramaEngine } from '../tour-panorama-engine';
import type { TourCubeFaceImages, TourFaceImage, TourPanoramaSource } from '../tour-panorama-source';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

let webgl = true;
jest.mock('@/lib/browser/webgl-support', () => ({ isWebGLAvailable: () => webgl }));
jest.mock('@/lib/a11y/reduced-motion', () => ({ prefersReducedMotion: () => true }));

const engine: jest.Mocked<TourPanoramaEngine> = {
  setView: jest.fn(),
  resize: jest.fn(),
  viewportHeightDevicePx: jest.fn(() => 400),
  hasTile: jest.fn(() => false),
  putTile: jest.fn(),
  showNow: jest.fn(),
  setIncoming: jest.fn(),
  setIncomingOpacity: jest.fn(),
  commitIncoming: jest.fn(),
  project: jest.fn(() => ({ x: 10, y: 10 })),
  unproject: jest.fn(() => ({ yaw: 0, pitch: 0 })),
  onFrame: jest.fn(() => () => undefined),
  dispose: jest.fn(),
};
jest.mock('../tour-panorama-engine', () => ({ createTourPanoramaEngine: () => engine }));

import { DEMO_TOUR_MANIFEST } from '../demo/demo-tour';
import { TourViewer } from '../TourViewer';
import type { TourManifest } from '@/server/spatial-tour/tour-view-session';

const FACES = {} as TourCubeFaceImages;
const TILE = { width: 512, height: 512 } as TourFaceImage;
let failing = new Set<string>();
const source: TourPanoramaSource = {
  base: jest.fn(async (stop) => {
    if (failing.has(stop.nodeId)) throw new Error('offline');
    return FACES;
  }),
  tiles: { levels: () => [512], tile: jest.fn(async () => TILE) },
  planImageUrl: (plan) => `plan:${plan.image.contentHash}`,
};

beforeAll(() => {
  global.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
});
beforeEach(() => {
  webgl = true;
  failing = new Set();
  jest.clearAllMocks();
});

/** Η πρώτη εικόνα φορτώνει ασύγχρονα — η απόδοση περιμένει να κατακάτσει (καμία ενημέρωση εκτός `act`). */
const renderViewer = async (manifest: TourManifest = DEMO_TOUR_MANIFEST) => {
  await act(async () => { render(<TourViewer manifest={manifest} source={source} />); });
};
/** «Σημείο N» — το όνομα ενός σημείου χωρίς δηλωμένο χώρο (η ψεύτικη `t` κολλά τις τιμές μετά το κλειδί). */
const P = (n: number) => `spatial-tour:viewer.point:${n}`;
const panel = () => within(screen.getByRole('navigation', { name: 'spatial-tour:viewer.panelTitle' }));
const floorSection = (ordinal: number) => within(panel().getByRole('region', { name: `spatial-tour:viewer.floorNumbered:${ordinal}` }));
/** Κουμπί μετάβασης της στήλης — ανά όροφο, γιατί η αρίθμηση «Σημείο N» είναι ανά όροφο. */
const floorList = (ordinal: number) => within(floorSection(ordinal).getByRole('list'));
const goButton = (n: number, ordinal = 0) => floorList(ordinal).getByRole('button', { name: `spatial-tour:viewer.goTo:${P(n)}` });
/** Η επικεφαλίδα πάνω στη σκηνή — το όνομα του χώρου όπου βρίσκεται ο επισκέπτης. */
const hereHeading = (name: string) => screen.getByRole('heading', { level: 2, name });
/** Τα βελάκια πάνω στη σκηνή (όχι η μεγέθυνση). */
const stageArrows = () => within(screen.getByRole('application').closest('figure') as HTMLElement).getAllByRole('button', { hidden: true })
  .filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('spatial-tour:viewer.goTo'));
/** Ο επισκέπτης στρέφει τη ματιά (πληκτρολόγιο) — νέα θέαση ⇒ ο streamer ξαναϋπολογίζει. */
const turnCamera = () => fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
const tileRequestsFor = (nodeId: string) =>
  (source.tiles?.tile as jest.Mock).mock.calls.filter(([stop]: [{ nodeId: string }]) => stop.nodeId === nodeId).length;

describe('TourViewer — πρώτη εικόνα και προσφορές', () => {
  it('ξεκινά στο χαμηλότερο όροφο, πρώτο σημείο, με την κατεύθυνση ΑΥΤΗΣ της λήψης· το όνομα του χώρου στην κορυφή', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledWith(FACES, 0, expect.any(String)));
    expect(hereHeading(P(1))).toBeInTheDocument();
  });

  it('βελάκια στη σκηνή = οι γείτονες ΜΕ στάση και κατεύθυνση (ποτέ ο κόμβος χωρίς λήψη)', async () => {
    await renderViewer();
    expect(stageArrows().map((b) => b.getAttribute('aria-label'))).toEqual([
      `spatial-tour:viewer.goTo:${P(2)}`, `spatial-tour:viewer.goTo:${P(4)}`,
    ]);
  });

  it('στήλη Zillow: ΟΛΟΙ οι όροφοι μαζί, ο πάνω πρώτος· κάθε σημείο στη λίστα, το τρέχον σημειωμένο', async () => {
    await renderViewer();
    expect(panel().getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'spatial-tour:viewer.floorNumbered:1', 'spatial-tour:viewer.floorNumbered:0',
    ]);
    expect(floorList(0).getAllByRole('button')).toHaveLength(4);
    expect(floorList(0).getByRole('button', { name: `spatial-tour:viewer.youAreHere:${P(1)}` })).toHaveAttribute('aria-current', 'location');
  });

  it('κάτοψη μόνο στον όροφο που έχει θέσεις· «είστε εδώ» στον τρέχοντα κόμβο', async () => {
    await renderViewer();
    expect(panel().getAllByRole('group', { name: 'spatial-tour:viewer.plan' })).toHaveLength(1);
    const plan = floorSection(0).getByRole('group', { name: 'spatial-tour:viewer.plan' });
    expect(within(plan).getByRole('button', { name: `spatial-tour:viewer.youAreHere:${P(1)}` })).toHaveAttribute('aria-current', 'location');
  });

  it('Φ2στ — δηλωμένος χώρος: το βελάκι και η επικεφαλίδα λένε τον χώρο, όχι «Σημείο N»', async () => {
    const kitchen = { types: ['kitchen'] as const, label: null, source: 'manual' as const };
    await renderViewer({ ...DEMO_TOUR_MANIFEST, nodes: DEMO_TOUR_MANIFEST.nodes.map((n) => (n.id === 'g2' ? { ...n, room: kitchen } : n)) });
    const arrow = stageArrows().find((b) => b.getAttribute('aria-label') === 'spatial-tour:viewer.goTo:spatial-tour:rooms.types.kitchen');
    expect(arrow).toHaveTextContent('spatial-tour:rooms.types.kitchen');
    await act(async () => { fireEvent.click(arrow!); });
    await waitFor(() => expect(hereHeading('spatial-tour:rooms.types.kitchen')).toBeInTheDocument());
  });
});

describe('TourViewer — πλοήγηση', () => {
  it('σημείο άλλου ορόφου από τη στήλη ⇒ μετάβαση εκεί, με την κατεύθυνση της λήψης του', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(goButton(1, 1)); });
    await waitFor(() => expect(floorList(1).getByRole('button', { name: `spatial-tour:viewer.youAreHere:${P(1)}` })).toHaveAttribute('aria-current', 'location'));
    await waitFor(() => expect(engine.showNow).toHaveBeenLastCalledWith(FACES, expect.closeTo(Math.PI / 4, 6), expect.any(String)));
  });

  it('κλικ σε κόμβο της κάτοψης ⇒ μετάβαση εκεί', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    const plan = floorSection(0).getByRole('group', { name: 'spatial-tour:viewer.plan' });
    await act(async () => { fireEvent.click(within(plan).getByRole('button', { name: `spatial-tour:viewer.goTo:${P(2)}` })); });
    await waitFor(() => expect(hereHeading(P(2))).toBeInTheDocument());
  });

  it('αργή ΠΡΩΤΗ εικόνα που φτάνει μετά τη μετάβαση ⇒ ΔΕΝ ζωγραφίζεται πάνω στο νέο σημείο (ζωντανά, ADR-884 Φ2δ)', async () => {
    const LATE = { late: true } as unknown as TourCubeFaceImages;
    const original = (source.base as jest.Mock).getMockImplementation();
    let releaseFirst: () => void = () => undefined;
    (source.base as jest.Mock).mockImplementation(async (stop: { nodeId: string }) => {
      if (stop.nodeId !== 'g1') return FACES;
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      return LATE;
    });
    try {
      await renderViewer();
      await act(async () => { fireEvent.click(goButton(2)); });
      await waitFor(() => expect(hereHeading(P(2))).toBeInTheDocument());
      await act(async () => { releaseFirst(); await new Promise((r) => setTimeout(r, 0)); });
      expect(engine.showNow).not.toHaveBeenCalledWith(LATE, expect.anything(), expect.anything());
    } finally {
      (source.base as jest.Mock).mockImplementation(original);
    }
  });

  it('η άφιξη ΔΕΝ περιμένει τα πλακίδια — «είστε εδώ» με τη βάση, πλακίδια μετά ΣΤΗ ΝΕΑ στάση (ζωντανά Φ2δ · Φ2ε)', async () => {
    const tile = source.tiles?.tile as jest.Mock;
    const original = tile.getMockImplementation();
    let releaseTiles: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { releaseTiles = resolve; });
    tile.mockImplementation(async (stop: { nodeId: string }) => {
      if (stop.nodeId === 'g2') await gate;
      return TILE;
    });
    try {
      await renderViewer();
      await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
      engine.putTile.mockClear();
      await act(async () => { fireEvent.click(goButton(2)); });
      await waitFor(() => expect(hereHeading(P(2))).toBeInTheDocument());
      const arrivedKey = engine.showNow.mock.calls.at(-1)?.[2];
      expect(engine.putTile.mock.calls.filter((c) => c[0] === arrivedKey)).toHaveLength(0);
      await act(async () => { releaseTiles(); await new Promise((r) => setTimeout(r, 0)); });
      await waitFor(() => expect(engine.putTile.mock.calls.some((c) => c[0] === arrivedKey)).toBe(true));
    } finally {
      tile.mockImplementation(original);
    }
  });

  it('το πανόραμα δεν φορτώθηκε ⇒ μένει στο σημείο του, με μήνυμα (ποτέ μαύρο) — και τα πλακίδια του ΞΑΝΑΡΕΟΥΝ (M15β)', async () => {
    failing = new Set(['g2']);
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(goButton(2)); });
    expect(await screen.findByRole('alert')).toHaveTextContent('spatial-tour:viewer.loadFailed');
    expect(hereHeading(P(1))).toBeInTheDocument();
    (source.tiles?.tile as jest.Mock).mockClear();
    await act(async () => { turnCamera(); await new Promise((r) => setTimeout(r, 0)); });
    expect(tileRequestsFor('g1')).toBeGreaterThan(0);
  });

  it('M16 καλωδίωση — άφιξη προς τα πού περπάτησε: g1(0,0) → g2(4,0), heading g2 = 90° ⇒ yaw 0 (όχι 180°, πίσω)', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(goButton(2)); });
    await waitFor(() => expect(hereHeading(P(2))).toBeInTheDocument());
    expect(Math.cos(engine.setView.mock.calls.at(-1)?.[0].yaw ?? NaN)).toBeCloseTo(1, 9);
  });

  it('στη μετάβαση ΚΑΝΕΝΑ πλακίδιο της αφετηρίας — η ουρά ανήκει στον προορισμό (ζωντανά 2026-09-27, M15)', async () => {
    const original = (source.base as jest.Mock).getMockImplementation();
    let releaseTarget: () => void = () => undefined;
    (source.base as jest.Mock).mockImplementation(async (stop: { nodeId: string }) => {
      if (stop.nodeId === 'g2') await new Promise<void>((resolve) => { releaseTarget = resolve; });
      return FACES;
    });
    try {
      await renderViewer();
      await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
      await act(async () => { fireEvent.click(goButton(2)); });
      (source.tiles?.tile as jest.Mock).mockClear();
      await act(async () => { turnCamera(); await new Promise((r) => setTimeout(r, 0)); });
      expect(tileRequestsFor('g1')).toBe(0);
      await act(async () => { releaseTarget(); await new Promise((r) => setTimeout(r, 0)); });
      await waitFor(() => expect(hereHeading(P(2))).toBeInTheDocument());
    } finally {
      (source.base as jest.Mock).mockImplementation(original);
    }
  });
});

describe('TourViewer — χωρίς WebGL', () => {
  it('εξήγηση + σημεία ανά όροφο, καμία μηχανή', async () => {
    webgl = false;
    await renderViewer();
    expect(screen.getByRole('status')).toHaveTextContent('spatial-tour:viewer.noWebgl');
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(engine.showNow).not.toHaveBeenCalled();
  });
});
