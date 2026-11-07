/**
 * **Η μηχανή του ζουμ σελίδας εγγράφου** (ADR-928 §5.25) — ο ΕΝΑΣ κάτοχος του ζουμ για όλες τις γλωσσικές στήλες.
 *
 * 🔑 Μηδέν React state στη διαδρομή του pixel: το πλάτος/ζουμ γράφεται **προστακτικά** στις σελίδες (ADR-040)· το React
 *    μαθαίνει μόνο το **στιγμιότυπο** `{ zoom, fitted }` (`useSyncExternalStore`), και μόνο όταν αλλάξει — δηλαδή
 *    ξαναζωγραφίζεται η μπάρα, ποτέ το έγγραφο.
 * 🔑 Ένα ζουμ για όλες τις στήλες: κάθε στήλη **δηλώνεται** (`registerColumn`)· η «Προσαρμογή» μετρά τη στενότερη.
 * 🔑 Ctrl/⌘ + ροδέλα (και pinch του trackpad, που φτάνει ως `wheel` με `ctrlKey`) **μόνο** πάνω στη σελίδα: έξω από
 *    αυτήν, το ζουμ του browser μένει ανέγγιχτο (WCAG 1.4.4 — Google Docs).
 * 🔑 Η προτίμηση γράφεται **μετά** την κίνηση (debounce), όχι 60 φορές το δευτερόλεπτο.
 */

import { captureZoomAnchor, readingPointOf, restoreZoomAnchor, type ZoomAnchor } from '@/components/shared/media/viewer/zoom-anchor';
import { ladderZoom, WHEEL_ZOOM_SENSITIVITY, wheelDeltaPx, wheelZoom, type Vec2 } from '@/lib/geometry/zoom-pan-math';

import { readPaperZoomMode, writePaperZoomMode } from './document-zoom-preference';
import { applyPaperLayout, PAPER_ZOOM_FIT, PAPER_ZOOM_LIMITS, paperLayoutOf, type PaperZoomMode } from './paper-fit';

/** Ό,τι δείχνει η μπάρα. `fitted` ⇒ «Προσαρμογή στο πλάτος» ενεργή. */
export interface DocumentZoomSnapshot {
  readonly zoom: number;
  readonly fitted: boolean;
}

export interface DocumentZoomEngine {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => DocumentZoomSnapshot;
  /** Μια γλωσσική στήλη: το πλαίσιο που μετριέται και η σελίδα που μεγεθύνεται. Επιστρέφει την αποδέσμευση. */
  readonly registerColumn: (frame: HTMLElement, page: HTMLElement) => () => void;
  readonly step: (direction: 1 | -1) => void;
  readonly zoomTo: (zoom: number) => void;
  readonly fit: () => void;
  /** Ποιανού η προτίμηση (uid) — `null` πριν φορτώσει ο χρήστης. */
  readonly bindUser: (uid: string | null) => void;
  /**
   * Γράφει αμέσως ό,τι περιμένει στο debounce (αποχώρηση από τη σελίδα). ⚠️ Δεν «σκοτώνει» τη μηχανή: το StrictMode
   * ξαναπροσαρτά το ίδιο instance — ο παρατηρητής αδειάζει μόνος του με την αποδέσμευση κάθε στήλης.
   */
  readonly flush: () => void;
}

const PERSIST_DELAY_MS = 300;

interface Column {
  readonly frame: HTMLElement;
  readonly page: HTMLElement;
  readonly onWheel: (event: WheelEvent) => void;
}

interface EngineState {
  readonly columns: Column[];
  readonly listeners: Set<() => void>;
  zoomMode: PaperZoomMode;
  snapshot: DocumentZoomSnapshot;
  uid: string | null;
  persistTimer: ReturnType<typeof setTimeout> | null;
  observer: ResizeObserver | null;
}

function createState(): EngineState {
  return {
    columns: [], listeners: new Set(), zoomMode: PAPER_ZOOM_FIT, snapshot: { zoom: 1, fitted: true },
    uid: null, persistTimer: null, observer: null,
  };
}

/** Εφαρμόζει τον τρόπο ζουμ σε όλες τις σελίδες και ειδοποιεί **μόνο** αν άλλαξε ό,τι δείχνει η μπάρα. */
function relayout(state: EngineState): void {
  const layout = paperLayoutOf(state.zoomMode, state.columns.map((column) => column.frame.clientWidth));
  for (const column of state.columns) applyPaperLayout(column.page, layout);
  const fitted = state.zoomMode.mode === 'fit';
  if (layout.zoom === state.snapshot.zoom && fitted === state.snapshot.fitted) return;
  state.snapshot = { zoom: layout.zoom, fitted };
  for (const listener of state.listeners) listener();
}

function schedulePersist(state: EngineState): void {
  if (state.persistTimer !== null) clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(() => {
    state.persistTimer = null;
    writePaperZoomMode(state.uid, state.zoomMode);
  }, PERSIST_DELAY_MS);
}

/** Η άγκυρα μιας αλλαγής: το σημείο του δείκτη, αλλιώς η παράγραφος ανάγνωσης της πρώτης στήλης. */
function anchorFor(state: EngineState, column: Column | undefined, point: Vec2 | null): ZoomAnchor | null {
  const target = column ?? state.columns[0];
  if (!target) return null;
  return captureZoomAnchor(target.page, target.frame, point ?? readingPointOf(target.page, target.frame));
}

/** Η μία πόρτα κάθε αλλαγής **από τον άνθρωπο**: άγκυρα → διάταξη → επαναφορά άγκυρας → αποθήκευση. */
function changeZoom(state: EngineState, next: PaperZoomMode, column?: Column, point: Vec2 | null = null): void {
  const anchor = anchorFor(state, column, point);
  state.zoomMode = next;
  relayout(state);
  if (anchor) restoreZoomAnchor(anchor);
  schedulePersist(state);
}

/**
 * Το ζουμ από το οποίο ξεκινά η επόμενη κίνηση: στο χειροκίνητο το **ακριβές** (όχι το στρογγυλεμένο του στιγμιότυπου —
 * αλλιώς μικρά βήματα pinch ×1,005 χάνονταν στη στρογγύλευση και η μεγέθυνση «κολλούσε»)· στην «Προσαρμογή» αυτό που φαίνεται.
 */
function currentZoomOf(state: EngineState): number {
  return state.zoomMode.mode === 'manual' ? state.zoomMode.zoom : state.snapshot.zoom;
}

function wheelHandlerOf(state: EngineState, getColumn: () => Column): (event: WheelEvent) => void {
  return (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const from = currentZoomOf(state);
    const zoom = wheelZoom(from, wheelDeltaPx(event), WHEEL_ZOOM_SENSITIVITY, PAPER_ZOOM_LIMITS);
    if (zoom === from && state.zoomMode.mode === 'manual') return;
    changeZoom(state, { mode: 'manual', zoom }, getColumn(), { x: event.clientX, y: event.clientY });
  };
}

function registerColumnIn(state: EngineState, frame: HTMLElement, page: HTMLElement): () => void {
  const column: Column = { frame, page, onWheel: wheelHandlerOf(state, () => column) };
  const { onWheel } = column;
  state.columns.push(column);
  frame.addEventListener('wheel', onWheel, { passive: false });
  state.observer?.observe(frame);
  relayout(state);
  return () => {
    frame.removeEventListener('wheel', onWheel);
    state.observer?.unobserve(frame);
    state.columns.splice(state.columns.indexOf(column), 1);
    applyPaperLayout(page, { widthPx: null, zoom: 1 });
    relayout(state);
  };
}

function bindUserIn(state: EngineState, uid: string | null): void {
  if (uid === state.uid) return;
  state.uid = uid;
  state.zoomMode = readPaperZoomMode(uid);
  relayout(state);
}

/** Χωρίς `ResizeObserver` (jsdom) ⇒ η διάταξη υπολογίζεται μόνο στις δηλώσεις και τις αλλαγές. */
export function createDocumentZoomEngine(): DocumentZoomEngine {
  const state = createState();
  state.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => relayout(state));
  return {
    subscribe: (listener) => {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
    getSnapshot: () => state.snapshot,
    registerColumn: (frame, page) => registerColumnIn(state, frame, page),
    step: (direction) => changeZoom(state, { mode: 'manual', zoom: ladderZoom(currentZoomOf(state), PAPER_ZOOM_LIMITS, direction) }),
    zoomTo: (zoom) => changeZoom(state, { mode: 'manual', zoom }),
    fit: () => changeZoom(state, PAPER_ZOOM_FIT),
    bindUser: (uid) => bindUserIn(state, uid),
    flush: () => {
      if (state.persistTimer !== null) {
        clearTimeout(state.persistTimer);
        writePaperZoomMode(state.uid, state.zoomMode);
      }
    },
  };
}
