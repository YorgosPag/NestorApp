/**
 * ΑΓΚΥΡΕΣ — **η πινακίδα τιμής πάνω στον χάρτη** (ADR-777 §8.60, Ε2)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ ΕΙΝΑΙ Η **Φ3**, ΚΑΙ Η ΒΛΑΒΗ ΠΟΥ ΦΥΛΑΕΙ ΕΙΝΑΙ ΑΟΡΑΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο δείκτης ζει **μέσα** στο `canvasContainer` του MapLibre, άρα ο καθολικός ακροατής
 * κλικ του `ResultsMap` είναι **πρόγονός** του. Εκείνος ρωτά `queryRenderedFeatures`
 * **στο σημείο του δείκτη** — που είναι ~12px **πάνω** από την πινέζα, δηλαδή σε κενό —
 * και καλεί `onClear()`. Χωρίς το `stopPropagation` στο **γνήσιο** συμβάν, **η πινακίδα
 * ακυρώνει την ίδια της την επιλογή**.
 *
 * 🔑 **Καμία οπτική επιθεώρηση δεν το πιάνει**: η πινακίδα φαίνεται σωστή, το κλικ
 * «δουλεύει» στα μάτια, και η βλάβη είναι μια φούσκα που ανοιγοκλείνει. Ίδιο σχήμα με
 * το `<button>` μέσα σε `<a>` της §8.58 — γι' αυτό η Φ3 ρωτά τη **σύνδεση**, όχι την όψη.
 *
 * ⚠️ Το `t` επιστρέφει το ΚΛΕΙΔΙ, επίτηδες — ίδιο ιδίωμα με τα αδέλφια.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

const mockStopPropagation = jest.fn();

/**
 * ⚠️ Ο `Marker` απαιτεί ζωντανή μηχανή χάρτη (πύλη σε `canvasContainer`, `createPortal`).
 * Εδώ γίνεται **διαφανές περίβλημα** που εκθέτει τα τρία πράγματα που **ελέγχονται**:
 * τη στρώση (`className`), το κενό (`offset`) και τη **σύνδεση του κλικ**.
 *
 * 🔑 Το `onClick` καλείται με **αντικείμενο σχήματος `MarkerEvent`**, δηλαδή με
 * `originalEvent` — ακριβώς όπως το γεννά η `react-map-gl` από τον ακροατή που δένει
 * **στο στοιχείο του δείκτη**. Αν κάποιος μετακινήσει την επιλογή στο `onClick` του
 * κουμπιού, αυτή η υπογραφή δεν θα του δώσει `originalEvent` και η Φ3 κοκκινίζει.
 */
jest.mock('@/lib/maps/maplibre', () => ({
  Marker: ({
    children,
    className,
    offset,
    longitude,
    latitude,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    offset?: readonly [number, number];
    longitude: number;
    latitude: number;
    onClick?: (event: { originalEvent: { stopPropagation: () => void } }) => void;
  }) => (
    <div
      data-testid="marker"
      data-marker-class={className ?? ''}
      data-offset={JSON.stringify(offset ?? null)}
      data-lng={longitude}
      data-lat={latitude}
      onClick={() => onClick?.({ originalEvent: { stopPropagation: mockStopPropagation } })}
    >
      {children}
    </div>
  ),
}));

import { ListingPriceMarkers } from '../ListingPriceMarkers';
import { NO_LISTING_FOCUS } from '@/lib/listings/listing-focus';
import type { ListingPriceMarker } from '@/lib/listings/listing-price-markers';

const PIN_RADIUS = 7;

const CHEAP: ListingPriceMarker = { id: 'a', title: 'Μονοκατοικία Α', lng: 22.94, lat: 40.64, amount: 120000 };
const DEAR: ListingPriceMarker = { id: 'b', title: 'Ρετιρέ Β', lng: 22.95, lat: 40.65, amount: 480000 };

function renderMarkers(over: Partial<React.ComponentProps<typeof ListingPriceMarkers>> = {}) {
  return render(
    <ListingPriceMarkers
      markers={[CHEAP, DEAR]}
      focus={NO_LISTING_FOCUS}
      pinRadiusPx={PIN_RADIUS}
      {...over}
    />,
  );
}

function plaque(id: string): HTMLElement {
  const element = document.querySelector(`button[data-listing-id="${id}"]`);
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

beforeEach(() => {
  mockStopPropagation.mockClear();
});

// ============================================================================
// Φ1 — ΤΟ ΠΟΣΟ ΕΙΝΑΙ ΟΡΑΤΟ ΚΕΙΜΕΝΟ, ΟΧΙ ΠΙΞΕΛ ΣΕ ΚΑΜΒΑ
// ============================================================================

describe('Φ1 — τι ζωγραφίζεται', () => {
  it('μία πινακίδα ανά marker, με το ποσό ως πραγματικό κείμενο', () => {
    renderMarkers();
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    expect(plaque('a').textContent).toMatch(/120[.,\s]?000/);
    expect(plaque('b').textContent).toMatch(/480[.,\s]?000/);
  });

  it('καμία πινακίδα όταν κανείς δεν δικαιούται — μηδέν κόμβοι DOM', () => {
    renderMarkers({ markers: [] });
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });

  it('η πινακίδα κάθεται στη ΔΙΚΗ της συντεταγμένη', () => {
    renderMarkers();
    const markers = screen.getAllByTestId('marker');
    expect(markers[0]).toHaveAttribute('data-lng', String(CHEAP.lng));
    expect(markers[0]).toHaveAttribute('data-lat', String(CHEAP.lat));
  });
});

// ============================================================================
// Φ2 — Η ΔΟΜΗ: ΠΡΑΓΜΑΤΙΚΟ ΚΟΥΜΠΙ, ΜΕ ΠΡΟΣΒΑΣΙΜΟ ΟΝΟΜΑ
// ============================================================================

describe('Φ2 — η δομή, όχι η εμφάνιση', () => {
  it('είναι <button type="button">, ποτέ <div role="button">', () => {
    renderMarkers();
    const element = plaque('a');
    expect(element.tagName).toBe('BUTTON');
    expect(element).toHaveAttribute('type', 'button');
  });

  it('το προσβάσιμο όνομα περιέχει ΚΑΙ τον τίτλο ΚΑΙ την τιμή (WCAG 2.5.3)', () => {
    renderMarkers();
    const label = plaque('a').getAttribute('aria-label') ?? '';
    expect(label).toContain('search-results:map.priceMarker.aria');
    expect(label).toContain('Μονοκατοικία Α');
    expect(label).toMatch(/120[.,\s]?000/);
  });

  it('είναι εστιάσιμο με πληκτρολόγιο — ο χάρτης παύει να είναι νεκρή ζώνη', () => {
    renderMarkers();
    plaque('a').focus();
    expect(document.activeElement).toBe(plaque('a'));
  });
});

// ============================================================================
// Φ3 — 🔴 ΤΟ ΚΛΙΚ ΕΠΙΛΕΓΕΙ **ΚΑΙ** ΚΟΒΕΙ ΤΟΝ ΧΑΡΤΗ
// ============================================================================

describe('Φ3 — η σύνδεση του κλικ', () => {
  it('το κλικ στην πινακίδα επιλέγει ΤΗ ΔΙΚΗ ΤΗΣ αγγελία', () => {
    const onSelect = jest.fn();
    renderMarkers({ onSelect });

    fireEvent.click(plaque('b'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('ΚΑΙ σταματά το γνήσιο συμβάν, αλλιώς ο χάρτης θα ακύρωνε την επιλογή', () => {
    renderMarkers({ onSelect: jest.fn() });
    fireEvent.click(plaque('a'));
    expect(mockStopPropagation).toHaveBeenCalledTimes(1);
  });

  it('χωρίς καταναλωτή επιλογής δεν σκάει τίποτα — η διάδοση κόβεται ούτως ή άλλως', () => {
    renderMarkers({ onSelect: undefined });
    expect(() => fireEvent.click(plaque('a'))).not.toThrow();
    expect(mockStopPropagation).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Φ4 — Ο ΔΕΙΚΤΗΣ ΚΑΙ Η ΕΣΤΙΑΣΗ ΜΙΛΟΥΝ ΣΤΟ ΙΔΙΟ ΚΑΝΑΛΙ
// ============================================================================

describe('Φ4 — επισήμανση', () => {
  it('ο δείκτης πάνω στην πινακίδα επισημαίνει την αγγελία, και φεύγοντας τη σβήνει', () => {
    const onPeek = jest.fn();
    renderMarkers({ onPeek });

    fireEvent.mouseEnter(plaque('b'));
    expect(onPeek).toHaveBeenLastCalledWith('b');

    fireEvent.mouseLeave(plaque('b'));
    expect(onPeek).toHaveBeenLastCalledWith(null);
  });

  it('η ΕΣΤΙΑΣΗ κάνει ό,τι και ο δείκτης — αλλιώς το πληκτρολόγιο δεν θα φώτιζε τίποτα', () => {
    const onPeek = jest.fn();
    renderMarkers({ onPeek });

    fireEvent.focus(plaque('a'));
    expect(onPeek).toHaveBeenLastCalledWith('a');

    fireEvent.blur(plaque('a'));
    expect(onPeek).toHaveBeenLastCalledWith(null);
  });
});

// ============================================================================
// Φ5 — ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΞΕΧΩΡΙΖΟΥΝ **ΧΩΡΙΣ ΧΡΩΜΑ** (CHECK 3.41)
// ============================================================================

/** Ό,τι μένει από τις κλάσεις όταν αφαιρεθεί **κάθε** κανάλι χρώματος. */
function colourlessChannels(element: HTMLElement): string[] {
  return element.className
    .split(/\s+/)
    .filter((c) => c.length > 0)
    .filter((c) => !/^(bg|text|border|ring|from|to|via)-/.test(c))
    .sort();
}

describe('Φ5 — διακριτότητα καταστάσεων', () => {
  it('επισήμανση και επιλογή διαφέρουν από την ουδέτερη σε ΜΗ χρωματικό κανάλι', () => {
    const { unmount } = renderMarkers();
    const neutral = colourlessChannels(plaque('a'));
    unmount();

    renderMarkers({ focus: { peeked: 'a', selected: null } });
    const peeked = colourlessChannels(plaque('a'));

    renderMarkers({ focus: { peeked: null, selected: 'a' } });
    const selected = colourlessChannels(document.querySelectorAll('button[data-listing-id="a"]')[1] as HTMLElement);

    expect(peeked).not.toEqual(neutral);
    expect(selected).not.toEqual(neutral);
    expect(selected).not.toEqual(peeked);
  });

  it('η στρώση ανεβαίνει: ουδέτερο < επισήμανση < επιλογή', () => {
    const layerOf = (focus: { peeked: string | null; selected: string | null }) => {
      const view = render(
        <ListingPriceMarkers markers={[CHEAP]} focus={focus} pinRadiusPx={PIN_RADIUS} />,
      );
      const layer = view.getByTestId('marker').getAttribute('data-marker-class') ?? '';
      view.unmount();
      return layer;
    };

    expect(layerOf(NO_LISTING_FOCUS)).toBe('z-10');
    expect(layerOf({ peeked: 'a', selected: null })).toBe('z-20');
    expect(layerOf({ peeked: null, selected: 'a' })).toBe('z-30');
  });

  it('η επιλογή νικά την επισήμανση όταν ισχύουν και οι δύο', () => {
    renderMarkers({ focus: { peeked: 'a', selected: 'a' } });
    expect(screen.getAllByTestId('marker')[0]).toHaveAttribute('data-marker-class', 'z-30');
  });
});

// ============================================================================
// Φ6 — Η ΠΙΝΑΚΙΔΑ ΚΑΘΕΤΑΙ **ΠΑΝΩ** ΑΠΟ ΤΗΝ ΠΙΝΕΖΑ, ΟΧΙ ΠΑΝΩ ΤΗΣ
// ============================================================================

describe('Φ6 — το κενό παράγεται από την ακτίνα της πινέζας', () => {
  it('το offset είναι αρνητικό στον άξονα y και ξεπερνά την ακτίνα', () => {
    renderMarkers();
    const offset = JSON.parse(
      screen.getAllByTestId('marker')[0].getAttribute('data-offset') ?? 'null',
    ) as [number, number];

    expect(offset[0]).toBe(0);
    expect(offset[1]).toBeLessThan(-PIN_RADIUS);
  });

  it('μεγαλύτερη πινέζα ⇒ μεγαλύτερο κενό — καμία σταθερά δεύτερης χειρός', () => {
    const offsetFor = (radius: number) => {
      const view = render(
        <ListingPriceMarkers markers={[CHEAP]} focus={NO_LISTING_FOCUS} pinRadiusPx={radius} />,
      );
      const raw = view.getByTestId('marker').getAttribute('data-offset') ?? 'null';
      view.unmount();
      return (JSON.parse(raw) as [number, number])[1];
    };

    expect(offsetFor(20)).toBe(offsetFor(7) - 13);
  });
});
