/**
 * @fileoverview **Η σκηνή της κάτοψης ορόφου** (ADR-907 §11.9), εκτελεσμένη.
 *
 * ΟΡ-1 — το στρώμα έχει `viewBox` = φυσικά pixels της εικόνας και είναι `aria-hidden`· τα σχήματα είναι όσα οι μονάδες;
 * ΟΡ-2 — 🔴 κάθε κατάσταση γείτονα έχει ΤΡΙΑ κανάλια: απόχρωση `--status-*`, **μοτίβο** διαφορετικού είδους που υπάρχει
 *        στο ίδιο `<svg>`, και **λέξη** στη λίστα — ποτέ μόνο χρώμα;
 * ΟΡ-3 — 🔴 «αυτό το ακίνητο» ΔΕΝ είναι κόκκινο: κανένα `--status-error` / `--plan-here`, παχύτερο περίγραμμα, άλω,
 *        και `aria-current` στη γραμμή του;
 * ΟΡ-4 — 🔴 γείτονας με αγγελία = σύνδεσμος προς αυτήν (σχήμα **και** γραμμή)· χωρίς αγγελία κανένας· ο εαυτός ποτέ;
 * ΟΡ-5 — το υπόμνημα δείχνει μόνο όσες καταστάσεις υπάρχουν, με το ΙΔΙΟ μοτίβο με το σχέδιο;
 * ΟΡ-6 — η λίστα λέει ό,τι το σχέδιο, με τον ίδιο αριθμό· ό,τι τονίζεται στη γραμμή τονίζεται στο σχήμα;
 * ΟΡ-7 — 🔴 κλικ μετά από ΣΥΡΣΙΜΟ πάνω σε γείτονα δεν πλοηγεί (ο κοινός φρουρός της `ListingZoomStage`);
 * ΟΡ-8 — τίποτα εστιάσιμο μέσα στο κρυμμένο στρώμα· προέλευση και σημείωση γειτόνων τυπώνονται.
 * ΟΡ-9 — 🔴 κανένα αρχείο της όψης (κώδικας, σχόλιο, test) δεν γράφει κλάση με αγκύλες και παρεμβολή μέσα της: ο Tailwind
 *        σαρώνει ΚΑΙ τα tests, τη διαβάζει ως κλάση και βγάζει άκυρο CSS ⇒ 500 σε όλο τον dev server (βρέθηκε στον browser).
 *
 * ⚠️ Ότι τα σχήματα **κάθονται πάνω στους τοίχους** το μέτρησε η Υ2 (ADR-907 §11.1) και το βλέπει μόνο browser με
 * πραγματικό όροφο — εδώ κλειδώνεται η δομή, όχι τα pixels.
 */

import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { FloorPlateUnit, ListingFloorPlate } from '@/types/public-listing';

import { ListingFloorPlateStage } from '../ListingFloorPlateStage';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn() }),
}));

const UNITS: readonly FloorPlateUnit[] = [
  { outline: [0.1, 0.1, 0.4, 0.1, 0.4, 0.4, 0.1, 0.4], state: 'self' },
  { outline: [0.5, 0.1, 0.9, 0.1, 0.9, 0.4, 0.5, 0.4], state: 'available', listingId: 'prop_2' },
  { outline: [0.1, 0.5, 0.4, 0.5, 0.4, 0.9, 0.1, 0.9], state: 'reserved' },
  { outline: [0.5, 0.5, 0.9, 0.5, 0.9, 0.9, 0.5, 0.9], state: 'unavailable' },
];

function plateOf(units: readonly FloorPlateUnit[] = UNITS): ListingFloorPlate {
  return {
    provenance: 'declared', at: '2026-10-10T08:00:00.000Z',
    value: { image: { url: 'https://shelf/floor.webp', width: 2000, height: 1000, altKey: 'listing-detail:floorPlate.alt', sources: [] }, units },
  } as ListingFloorPlate;
}

function renderStage(units?: readonly FloorPlateUnit[]) {
  // Ο `TooltipProvider` έρχεται από το `(light)/layout.tsx` (ADR-813)· εδώ το δίνει το test.
  return render(<TooltipProvider><ListingFloorPlateStage plate={plateOf(units)} /></TooltipProvider>);
}

const layerOf = (container: HTMLElement) => container.querySelector<SVGSVGElement>('[data-floor-plate-layer]');
const unitOf = (container: HTMLElement, unitNumber: number) =>
  layerOf(container)?.querySelector<SVGGElement>(`[data-floor-plate-unit="${unitNumber}"]`) ?? null;
const rowOf = (unitNumber: number) => {
  const row = document.querySelector<HTMLLIElement>(`[data-floor-plate-row="${unitNumber}"]`);
  if (row === null) throw new Error(`καμία γραμμή για τη μονάδα ${unitNumber}`);
  return row;
};
const stateKey = (state: string) => `listing-detail:floorPlate.state.${state}`;
/** Το είδος του μοτίβου που ΠΡΑΓΜΑΤΙΚΑ γεμίζει το σχήμα: ακολουθεί το `url(#…)` ως τη δήλωση μέσα στο ίδιο `<svg>`. */
function patternKindOf(scope: Element): string | null {
  // Σύγκριση γνωρισμάτων με το χέρι: ο επιλογέας του jsdom δεν διαβάζει τιμή γνωρίσματος που περιέχει `(#`.
  const fills = Array.from(scope.querySelectorAll('[fill]')).map((el) => el.getAttribute('fill') ?? '');
  const id = fills.map((fill) => fill.match(/^url\(#(.+)\)$/u)?.[1]).find((found) => found !== undefined);
  if (id === undefined) return null;
  const declared = Array.from(scope.closest('svg')?.querySelectorAll('pattern') ?? []).find((p) => p.getAttribute('id') === id);
  return declared?.getAttribute('data-floor-plate-pattern') ?? 'ΑΝΥΠΑΡΚΤΟ';
}
const classesOf = (scope: Element) => Array.from(scope.querySelectorAll('polygon, rect')).map((el) => el.getAttribute('class') ?? '').join(' ');

describe('ListingFloorPlateStage', () => {
  it('ΟΡ-1 στρώμα σε φυσικά pixels, κρυμμένο από τεχνολογίες υποβοήθησης, ένα σχήμα ανά μονάδα', () => {
    const { container } = renderStage();
    const layer = layerOf(container);
    expect(layer?.getAttribute('viewBox')).toBe('0 0 2000 1000');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer?.querySelectorAll('[data-floor-plate-unit]')).toHaveLength(4);
    expect(unitOf(container, 1)?.querySelector('polygon')?.getAttribute('points')).toBe('200,100 800,100 800,400 200,400');
    expect(screen.getByRole('img').getAttribute('alt')).toBe('listing-detail:floorPlate.alt');
  });

  it('🔴 ΟΡ-2 κάθε κατάσταση γείτονα: απόχρωση --status-* ΚΑΙ μοτίβο δικού της είδους ΚΑΙ λέξη', () => {
    const { container } = renderStage();
    const expected = [
      { unitNumber: 2, state: 'available', token: '--status-success' },
      { unitNumber: 3, state: 'reserved', token: '--status-warning' },
      { unitNumber: 4, state: 'unavailable', token: '--status-error' },
    ];
    const kinds = expected.map(({ unitNumber, state, token }) => {
      const unit = unitOf(container, unitNumber);
      if (unit === null) throw new Error(`καμία μονάδα ${unitNumber}`);
      // ⚠️ Κανονική έκφραση, ΟΧΙ η κλάση γραμμένη με παρεμβολή: ο Tailwind σαρώνει και τα αρχεία test, και μια
      // συμβολοσειρά σε σχήμα κλάσης με παρεμβολή μέσα της γίνεται άκυρο CSS ⇒ 500 σε ΟΛΟ τον dev server (ADR-907 §11.9).
      expect(classesOf(unit)).toMatch(new RegExp(`(^|\\s)fill-\\S+${token}\\S+`, 'u'));
      expect(classesOf(unit)).toMatch(new RegExp(`(^|\\s)stroke-\\S+${token}\\S+`, 'u'));
      expect(within(rowOf(unitNumber)).getByText(stateKey(state))).toBeInTheDocument();
      return patternKindOf(unit);
    });
    // Τρία ΥΠΑΡΚΤΑ μοτίβα, τρία ΔΙΑΦΟΡΕΤΙΚΑ είδη: η διάκριση επιζεί σε ασπρόμαυρο.
    expect(kinds).toEqual(['dots', 'hatch', 'cross']);
  });

  it('🔴 ΟΡ-3 «αυτό το ακίνητο»: όχι κόκκινο, παχύτερο περίγραμμα με άλω, aria-current στη γραμμή του', () => {
    const { container } = renderStage();
    const self = unitOf(container, 1);
    if (self === null) throw new Error('καμία μονάδα «αυτό το ακίνητο»');
    const classes = classesOf(self);
    expect(classes).not.toContain('--status-error');
    expect(classes).not.toContain('--plan-here');
    expect(classes).not.toContain('--status-');
    expect(classes).toContain('stroke-[hsl(var(--plan-ink))]');

    const widths = (unit: Element) => Array.from(unit.querySelectorAll('polygon')).map((p) => Number(p.getAttribute('stroke-width') ?? 0));
    const neighbour = unitOf(container, 2);
    if (neighbour === null) throw new Error('κανένας γείτονας');
    // Δύο περιγράμματα (άλω + μελάνι), και τα δύο παχύτερα από κάθε περίγραμμα γείτονα.
    expect(self.querySelectorAll('polygon[stroke-width]')).toHaveLength(2);
    expect(Math.min(...widths(self).filter((w) => w > 0))).toBeGreaterThan(Math.max(...widths(neighbour)));
    expect(self.querySelector('polygon')?.getAttribute('class')).toContain('stroke-white');

    // Ζωγραφίζεται τελευταίο: ο άξονας z του SVG είναι η σειρά.
    const order = Array.from(layerOf(container)?.querySelectorAll('[data-floor-plate-unit]') ?? []).map((g) => g.getAttribute('data-floor-plate-unit'));
    expect(order[order.length - 1]).toBe('1');

    expect(rowOf(1)).toHaveAttribute('aria-current', 'true');
    expect(within(rowOf(1)).getByText(stateKey('self'))).toBeInTheDocument();
    expect(rowOf(2)).not.toHaveAttribute('aria-current');
  });

  it('🔴 ΟΡ-4 γείτονας με αγγελία = σύνδεσμος στο σχήμα ΚΑΙ στη γραμμή· χωρίς αγγελία κανένας· ο εαυτός ποτέ', () => {
    const { container } = renderStage([{ ...UNITS[0], listingId: 'prop_self' }, ...UNITS.slice(1)]);
    const drawn = layerOf(container)?.querySelectorAll('a') ?? [];
    expect(drawn).toHaveLength(1);
    expect(drawn[0].getAttribute('href')).toBe('/listing/prop_2');
    expect(drawn[0].querySelector('[data-floor-plate-unit="2"]')).not.toBeNull();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/listing/prop_2');
    expect(rowOf(2)).toContainElement(links[0]);
    // Το όνομα του συνδέσμου λέει ΠΟΙΑ μονάδα και σε τι κατάσταση — «Δείτε την αγγελία» σκέτο δεν ξεχωρίζει δύο γείτονες.
    expect(links[0].getAttribute('aria-label')).toBe(
      `listing-detail:floorPlate.openListingLabel::${JSON.stringify({ number: 2, state: stateKey('available') })}`,
    );
    expect(container.innerHTML).not.toContain('prop_self');
  });

  it('ΟΡ-5 υπόμνημα: μόνο όσες καταστάσεις υπάρχουν, με το ίδιο μοτίβο με το σχέδιο', () => {
    const { container } = renderStage(UNITS.slice(0, 3));
    const legend = screen.getByRole('list', { name: 'listing-detail:floorPlate.legend' });
    const swatches = Array.from(legend.querySelectorAll('[data-floor-plate-swatch]'));
    expect(swatches.map((s) => s.getAttribute('data-floor-plate-swatch'))).toEqual(['self', 'available', 'reserved']);
    expect(swatches.map(patternKindOf)).toEqual([null, 'dots', 'hatch']);
    expect(within(legend).getByText(stateKey('reserved'))).toBeInTheDocument();
    expect(within(legend).queryByText(stateKey('unavailable'))).toBeNull();
    const reserved = unitOf(container, 3);
    expect(reserved === null ? null : patternKindOf(reserved)).toBe('hatch');
  });

  it('ΟΡ-6 η λίστα έχει μία γραμμή ανά μονάδα με τον αριθμό του σχεδίου· ο τονισμός είναι κοινός', () => {
    const { container } = renderStage();
    const list = screen.getByRole('list', { name: 'listing-detail:floorPlate.units' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    [1, 2, 3, 4].forEach((unitNumber) => {
      expect(within(rowOf(unitNumber)).getByText(`listing-detail:floorPlate.unit::${JSON.stringify({ number: unitNumber })}`)).toBeInTheDocument();
      expect(unitOf(container, unitNumber)?.querySelector('text')?.textContent).toBe(String(unitNumber));
    });

    expect(unitOf(container, 3)).not.toHaveAttribute('data-emphasised');
    fireEvent.pointerEnter(rowOf(3));
    expect(unitOf(container, 3)).toHaveAttribute('data-emphasised');
    expect(unitOf(container, 2)).not.toHaveAttribute('data-emphasised');
    fireEvent.pointerLeave(rowOf(3));
    expect(unitOf(container, 3)).not.toHaveAttribute('data-emphasised');

    const drawn = unitOf(container, 4);
    if (drawn === null) throw new Error('καμία μονάδα 4');
    fireEvent.pointerEnter(drawn);
    expect(rowOf(4).className).toContain('bg-muted');
  });

  it('🔴 ΟΡ-7 κλικ μετά από ΣΥΡΣΙΜΟ πάνω σε γείτονα δεν πλοηγεί', () => {
    const { container } = renderStage();
    const target = unitOf(container, 2)?.querySelector('polygon');
    if (target === null || target === undefined) throw new Error('κανένα σχήμα γείτονα');

    const anchor = target.closest('a');
    if (anchor === null) throw new Error('το σχήμα του γείτονα δεν είναι σύνδεσμος');
    // Ο μάρτυρας είναι αν το κλικ ΦΤΑΝΕΙ στον σύνδεσμο — όχι το `defaultPrevented`, που το θέτει και ο ίδιος ο `Link`.
    const reached = jest.fn((event: Event) => event.preventDefault());
    anchor.addEventListener('click', reached);

    fireEvent.mouseDown(target, { clientX: 100, clientY: 100 });
    const dragged = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 170, clientY: 130 });
    target.dispatchEvent(dragged);
    expect(reached).not.toHaveBeenCalled();
    expect(dragged.defaultPrevented).toBe(true);

    // Το ακίνητο κλικ περνά: ο φρουρός δεν καταπίνει κάθε κλικ.
    fireEvent.mouseDown(target, { clientX: 100, clientY: 100 });
    fireEvent.click(target, { clientX: 101, clientY: 100 });
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('ΟΡ-8 τίποτα εστιάσιμο μέσα στο κρυμμένο στρώμα· προέλευση και σημείωση γειτόνων τυπώνονται', () => {
    const { container } = renderStage();
    const focusable = Array.from(layerOf(container)?.querySelectorAll('a, [tabindex]') ?? []);
    expect(focusable.length).toBeGreaterThan(0);
    focusable.forEach((el) => expect(el.getAttribute('tabindex')).toBe('-1'));
    expect(screen.getByText('listing-detail:floorPlate.neighboursNote')).toBeInTheDocument();
    expect(screen.getByText('search-results:detail.media.floorplanProvenance.declared')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'listing-detail:media.capture.viewTools' })).toBeInTheDocument();
  });

  it('🔴 ΟΡ-9 κανένα αρχείο της όψης δεν γράφει κλάση με αγκύλες ΚΑΙ παρεμβολή μέσα της', () => {
    const root = path.resolve(__dirname, '..', '..');
    const files = [
      'ListingFloorPlates.tsx', 'media/ListingFloorPlateStage.tsx', 'media/FloorPlateUnitLayer.tsx',
      'media/floor-plate-palette.ts', 'media/ListingZoomStage.tsx', 'media/__tests__/ListingFloorPlateStage.test.tsx',
    ];
    // «όνομα-[ … δολάριο-άγκιστρο» χωρίς κενό ενδιάμεσα: το σχήμα που ο σαρωτής παίρνει για αυθαίρετη τιμή.
    const interpolatedClass = new RegExp(['[a-z]-', '\\[', '[^\\]\\s]*', '\\$', '\\{'].join(''), 'u');
    const offenders = files.filter((file) => interpolatedClass.test(fs.readFileSync(path.join(root, file), 'utf8')));
    expect(offenders).toEqual([]);
    // Ο μάρτυρας: η έκφραση ΠΙΑΝΕΙ το σχήμα που έριξε τον server.
    expect(interpolatedClass.test(['stroke-', '[hsl(var(', '$', '{token}))]'].join(''))).toBe(true);
  });
});
