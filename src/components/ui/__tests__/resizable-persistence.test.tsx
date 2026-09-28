/**
 * ADR-724 §5.2–§5.3 · ADR-884 Φ2στ-γ Γ2 — ΠΟΤΕ γράφεται το πλάτος ενός panel: μία φορά ανά χειρονομία ΧΡΗΣΤΗ, μετά το flush.
 * Εδώ ελέγχεται η λογική χωρίς τη βιβλιοθήκη — στο jsdom ο native χειριστής βελών της πετά «Previous layout not found»,
 * άρα το «βέλος ⇒ εγγραφή» είναι ελέγξιμο **μόνο** πάνω στους χειριστές μας.
 */

import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';

import { usePanelWidthPersistence } from '../resizable-persistence';

const key = (k: string) => ({ key: k }) as KeyboardEvent<HTMLDivElement>;
const size = (inPixels: number) => ({ inPixels, asPercentage: 0 });
const nextFrame = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });

/**
 * Το `jest.setup.js` ορίζει το `cancelAnimationFrame` ως `jest.fn()` που **δεν ακυρώνει** — τότε η «μία εγγραφή ανά
 * χειρονομία» και η ακύρωση στην αποπροσάρτηση θα φαίνονταν σπασμένες για λόγο του περιβάλλοντος. Εδώ: ζεύγος που ακυρώνει.
 */
const realRaf = global.requestAnimationFrame;
const realCancel = global.cancelAnimationFrame;
beforeEach(() => {
  global.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);
  global.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
});
afterEach(() => {
  global.requestAnimationFrame = realRaf;
  global.cancelAnimationFrame = realCancel;
});

function setup() {
  const persist = jest.fn();
  const hook = renderHook(() => usePanelWidthPersistence(persist, 320));
  return { persist, hook, api: () => hook.result.current };
}

describe('usePanelWidthPersistence', () => {
  it('αλλαγή διάταξης ΧΩΡΙΣ χειρονομία (στένεψε το παράθυρο) ⇒ καμία εγγραφή', async () => {
    const { persist, api } = setup();
    api().onResize(size(250));
    api().onLayoutChanged();
    await nextFrame();
    expect(persist).not.toHaveBeenCalled();
  });

  it('σύρσιμο: δείκτης + αλλαγή διάταξης ⇒ ΜΙΑ εγγραφή, μετά το καρέ, με ό,τι μέτρησε το DOM', async () => {
    const { persist, api } = setup();
    const el = document.createElement('div');
    el.getBoundingClientRect = () => new DOMRect(0, 0, 603.6, 10);
    api().elementRef.current = el;
    api().separatorProps.onPointerDown();
    api().onResize(size(487.2));
    api().onLayoutChanged();
    expect(persist).not.toHaveBeenCalled();
    await nextFrame();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(603.6);
  });

  it('χωρίς στοιχείο (αποπροσαρτημένο) ⇒ εφεδρεία = το τελευταίο `onResize`', async () => {
    const { persist, api } = setup();
    api().separatorProps.onDoubleClick();
    api().onResize(size(410));
    api().onLayoutChanged();
    await nextFrame();
    expect(persist).toHaveBeenCalledWith(410);
  });

  it('πληκτρολόγιο: γράφει ΜΟΝΟ ΤΟΥ (δεν περιμένει onLayoutChanged) — και μία φορά αν έρθουν και τα δύο', async () => {
    const { persist, api } = setup();
    api().separatorProps.onKeyDown(key('ArrowLeft'));
    api().onLayoutChanged();
    await nextFrame();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('`Enter` (σύμπτυξη collapsible panel) μετρά ως πρόθεση · `Tab` όχι', async () => {
    const { persist, api } = setup();
    api().separatorProps.onKeyDown(key('Tab'));
    await nextFrame();
    expect(persist).not.toHaveBeenCalled();
    api().separatorProps.onKeyDown(key('Enter'));
    await nextFrame();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('η αναβολή δεν επιζεί του component', async () => {
    const { persist, api, hook } = setup();
    api().persistSoon();
    hook.unmount();
    await nextFrame();
    expect(persist).not.toHaveBeenCalled();
  });
});
