/**
 * @fileoverview ΑΓΚΥΡΑ — **η ορατότητα της εστίασης σε δύο κάδρα** (ADR-777 §8.77).
 * @related hooks/listings/useListingRevealTracking.ts · lib/a11y/reveal-in-scroll.ts
 *
 *   Ρ1 · κάδρο `'viewport'`: κάρτα κάτω από το παράθυρο ⇒ `below` · πάνω ⇒ `above`.
 *   Ρ2 · κύλιση **οποιουδήποτε** προγόνου (όχι μόνο του δοχείου) ⇒ νέα μέτρηση (ο δείκτης δεν λέει ψέματα).
 *   Ρ3 · το δοχείο γεννιέται ΑΡΓΟΤΕΡΑ (tabs → split) ⇒ μέτρηση χωρίς αλλαγή εστίασης (callback ref).
 *   Ρ4 · κάδρο `'container'` (οθόνη 2): μετρά έναντι του δοχείου, όχι του παραθύρου.
 *   Ρ5 · hover ΠΟΤΕ δεν κυλά· το `selected` κυλά (`nearest`)· η ρητή πράξη κυλά (`center`).
 *   Ρ6 · σύνδεσμος `?selected=`: η επιλογή ΠΡΙΝ από τις κάρτες (δίκτυο) ⇒ αποκάλυψη όταν φτάσει η κάρτα, ΜΙΑ φορά.
 */

import React from 'react';
import { act, render } from '@testing-library/react';

import { NO_LISTING_FOCUS, type ListingFocus } from '@/lib/listings/listing-focus';
import type { ScrollVisibility } from '@/lib/a11y/reveal-in-scroll';

import {
  LISTING_CARD_ID_ATTRIBUTE,
  useListingRevealTracking,
  type ListingRevealFrame,
  type ListingRevealTracking,
} from '../useListingRevealTracking';

const VIEWPORT_HEIGHT = 800;
/** Η «διάταξη» του test: το ορθογώνιο κάθε στοιχείου, κατά `data-testid`/`data-listing-id`. */
const rects = new Map<string, { top: number; bottom: number }>();

function keyOf(element: Element): string {
  return element.getAttribute(LISTING_CARD_ID_ATTRIBUTE) ?? element.getAttribute('data-testid') ?? '';
}

const originalRect = Element.prototype.getBoundingClientRect;
const originalScroll = Element.prototype.scrollIntoView;
const scrolled: Array<{ id: string; block: ScrollLogicalPosition | undefined }> = [];

beforeAll(() => {
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => VIEWPORT_HEIGHT });
  Element.prototype.getBoundingClientRect = function rect(this: Element): DOMRect {
    const r = rects.get(keyOf(this)) ?? { top: 0, bottom: 0 };
    return { ...r, height: r.bottom - r.top, left: 0, right: 0, width: 0, x: 0, y: r.top, toJSON: () => ({}) } as DOMRect;
  };
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element, arg?: boolean | ScrollIntoViewOptions) {
    scrolled.push({ id: keyOf(this), block: typeof arg === 'object' ? arg.block : undefined });
  };
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  Element.prototype.scrollIntoView = originalScroll;
  delete (document.documentElement as { clientHeight?: number }).clientHeight;
});

beforeEach(() => {
  rects.clear();
  scrolled.length = 0;
});

let latest: ListingRevealTracking | null = null;

function Harness(props: { focus: ListingFocus; frame?: ListingRevealFrame; mounted?: boolean; cards?: boolean }) {
  const tracking = useListingRevealTracking(props.focus, props.frame);
  latest = tracking;
  if (props.mounted === false) return null;
  return (
    <section ref={tracking.containerRef} data-testid="container">
      {props.cards !== false && <article {...{ [LISTING_CARD_ID_ATTRIBUTE]: 'a' }}>a</article>}
      {props.cards !== false && <article {...{ [LISTING_CARD_ID_ATTRIBUTE]: 'b' }}>b</article>}
    </section>
  );
}

const peekB: ListingFocus = { ...NO_LISTING_FOCUS, peeked: 'b' };

function visibility(): ScrollVisibility {
  if (latest === null) throw new Error('καμία απόδοση');
  return latest.focusVisibility;
}

/** Μια κύλιση **οπουδήποτε** + το καρέ που ακολουθεί. */
async function scrollSomewhere(target: EventTarget): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
}

describe('useListingRevealTracking — κάδρα και μέτρηση', () => {
  it('Ρ1 · παράθυρο: κάτω ⇒ below · πάνω ⇒ above · μέσα ⇒ visible', () => {
    rects.set('b', { top: 1200, bottom: 1300 });
    const { unmount } = render(<Harness focus={peekB} frame="viewport" />);
    expect(visibility()).toBe('below');
    unmount();

    rects.set('b', { top: -300, bottom: -200 });
    const second = render(<Harness focus={peekB} frame="viewport" />);
    expect(visibility()).toBe('above');
    second.unmount();

    rects.set('b', { top: 790, bottom: 900 });
    render(<Harness focus={peekB} frame="viewport" />);
    expect(visibility()).toBe('visible');
  });

  it('Ρ2 · κύλιση ΟΠΟΙΟΥΔΗΠΟΤΕ προγόνου ⇒ ξαναμετρά', async () => {
    rects.set('b', { top: 1200, bottom: 1300 });
    render(<Harness focus={peekB} frame="viewport" />);
    expect(visibility()).toBe('below');

    rects.set('b', { top: 400, bottom: 500 });
    const ancestor = document.createElement('main');
    document.body.appendChild(ancestor);
    await scrollSomewhere(ancestor);
    expect(visibility()).toBe('visible');
    ancestor.remove();
  });

  it('Ρ3 · το δοχείο φτάνει αργότερα ⇒ μέτρηση χωρίς αλλαγή εστίασης', () => {
    rects.set('b', { top: 1200, bottom: 1300 });
    const { rerender } = render(<Harness focus={peekB} frame="viewport" mounted={false} />);
    expect(visibility()).toBe('unknown');
    rerender(<Harness focus={peekB} frame="viewport" mounted />);
    expect(visibility()).toBe('below');
  });

  it('Ρ4 · δοχείο: η ίδια κάρτα, ορατή στο παράθυρο, είναι «κάτω» από το δοχείο', () => {
    rects.set('container', { top: 0, bottom: 300 });
    rects.set('b', { top: 400, bottom: 500 });
    const { unmount } = render(<Harness focus={peekB} frame="container" />);
    expect(visibility()).toBe('below');
    unmount();

    render(<Harness focus={peekB} frame="viewport" />);
    expect(visibility()).toBe('visible');
  });

  it('Ρ5 · hover ΔΕΝ κυλά · selected ⇒ nearest · ρητή πράξη ⇒ center', () => {
    rects.set('b', { top: 1200, bottom: 1300 });
    const { rerender } = render(<Harness focus={peekB} frame="viewport" />);
    expect(scrolled).toEqual([]);

    rerender(<Harness focus={{ peeked: null, selected: 'b' }} frame="viewport" />);
    expect(scrolled).toEqual([{ id: 'b', block: 'nearest' }]);

    act(() => latest?.revealFocused());
    expect(scrolled[1]).toEqual({ id: 'b', block: 'center' });
  });

  it('Ρ6 · η επιλογή φτάνει ΠΡΙΝ από τις κάρτες ⇒ αποκάλυψη μόλις φτάσει η κάρτα, μία φορά', async () => {
    const selectB: ListingFocus = { peeked: null, selected: 'b' };
    const { rerender } = render(<Harness focus={selectB} frame="viewport" cards={false} />);
    expect(scrolled).toEqual([]);

    rerender(<Harness focus={selectB} frame="viewport" cards />);
    await act(async () => { await Promise.resolve(); }); // ο MutationObserver ειδοποιεί σε microtask
    expect(scrolled).toEqual([{ id: 'b', block: 'nearest' }]);

    rerender(<Harness focus={selectB} frame="viewport" cards={false} />);
    rerender(<Harness focus={selectB} frame="viewport" cards />);
    await act(async () => { await Promise.resolve(); });
    expect(scrolled).toHaveLength(1);
  });
});
