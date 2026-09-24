/**
 * @fileoverview ΑΓΚΥΡΑ — **Λίστα | Χάρτης του χαρτοφυλακίου του κατόχου** (ADR-777 §8.71).
 * @related components/owner-property/{OwnerPortfolio, OwnerPropertyMapPopup, OwnerPortfolioUnmappedRow}.tsx
 *
 * Με πραγματικούς loaders + ICU (`test-utils/real-i18n`) και το πραγματικό `url-query-state`:
 *   Υ1 · κάτω από το όριο ⇒ ΚΑΝΕΝΑ tablist, η λίστα σκέτη (όπως πριν).
 *   Υ2 · πάνω από το όριο ⇒ διακόπτης· «Χάρτης» ⇒ `?view=map` στο URL, «Λίστα» ⇒ το κλειδί σβήνει.
 *   Υ3 · `?view=map` με λίγα σημάδια ⇒ λίστα, και το URL ΔΕΝ ξαναγράφεται.
 *   Υ4 · η φούσκα: σύνδεσμος στην κάρτα του κατόχου · τιμή όπως τη βλέπει ο κόσμος · χωρίς φωτογραφία ⇒ κανένα `<img>`.
 *   Υ5 · η γραμμή «εκτός χάρτη» λέει ΓΙΑΤΙ, ανά ακίνητο.
 *   Υ6 · η κάρτα ΔΕΝ λέει «στον δημόσιο χάρτη» για αγγελία χωρίς σημάδι (§8.73).
 *   Υ7 · φαρδύς ΠΕΡΙΕΚΤΗΣ ⇒ λίστα ‖ χάρτης, ΚΑΝΕΝΑ tablist, το `?view` ούτε διαβάζεται ούτε γράφεται (§8.75).
 *   Υ8 · ΜΙΑ εστίαση: πέρασμα κάρτας ⇒ πινέζα · εστίαση πληκτρολογίου ⇒ πινέζα · κλικ πινέζας ⇒ κάρτα
 *        `selected` ΚΑΙ έρχεται στο οπτικό πεδίο (§8.75).
 *   Υ9 · hover πινέζας με την κάρτα ΚΑΤΩ από το παράθυρο ⇒ δείκτης άκρης (τίτλος + τιμή), ΚΑΜΙΑ κύλιση·
 *        πάτημα ⇒ κύλιση `center`· ορατή κάρτα ⇒ κανένας δείκτης (§8.77).
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { createRealI18n } from '@/test-utils/real-i18n';
import { nowISO } from '@/lib/date-local';
import type { ListingFocusController } from '@/hooks/listings/useListingFocus';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import { partitionOwnerPortfolio } from '@/lib/owner-property/owner-portfolio-map';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import type { OwnerProperty } from '@/types/owner-property';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';

import { OwnerPortfolio } from '../OwnerPortfolio';
import { OwnerPropertyMapPopup } from '../OwnerPropertyMapPopup';
import { OwnerPortfolioUnmappedRow } from '../OwnerPortfolioUnmappedRow';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return { useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]) };
});

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// Η MapLibre δεν ζει στο jsdom: η φούσκα αποδίδεται διάφανη, ο χάρτης ως δηλωμένο στέλεχος.
jest.mock('@/lib/maps/maplibre', () => ({
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));
// Το στέλεχος του χάρτη εκθέτει την ΚΟΙΝΗ εστίαση: τι κοιτάζει ο άνθρωπος, και ένα «κλικ σε πινέζα».
jest.mock('next/dynamic', () => () =>
  function DynamicStub(props: { mapped?: readonly unknown[]; focusController?: ListingFocusController }) {
    if (props.mapped === undefined) return null;
    const { focusController } = props;
    return (
      <section data-testid="portfolio-map" data-peeked={focusController?.focus.peeked ?? ''}>
        {props.mapped.length}
        <button type="button" onClick={() => focusController?.select('ownp_2')}>pin ownp_2</button>
        <button type="button" onClick={() => focusController?.peek('ownp_2')}>hover ownp_2</button>
      </section>
    );
  },
);

// 🗺️ §8.75 — το jsdom δεν έχει διάταξη ούτε `ResizeObserver`: η απάντηση του περιέκτη ορίζεται εδώ.
let containerClass: ViewportClass = 'measuring';
jest.mock('@/hooks/media/useContainerClass', () => ({ useContainerClass: () => containerClass }));

// 📊 §8.72 — τα στατιστικά δεν είναι το ερώτημα εδώ (δες owner-property-stats.test.tsx): «φορτώνει».
jest.mock('@/hooks/owner-property/useOwnerPortfolioStats', () => ({
  ...jest.requireActual('@/hooks/owner-property/useOwnerPortfolioStats'),
  useOwnerPortfolioStats: () => ({ state: 'loading' }),
}));

const AT = '2026-09-23T10:00:00.000Z';
const MARK: ListingMapMark = { shape: 'shaded-city', point: { lat: 40.63, lng: 22.95 } };

let instance: i18n;
beforeAll(async () => {
  instance = await createRealI18n(['property-market', 'search-results', 'search-focus', 'common', 'properties-enums']);
});

beforeEach(() => {
  window.history.replaceState(null, '', '/offers');
  containerClass = 'measuring';
});

function published(id: string, over: Partial<OwnerProperty> = {}): OwnerProperty {
  return validOwnerProperty({ id, title: `Ακίνητο ${id}`, publication: { outcome: 'published', at: AT, mapMark: MARK }, ...over });
}

function renderWithI18n(node: React.ReactNode) {
  return render(<I18nextProvider i18n={instance}>{node}</I18nextProvider>);
}

/** Η σελίδα υπολογίζει τη διαμέριση μία φορά και τη δίνει κάτω — το ίδιο κάνει και το test. */
function Portfolio({ properties }: { readonly properties: readonly OwnerProperty[] }) {
  return <OwnerPortfolio properties={properties} partition={partitionOwnerPortfolio(properties, nowISO())} />;
}

describe('Υ1–Υ3 — ο διακόπτης και το URL', () => {
  it('Υ1 · ένα σημάδι ⇒ κανένα tablist, η λίστα σκέτη', () => {
    renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2', { publication: undefined })]} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('Υ2 · δύο σημάδια ⇒ διακόπτης· το URL ακολουθεί', async () => {
    renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2')]} />);

    expect(screen.getByRole('tablist', { name: 'Προβολή ακινήτων' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Λίστα' })).toHaveAttribute('aria-selected', 'true');

    // Ο Radix Tabs ενεργοποιεί στο `mousedown`, όχι στο `click`.
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('tab', { name: 'Χάρτης' }), { button: 0 });
    });
    expect(window.location.search).toBe('?view=map');
    expect(await screen.findByTestId('portfolio-map')).toHaveTextContent('2');

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('tab', { name: 'Λίστα' }), { button: 0 });
    });
    expect(window.location.search).toBe('');
  });

  it('Υ3 · `?view=map` με ένα σημάδι ⇒ λίστα, και το URL μένει όπως ήρθε', () => {
    window.history.replaceState(null, '', '/offers?view=map');
    renderWithI18n(<Portfolio properties={[published('ownp_1')]} />);

    expect(screen.queryByTestId('portfolio-map')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(window.location.search).toBe('?view=map');
  });
});

describe('Υ4 — η φούσκα του κατόχου', () => {
  it('σύνδεσμος στην κάρτα, τιμή όπως τη βλέπει ο κόσμος, χωρίς φωτογραφία ⇒ κανένα <img>', () => {
    const property = published('ownp_popup');
    renderWithI18n(<OwnerPropertyMapPopup property={property} mark={MARK} onClose={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Ακίνητο ownp_popup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Άνοιγμα' })).toHaveAttribute('href', '/offers/ownp_popup');
    expect(screen.getByText(/210\.000/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('Υ5 — όσα λείπουν από τον χάρτη λένε γιατί', () => {
  it('αιτία ανά ακίνητο, σύνδεσμος στην κάρτα του', () => {
    const withdrawn = validOwnerProperty({ id: 'ownp_w', title: 'Αποσυρμένο', offers: [offerOf('sell', 1, 'withdrawn')] });
    renderWithI18n(<OwnerPortfolioUnmappedRow unmapped={[{ property: withdrawn, reason: 'withdrawn' }]} />);

    fireEvent.click(screen.getByRole('button', { name: '1 ακίνητο δεν φαίνεται στον δημόσιο χάρτη' }));
    expect(screen.getByRole('link', { name: 'Αποσυρμένο' })).toHaveAttribute('href', '/offers/ownp_w');
    expect(screen.getByText('εκτός αγοράς')).toBeInTheDocument();
  });
});

describe('Υ6 — «δημόσια» ≠ «στον χάρτη» (ADR-777 §8.73)', () => {
  it('σημάδι ⇒ «στον χάρτη»· δηλωμένη απουσία ⇒ «χωρίς σημάδι» + θεραπεία· πριν το πεδίο ⇒ μόνο «δημόσια»', () => {
    const marked = published('ownp_m');
    const unmarked = published('ownp_n', { publication: { outcome: 'published', at: AT, mapMark: null } });
    const unrecorded = published('ownp_u', { publication: { outcome: 'published', at: AT } });
    renderWithI18n(<Portfolio properties={[marked, unmarked, unrecorded]} />);

    expect(screen.getAllByText('Η αγγελία είναι στον δημόσιο χάρτη.')).toHaveLength(1);
    expect(screen.getByText(/Η αγγελία είναι δημόσια, αλλά χωρίς σημάδι στον χάρτη/)).toHaveTextContent(
      'Δήλωσε έστω την περιοχή',
    );
    expect(screen.getByText('Η αγγελία είναι δημόσια.')).toBeInTheDocument();
  });

  it('η γραμμή «εκτός χάρτη» λέει ότι η αγγελία είναι ΔΗΜΟΣΙΑ, όχι μόνο ότι λείπει', () => {
    const unmarked = published('ownp_n', { title: 'Χωρίς θέση', publication: { outcome: 'published', at: AT, mapMark: null } });
    renderWithI18n(<OwnerPortfolioUnmappedRow unmapped={[{ property: unmarked, reason: 'no-mark' }]} />);

    fireEvent.click(screen.getByRole('button', { name: '1 ακίνητο δεν φαίνεται στον δημόσιο χάρτη' }));
    expect(screen.getByText('δημόσια, χωρίς θέση στον χάρτη')).toBeInTheDocument();
  });
});

describe('Υ7–Υ8 — λίστα ‖ χάρτης σε φαρδύ περιέκτη (ADR-777 §8.75)', () => {
  function articleOf(title: string): HTMLElement {
    const article = screen.getByRole('heading', { name: title }).closest('article');
    if (article === null) throw new Error(`καμία κάρτα για «${title}»`);
    return article;
  }

  it('Υ7 · φαρδύς ⇒ και τα δύο, κανένα tablist· το `?view=map` μένει ανέγγιχτο', () => {
    containerClass = 'wide';
    window.history.replaceState(null, '', '/offers?view=map');
    renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2')]} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('portfolio-map')).toHaveTextContent('2');
    expect(window.location.search).toBe('?view=map');
  });

  it('Υ7β · στενός ή ακόμη αμέτρητος ⇒ ο διακόπτης της §8.71 (το «δεν ξέρω» δεν γίνεται «φαρδύς»)', () => {
    for (const room of ['narrow', 'measuring'] as const) {
      containerClass = room;
      const { unmount } = renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2')]} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      unmount();
    }
  });

  it('Υ8 · πέρασμα ή εστίαση πληκτρολογίου στην κάρτα ⇒ η πινέζα της· φεύγοντας ⇒ τίποτα', () => {
    containerClass = 'wide';
    renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2')]} />);
    const map = screen.getByTestId('portfolio-map');

    fireEvent.mouseEnter(articleOf('Ακίνητο ownp_1'));
    expect(map).toHaveAttribute('data-peeked', 'ownp_1');
    fireEvent.mouseLeave(articleOf('Ακίνητο ownp_1'));
    expect(map).toHaveAttribute('data-peeked', '');

    const open = within(articleOf('Ακίνητο ownp_2')).getByRole('link', { name: 'Άνοιγμα' });
    fireEvent.focus(open);
    expect(map).toHaveAttribute('data-peeked', 'ownp_2');
    fireEvent.blur(open);
    expect(map).toHaveAttribute('data-peeked', '');
  });

  it('Υ8β · κλικ σε πινέζα ⇒ η κάρτα `selected` (δεύτερο κανάλι: δακτύλιος) ΚΑΙ έρχεται στο οπτικό πεδίο', async () => {
    containerClass = 'wide';
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this);
    };
    try {
      renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2')]} />);
      expect(articleOf('Ακίνητο ownp_2')).not.toHaveClass('ring-2');

      // §8.77: η επιλογή ζει στο URL — η ειδοποίηση του `url-query-state` είναι microtask.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'pin ownp_2' }));
      });

      expect(window.location.search).toBe('?selected=ownp_2');
      expect(articleOf('Ακίνητο ownp_2')).toHaveClass('ring-2');
      expect(articleOf('Ακίνητο ownp_1')).not.toHaveClass('ring-2');
      expect(scrolled).toEqual([articleOf('Ακίνητο ownp_2').closest('li')]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('Υ9 — δείκτης άκρης έναντι του ΠΑΡΑΘΥΡΟΥ (ADR-777 §8.77)', () => {
  const originalRect = Element.prototype.getBoundingClientRect;
  const originalScroll = Element.prototype.scrollIntoView;
  const scrolled: Array<{ element: Element; block: ScrollLogicalPosition | undefined }> = [];
  /** Πού «βρίσκεται» η κάρτα του ownp_2 — οι υπόλοιπες στην κορυφή του παραθύρου. */
  let ownp2Top = 1500;

  beforeEach(() => {
    containerClass = 'wide';
    scrolled.length = 0;
    ownp2Top = 1500;
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 800 });
    Element.prototype.getBoundingClientRect = function rect(this: Element): DOMRect {
      const top = this.getAttribute('data-listing-id') === 'ownp_2' ? ownp2Top : 0;
      return { top, bottom: top + 120, height: 120, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    };
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element, arg?: boolean | ScrollIntoViewOptions) {
      scrolled.push({ element: this, block: typeof arg === 'object' ? arg.block : undefined });
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalRect;
    Element.prototype.scrollIntoView = originalScroll;
    delete (document.documentElement as { clientHeight?: number }).clientHeight;
  });

  it('Υ9 · hover ⇒ «πιο κάτω» με τον τίτλο, ΧΩΡΙΣ κύλιση · πάτημα ⇒ `center` στη σωστή κάρτα', () => {
    renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'hover ownp_2' }));

    const edge = screen.getByRole('button', { name: /Πιο κάτω στη λίστα/ });
    expect(edge).toHaveTextContent('Ακίνητο ownp_2');
    expect(scrolled).toEqual([]);

    fireEvent.click(edge);
    expect(scrolled).toEqual([{ element: screen.getByRole('heading', { name: 'Ακίνητο ownp_2' }).closest('li'), block: 'center' }]);
  });

  it('Υ9β · ορατή κάρτα ⇒ κανένας δείκτης (σιωπή, όχι θόρυβος)', () => {
    ownp2Top = 300;
    renderWithI18n(<Portfolio properties={[published('ownp_1'), published('ownp_2')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'hover ownp_2' }));

    expect(screen.queryByRole('button', { name: /στη λίστα/ })).not.toBeInTheDocument();
  });
});
