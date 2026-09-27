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

const FACES = {} as TourCubeFaceImages;
const TILE = { width: 512, height: 512 } as TourFaceImage;
let failing = new Set<string>();
const source: TourPanoramaSource = {
  base: jest.fn(async (stop) => {
    if (failing.has(stop.nodeId)) throw new Error('offline');
    return FACES;
  }),
  tiles: { levels: () => [512], tile: jest.fn(async () => TILE) },
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
const renderViewer = async () => {
  await act(async () => { render(<TourViewer manifest={DEMO_TOUR_MANIFEST} source={source} />); });
};
const nearby = () => within(screen.getByRole('navigation', { name: 'spatial-tour:viewer.nearby' }));

describe('TourViewer — πρώτη εικόνα και προσφορές', () => {
  it('ξεκινά στο χαμηλότερο όροφο, πρώτο σημείο, με την κατεύθυνση ΑΥΤΗΣ της λήψης', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledWith(FACES, 0, expect.any(String)));
    expect(screen.getByText('spatial-tour:viewer.youAreHere:1')).toBeInTheDocument();
  });

  it('επόμενα σημεία = οι γείτονες ΜΕ στάση (ποτέ ο κόμβος χωρίς λήψη)', async () => {
    await renderViewer();
    const names = nearby().getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['spatial-tour:viewer.point:2', 'spatial-tour:viewer.point:4']);
  });

  it('επιλογέας ορόφων από πάνω προς τα κάτω, ο τρέχων πατημένος', async () => {
    await renderViewer();
    const floors = within(screen.getByRole('navigation', { name: 'spatial-tour:viewer.floors' })).getAllByRole('button');
    expect(floors.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['spatial-tour:viewer.floorNumbered:1', 'false'],
      ['spatial-tour:viewer.floorNumbered:0', 'true'],
    ]);
  });

  it('κάτοψη μόνο στον όροφο που έχει· «είστε εδώ» στον τρέχοντα κόμβο', async () => {
    await renderViewer();
    const plan = screen.getByRole('group', { name: 'spatial-tour:viewer.plan' });
    const here = within(plan).getByRole('button', { name: 'spatial-tour:viewer.youAreHere:1' });
    expect(here).toHaveAttribute('aria-current', 'location');
  });
});

describe('TourViewer — πλοήγηση', () => {
  it('αλλαγή ορόφου ⇒ πρώτο σημείο του ορόφου, χωρίς κάτοψη εκεί, σκάλα με ετικέτα ορόφου', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:viewer.floorNumbered:1' })); });
    await waitFor(() => expect(screen.getByText('spatial-tour:viewer.youAreHere:1')).toBeInTheDocument());
    await waitFor(() => expect(engine.showNow).toHaveBeenLastCalledWith(FACES, expect.closeTo(Math.PI / 4, 6), expect.any(String)));
    expect(screen.queryByRole('complementary', { name: 'spatial-tour:viewer.plan' })).toBeNull();
    expect(nearby().getAllByRole('button').map((b) => b.textContent)).toEqual([
      'spatial-tour:viewer.pointOnFloor:2|spatial-tour:viewer.floorNumbered:0',
      'spatial-tour:viewer.point:2',
    ]);
  });

  it('κλικ σε κόμβο της κάτοψης ⇒ μετάβαση εκεί', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    const plan = screen.getByRole('group', { name: 'spatial-tour:viewer.plan' });
    await act(async () => { fireEvent.click(within(plan).getByRole('button', { name: 'spatial-tour:viewer.goTo:2' })); });
    await waitFor(() => expect(screen.getByText('spatial-tour:viewer.youAreHere:2')).toBeInTheDocument());
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
      await act(async () => { fireEvent.click(nearby().getByRole('button', { name: 'spatial-tour:viewer.goTo:2' })); });
      await waitFor(() => expect(screen.getByText('spatial-tour:viewer.youAreHere:2')).toBeInTheDocument());
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
      await act(async () => { fireEvent.click(nearby().getByRole('button', { name: 'spatial-tour:viewer.goTo:2' })); });
      await waitFor(() => expect(screen.getByText('spatial-tour:viewer.youAreHere:2')).toBeInTheDocument());
      const arrivedKey = engine.showNow.mock.calls.at(-1)?.[2];
      expect(engine.putTile.mock.calls.filter((c) => c[0] === arrivedKey)).toHaveLength(0);
      await act(async () => { releaseTiles(); await new Promise((r) => setTimeout(r, 0)); });
      await waitFor(() => expect(engine.putTile.mock.calls.some((c) => c[0] === arrivedKey)).toBe(true));
    } finally {
      tile.mockImplementation(original);
    }
  });

  it('το πανόραμα δεν φορτώθηκε ⇒ μένει στο σημείο του, με μήνυμα (ποτέ μαύρο)', async () => {
    failing = new Set(['g2']);
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(nearby().getByRole('button', { name: 'spatial-tour:viewer.goTo:2' })); });
    expect(await screen.findByRole('alert')).toHaveTextContent('spatial-tour:viewer.loadFailed');
    expect(screen.getByText('spatial-tour:viewer.youAreHere:1')).toBeInTheDocument();
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
