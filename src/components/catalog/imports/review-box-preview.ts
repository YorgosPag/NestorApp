'use client';

/**
 * @fileoverview **Ποιο πλαίσιο του PDF προεπισκοπείται** (ADR-923 §5.5.2 Β8 βήμα Β) — ο ελεγκτής του ΕΝΟΣ popover: hover με
 *   καθυστέρηση, εστίαση αμέσως, αφή ως toggletip, και ο «διάδρομος» που αφήνει τον δείκτη να μπει μέσα στο popover.
 * @module components/catalog/imports/review-box-preview
 *
 * 🔑 **WCAG 1.4.13** (Content on Hover or Focus): *dismissible* (Esc, χωρίς να κουνηθεί ο δείκτης) · *hoverable* (ο δείκτης περνά
 *    μέσα χωρίς να χαθεί — καθυστέρηση κλεισίματος) · *persistent* (μένει όσο ο δείκτης **ή** η εστίαση είναι πάνω του).
 * 🔑 Τρεις πηγές, μία απάντηση: `focus ?? hover ?? touch`. Κλικ σε πλαίσιο στέλνει την εστίαση στη λίστα — το popover **μένει**,
 *    γιατί ο δείκτης είναι ακόμη εκεί (μετρημένο σχήμα: αλλιώς έκλεινε κάτω από το ποντίκι).
 * 🔑 **Εξωτερικό store** πάνω στο `createExternalStore` (όπως το `review-hover-store`): μια κίνηση του ποντικιού ξαναζωγραφίζει
 *    **μόνο** το popover και το πλαίσιο που άλλαξε `aria-expanded` — ποτέ τα δεκάδες πλαίσια της σελίδας.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { createExternalStore } from '@/lib/state/createExternalStore';

/** Σημάδι που φέρει κάθε πλαίσιο — το «έξω» κλικ πάνω σε άλλο πλαίσιο το χειρίζεται το πλαίσιο, όχι το popover. */
export const REVIEW_BOX_ATTRIBUTE = 'data-review-box';

/** Καθυστέρηση ανοίγματος σε hover: το πέρασμα του ποντικιού πάνω από τη σελίδα δεν ανάβει 20 popovers. */
const OPEN_DELAY_MS = 300;
/** Καθυστέρηση κλεισίματος: ο διάδρομος από το πλαίσιο ως το popover (1.4.13 *hoverable*). */
const CLOSE_DELAY_MS = 200;

export interface BoxPreview {
  readonly boxId: string;
  /** Το στοιχείο του πλαισίου — η άγκυρα του popover και ο προορισμός της εστίασης στο Esc. */
  readonly element: SVGGraphicsElement;
}

export interface BoxPreviewController {
  readonly get: () => BoxPreview | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly pointerEnter: (preview: BoxPreview) => void;
  readonly pointerLeave: () => void;
  readonly focusBox: (preview: BoxPreview) => void;
  readonly blur: () => void;
  /** Ο δείκτης ή η εστίαση μπήκε στο popover: ό,τι δείχνεται, μένει. */
  readonly holdPointer: () => void;
  readonly holdFocus: () => void;
  readonly tap: (preview: BoxPreview) => void;
  /** Esc / ενέργεια: κλείνει, και το ίδιο πλαίσιο **δεν** ξανανοίγει μόλις του επιστρέψει η εστίαση (1.4.13 *dismissible*). */
  readonly close: () => void;
  /** Το δοχείο του popover — για να ξέρει το πλαίσιο αν η εστίαση φεύγει **προς** αυτό. */
  readonly attachContent: (element: HTMLElement | null) => void;
  readonly contains: (node: EventTarget | null) => boolean;
  /** Tab από το πλαίσιο ⇒ στο πρώτο κουμπί του popover. `false` = δεν έχει κουμπιά, ο Tab συνεχίζει κανονικά. */
  readonly enterContent: () => boolean;
  /** Το πλαίσιο έφυγε από τη σελίδα (άλλη σελίδα · ξαναχτισμένος πίνακας): καμία άγκυρα στον αέρα. */
  readonly release: (boxId: string) => void;
  readonly dispose: () => void;
}

const sameBox = (a: BoxPreview | null, b: BoxPreview | null): boolean => a?.boxId === b?.boxId && a?.element === b?.element;

/** Η κατάσταση των τριών πηγών — ιδιωτική στον ελεγκτή. */
interface PreviewSources {
  hover: BoxPreview | null;
  focus: BoxPreview | null;
  touch: BoxPreview | null;
  /** Το πλαίσιο που ο άνθρωπος έκλεισε· ξανανοίγει μόνο όταν φύγει από αυτό (δείκτης **ή** εστίαση). */
  dismissed: string | null;
  content: HTMLElement | null;
}

/** Οι δύο χρονοδιακόπτες του ελεγκτή: η επόμενη εφαρμογή ακυρώνει την προηγούμενη. */
function createScheduler() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const later = (ms: number, run: () => void) => {
    cancel();
    timer = setTimeout(run, ms);
  };
  return { cancel, later };
}

/** Κάθε πηγή που δείχνει σε πλαίσιο που έφυγε, ξεχνιέται. */
function forgetBox(src: PreviewSources, boxId: string): void {
  if (src.hover?.boxId === boxId) src.hover = null;
  if (src.focus?.boxId === boxId) src.focus = null;
  if (src.touch?.boxId === boxId) src.touch = null;
}

const firstButtonOf =(content: HTMLElement | null): HTMLButtonElement | null =>
  content?.querySelector<HTMLButtonElement>('button:not([disabled])') ?? null;

export function createBoxPreview(): BoxPreviewController {
  const store = createExternalStore<BoxPreview | null>(null, { equals: sameBox });
  const src: PreviewSources = { hover: null, focus: null, touch: null, dismissed: null, content: null };
  const { cancel, later } = createScheduler();
  const apply = () => {
    cancel();
    const next = src.focus ?? src.hover ?? src.touch;
    store.set(next !== null && next.boxId === src.dismissed ? null : next);
  };
  /** Κίνηση προς **άλλο** πλαίσιο ακυρώνει την απόρριψη· στο ίδιο, την κρατά. */
  const arrive = (preview: BoxPreview) => {
    if (src.dismissed !== preview.boxId) src.dismissed = null;
  };
  const release = (boxId: string) => {
    forgetBox(src, boxId);
    if (store.get()?.boxId === boxId) apply();
  };
  return {
    get: store.get,
    subscribe: store.subscribe,
    pointerEnter: (preview) => { arrive(preview); src.hover = preview; if (sameBox(store.get(), preview)) cancel(); else later(OPEN_DELAY_MS, apply); },
    pointerLeave: () => { src.hover = null; src.dismissed = src.focus === null ? null : src.dismissed; later(CLOSE_DELAY_MS, apply); },
    focusBox: (preview) => { arrive(preview); src.focus = preview; apply(); },
    blur: () => { src.focus = null; src.dismissed = src.hover === null ? null : src.dismissed; later(CLOSE_DELAY_MS, apply); },
    holdPointer: () => { src.hover = store.get(); cancel(); },
    holdFocus: () => { src.focus = store.get(); cancel(); },
    tap: (preview) => { arrive(preview); src.touch = preview; apply(); },
    close: () => { src.dismissed = store.get()?.boxId ?? null; src.hover = null; src.focus = null; src.touch = null; apply(); },
    attachContent: (element) => { src.content = element; },
    contains: (node) => node instanceof Node && src.content?.contains(node) === true,
    enterContent: () => {
      const first = firstButtonOf(src.content);
      first?.focus();
      return first !== null;
    },
    release,
    dispose: cancel,
  };
}

const noSubscribe = () => () => undefined;

/** Ποιο πλαίσιο δείχνεται — μόνο για το popover. */
export function useBoxPreview(controller: BoxPreviewController | null): BoxPreview | null {
  return useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.get ?? (() => null), () => null);
}

/** Είναι **αυτό** το πλαίσιο ανοιχτό; Boolean ⇒ ξαναζωγραφίζει μόνο όταν αλλάξει η απάντηση (`aria-expanded`). */
export function useBoxPreviewOpen(controller: BoxPreviewController | null, boxId: string): boolean {
  const snapshot = useCallback(() => controller?.get()?.boxId === boxId, [controller, boxId]);
  return useSyncExternalStore(controller?.subscribe ?? noSubscribe, snapshot, () => false);
}
