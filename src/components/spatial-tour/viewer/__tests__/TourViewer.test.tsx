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
  projectUnclipped: jest.fn(() => ({ x: 10, y: 10 })),
  unproject: jest.fn(() => ({ yaw: 0, pitch: 0 })),
  onFrame: jest.fn(() => () => undefined),
  dispose: jest.fn(),
};
jest.mock('../tour-panorama-engine', () => ({ createTourPanoramaEngine: () => engine }));

import { TooltipProvider } from '@/components/ui/tooltip';
import { TestPointerEvent, installPointerEvents } from '@/test-utils/pointer-event';
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

/** Το jsdom δεν έχει `PointerEvent` ούτε `setPointerCapture` — ό,τι χρειάζεται η είσοδος του καμβά (`test-utils/pointer-event`). */
beforeAll(() => {
  installPointerEvents();
  global.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
});
/**
 * Το jsdom δεν έχει διάταξη (πλάτος 0 ⇒ «στενός» θεατής ⇒ `Sheet`). Ο θεατής αποφασίζει στήλη/`Sheet` από το **δικό του**
 * πλάτος (Φ2στ-γ Γ2) — εδώ δηλώνεται μια οθόνη υπολογιστή· το `viewerWidth` την αλλάζει για τον κλάδο του κινητού.
 */
let viewerWidth = 1280;
beforeEach(() => {
  viewerWidth = 1280;
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, viewerWidth, 800));
});
afterEach(() => jest.restoreAllMocks());
beforeEach(() => {
  webgl = true;
  failing = new Set();
  jest.clearAllMocks();
});

/** Η πρώτη εικόνα φορτώνει ασύγχρονα — η απόδοση περιμένει να κατακάτσει (καμία ενημέρωση εκτός `act`). */
const renderViewer = async (manifest: TourManifest = DEMO_TOUR_MANIFEST) => {
  // Ο `TooltipProvider` έρχεται από το layout της σελίδας (`(light)` — ADR-813)· εδώ τον δίνει το test.
  await act(async () => { render(<TooltipProvider><TourViewer manifest={manifest} source={source} /></TooltipProvider>); });
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

  it('Φ2στ-β — καμία τελεία (ούτε η «εδώ») δεν αφήνει το περίγραμμα εστίασης του browser: στο SVG μετριέται σε ΜΕΤΡΑ', async () => {
    await renderViewer();
    const plan = floorSection(0).getByRole('group', { name: 'spatial-tour:viewer.plan' });
    const dots = within(plan).getAllByRole('button');
    expect(dots.length).toBeGreaterThan(1);
    for (const dot of dots) expect(dot).toHaveClass('outline-none');
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

describe('TourViewer — πάτημα στο πάτωμα (Φ2στ-γ · §4.14, πρότυπο Zillow)', () => {
  // g1 (0,0) heading 0 · γείτονες: g2 (4,0) ανατολικά = yaw 90° · g4 (0,3) βόρεια = yaw 0.
  const pointerAt = (type: string, x: number) => fireEvent(screen.getByRole('application'), new TestPointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 0 }));
  const floorUnder = (yawDeg: number) => engine.unproject.mockReturnValue({ yaw: (yawDeg * Math.PI) / 180, pitch: -0.45 });
  afterEach(() => { engine.unproject.mockReturnValue({ yaw: 0, pitch: 0 }); });

  it('πάτημα χωρίς σύρσιμο ⇒ η πλησιέστερη ΣΥΝΔΕΔΕΜΕΝΗ στάση προς τα εκεί', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    floorUnder(88);
    await act(async () => { pointerAt('pointerdown', 0); pointerAt('pointerup', 0); });
    await waitFor(() => expect(hereHeading(P(2))).toBeInTheDocument());
  });

  it('σύρσιμο (ματιά) ⇒ ΚΑΜΙΑ μετάβαση', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    floorUnder(88);
    await act(async () => { pointerAt('pointerdown', 0); pointerAt('pointermove', 30); pointerAt('pointerup', 0); });
    expect(hereHeading(P(1))).toBeInTheDocument();
  });

  it('πάτημα προς κατεύθυνση χωρίς στάση ⇒ μένει εκεί (ποτέ τηλεμεταφορά)', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    floorUnder(-135);
    await act(async () => { pointerAt('pointerdown', 0); pointerAt('pointerup', 0); });
    expect(hereHeading(P(1))).toBeInTheDocument();
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

describe('TourViewer — Γ2: διαχωριστική + μεγέθυνση κάτοψης (Φ2στ-γ · §4.14 σημεία 3 + 5)', () => {
  const COLUMN_KEY = 'nestor:tour-plan-column:v1';
  const separator = () => screen.getByRole('separator', { name: 'spatial-tour:viewer.resizeColumn' });
  const cardPlan = () => floorSection(0).getByRole('group', { name: 'spatial-tour:viewer.plan' });
  const zoomIn = () => floorSection(0).getByRole('button', { name: 'spatial-tour:viewer.planZoomIn' });
  const radius = (plan: HTMLElement) => Number(within(plan).getAllByRole('button')[0].getAttribute('r'));
  const viewBoxWidth = (plan: HTMLElement) => Number((plan.getAttribute('viewBox') ?? '').split(' ')[2]);
  const nextFrame = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });

  beforeEach(() => localStorage.clear());

  it('πλατύς θεατής ⇒ WAI-ARIA διαχωριστικό με όνομα, εστιάσιμο· η στήλη ΔΕΝ είναι σε Sheet', async () => {
    await renderViewer();
    expect(separator()).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('button', { name: /spatial-tour:viewer\.openPanel/ })).not.toBeInTheDocument();
    expect(panel().getAllByRole('region')).toHaveLength(2);
  });

  it('στενός θεατής (ο ΔΙΚΟΣ του χώρος, όχι το παράθυρο) ⇒ κανένα διαχωριστικό, η στήλη πίσω από κουμπί', async () => {
    viewerWidth = 700;
    await renderViewer();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spatial-tour:viewer\.openPanel/ })).toBeInTheDocument();
  });

  // ⚠️ Το «βέλος ⇒ εγγραφή» και το «κουμπί ⇒ σύμπτυξη» ΔΕΝ ελέγχονται εδώ: η βιβλιοθήκη πετά «Previous layout not found»
  // στο jsdom (καμία διάταξη) — ίδιο όριο με το ADR-724 (`WorkspaceSplitLayout.test`). Η λογική της εγγραφής κλειδώνεται
  // στο `components/ui/__tests__/resizable-persistence.test.tsx`· η σύμπτυξη επαληθεύεται ζωντανά (ADR-884 §4.14).
  it('το πλάτος ΔΕΝ γράφεται επειδή άνοιξε η σελίδα, ούτε με Tab πάνω στο διαχωριστικό', async () => {
    await renderViewer();
    await nextFrame();
    fireEvent.keyDown(separator(), { key: 'Tab' });
    await nextFrame();
    expect(localStorage.getItem(COLUMN_KEY)).toBeNull();
  });

  it('κουμπί ▯| : ελέγχει τη στήλη (aria-controls) και θυμάται την απόκρυψη από την προηγούμενη επίσκεψη', async () => {
    localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: 400, collapsed: true }));
    await renderViewer();
    const show = screen.getByRole('button', { name: 'spatial-tour:viewer.planColumnShow' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(show.getAttribute('aria-controls') ?? '')).not.toBeNull();
  });

  it('«+» ⇒ στενότερο viewBox, αλλά η τελεία μένει ΙΔΙΑ στην οθόνη (ακτίνα ÷ ζουμ)', async () => {
    await renderViewer();
    const before = { width: viewBoxWidth(cardPlan()), r: radius(cardPlan()) };
    await act(async () => { fireEvent.click(zoomIn()); });
    const after = { width: viewBoxWidth(cardPlan()), r: radius(cardPlan()) };
    expect(after.width).toBeCloseTo(before.width / 1.5);
    expect(after.r / after.width).toBeCloseTo(before.r / before.width);
    expect(floorSection(0).getByRole('button', { name: 'spatial-tour:viewer.planZoomOut' })).toBeEnabled();
  });

  it('τροχός στη στήλη: σκέτος ⇒ κυλά τη στήλη (καμία μεγέθυνση)· Ctrl + τροχός ⇒ μεγέθυνση', async () => {
    await renderViewer();
    const width = viewBoxWidth(cardPlan());
    fireEvent.wheel(cardPlan(), { deltaY: -200, clientX: 100, clientY: 100 });
    expect(viewBoxWidth(cardPlan())).toBe(width);
    await act(async () => { fireEvent.wheel(cardPlan(), { deltaY: -200, clientX: 100, clientY: 100, ctrlKey: true }); });
    expect(viewBoxWidth(cardPlan())).toBeLessThan(width);
  });

  it('↗ ανάπτυξη: ΙΔΙΑ θέαση με την κάρτα· κλικ σε τελεία ⇒ μετάβαση ΚΑΙ κλείσιμο', async () => {
    await renderViewer();
    await waitFor(() => expect(engine.showNow).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(zoomIn()); });
    const cardViewBox = cardPlan().getAttribute('viewBox');
    await act(async () => { fireEvent.click(floorSection(0).getByRole('button', { name: 'spatial-tour:viewer.planExpand' })); });
    const dialog = await screen.findByRole('dialog');
    const expanded = within(dialog).getByRole('group', { name: 'spatial-tour:viewer.plan' });
    expect(expanded.getAttribute('viewBox')).toBe(cardViewBox);
    await act(async () => { fireEvent.click(within(expanded).getByRole('button', { name: `spatial-tour:viewer.goTo:${P(2)}` })); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(hereHeading(P(2))).toBeInTheDocument());
  });
});
