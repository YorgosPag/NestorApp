/**
 * @jest-environment jsdom
 *
 * @fileoverview **Το φύλλο της κάτοψης ορόφου, ΕΚΤΕΛΕΣΜΕΝΟ** — η άγκυρα που έλειπε (ADR-907 §11.11 · §11.12).
 * @related components/listing-detail/ListingFloorPlates · lib/listings/floor-plate/floor-plate-publication
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: στο πέρασμα μεταλλάξεων του Βήματος 9 η μετάλλαξη αυτού του αρχείου **δεν άφησε μάρτυρα** — η
 * σουίτα της σκηνής αποδίδει τη σκηνή απευθείας και η σουίτα της καρτέλας **υποκαθιστά** το φύλλο. Κανείς δεν το φόρτωνε.
 *
 * Εδώ **τίποτα από την αλυσίδα δεν είναι ψεύτικο**: ο αληθινός κριτής (`presentableFloorPlate`), το αληθινό όριο
 * `next/dynamic`, η αληθινή σκηνή. Ψεύτικα μόνο η μετάφραση (αφήνει ίχνος) και η διαδρομή.
 *
 * ΦΟ-1 — κάτοψη που ο κριτής δέχεται ⇒ ενότητα **με όνομα**, και η σκηνή της ζωγραφίζει τις μονάδες ΑΥΤΗΣ της κάτοψης;
 * ΦΟ-2 — 🔴 κάτοψη που ο κριτής αρνείται ⇒ **τίποτα**: ούτε ενότητα, ούτε ονομασμένη απουσία, ούτε μισός όροφος;
 * ΦΟ-3 — η σκηνή **δεν** είναι στο πρώτο καρέ: πριν φορτώσει υπάρχει μόνο θέση αναμονής που ο αναγνώστης οθόνης δεν ακούει;
 * ΦΟ-4 — καμία επικεφαλίδα: το φύλλο ζει μέσα σε καρτέλα που λέει ήδη «Κάτοψη ορόφου».
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TooltipProvider } from '@/components/ui/tooltip';

import { ListingFloorPlates } from '../ListingFloorPlates';

// Η μετάφραση ΑΦΗΝΕΙ ΙΧΝΟΣ: με ταυτοτική `t` ένα κλειδί που έφτασε αμετάφραστο δεν ξεχωρίζει από μεταφρασμένο.
const tr = (key: string): string => `t(${key})`;
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => `t(${key})` }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/listing/prop_1',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn() }),
}));

const SQUARE = [0.1, 0.1, 0.4, 0.1, 0.4, 0.4, 0.1, 0.4];
const BESIDE = [0.5, 0.1, 0.9, 0.1, 0.9, 0.4, 0.5, 0.4];
const BELOW = [0.1, 0.5, 0.4, 0.5, 0.4, 0.9, 0.1, 0.9];
const IMAGE = { url: 'https://shelf/floor.webp', width: 2000, height: 1000, altKey: 'listing-detail:floorPlate.alt', sources: [] };

const SELF = { outline: SQUARE, state: 'self' };
const NEIGHBOUR = { outline: BESIDE, state: 'available', listingId: 'prop_2' };
const RESERVED = { outline: BELOW, state: 'reserved' };

function plate(units: readonly unknown[], overrides: Record<string, unknown> = {}) {
  return { provenance: 'declared', at: '2026-10-10T08:00:00.000Z', value: { image: IMAGE, units }, ...overrides };
}

function renderLeaf(floorPlates: readonly unknown[]) {
  // Ο `TooltipProvider` έρχεται από το `(light)/layout.tsx` (ADR-813)· εδώ το δίνει το test.
  return render(
    <TooltipProvider><ListingFloorPlates listing={{ id: 'prop_1', floorPlates } as never} /></TooltipProvider>,
  );
}

const layerOf = (container: HTMLElement) => container.querySelector('[data-floor-plate-layer]');
const unitsOf = (container: HTMLElement) => container.querySelectorAll('[data-floor-plate-layer] [data-floor-plate-unit]');

describe('ListingFloorPlates', () => {
  it('🔴 ΦΟ-1 κάτοψη που ο κριτής δέχεται ⇒ ενότητα με όνομα, και η ΑΛΗΘΙΝΗ σκηνή ζωγραφίζει τις μονάδες της', async () => {
    const { container } = renderLeaf([plate([SELF, NEIGHBOUR, RESERVED])]);

    expect(screen.getByRole('region', { name: tr('listing-detail:media.tabs.floorPlate') })).toBeInTheDocument();
    await waitFor(() => expect(layerOf(container)).not.toBeNull());

    // Η σκηνή πήρε ΑΥΤΗ την κάτοψη: τρεις μονάδες, και το κάδρο είναι τα φυσικά pixels της εικόνας της.
    expect(unitsOf(container)).toHaveLength(3);
    expect(layerOf(container)?.getAttribute('viewBox')).toBe('0 0 2000 1000');
    expect(screen.getByRole('region', { name: tr('listing-detail:media.tabs.floorPlate') })).toContainElement(
      layerOf(container) as HTMLElement,
    );
  });

  it('ΦΟ-1β δεύτερη κάτοψη με άλλες μονάδες ⇒ η σκηνή ακολουθεί το έγγραφο, δεν καρφώνει τίποτα', async () => {
    const { container } = renderLeaf([plate([SELF, NEIGHBOUR], { value: { image: { ...IMAGE, width: 1200, height: 900 }, units: [SELF, NEIGHBOUR] } })]);

    await waitFor(() => expect(layerOf(container)).not.toBeNull());

    expect(unitsOf(container)).toHaveLength(2);
    expect(layerOf(container)?.getAttribute('viewBox')).toBe('0 0 1200 900');
  });

  // Κάθε γραμμή είναι άλλος λόγος άρνησης του ΙΔΙΟΥ κριτή. Φύλλο που διαβάζει `floorPlates[0]` αντί να ρωτά τον κριτή
  // τις ζωγραφίζει όλες — και η καρτέλα (που τον ρωτά) δεν θα υπήρχε καν.
  it.each([
    ['καμία κάτοψη', []],
    ['μάντεμα που κανείς δεν ενέκρινε', [plate([SELF, NEIGHBOUR], { provenance: 'inferred', confirmedAt: null })]],
    ['καμία μονάδα «αυτό το ακίνητο»', [plate([NEIGHBOUR, RESERVED])]],
    ['δύο μονάδες «αυτό το ακίνητο»', [plate([SELF, { ...SELF, outline: BESIDE }])]],
    ['εικόνα χωρίς διαστάσεις', [plate([SELF], { value: { image: { ...IMAGE, width: 0 }, units: [SELF] } })]],
    ['μία μονάδα με άκυρο περίγραμμα', [plate([SELF, { outline: [0.1, 0.1], state: 'available' }])]],
  ])('🔴 ΦΟ-2 %s ⇒ ΤΙΠΟΤΑ, ούτε ονομασμένη απουσία', async (_label, floorPlates) => {
    const { container } = renderLeaf(floorPlates);

    expect(container.innerHTML).toBe('');
    // Ούτε αργότερα: αν η σκηνή είχε ζητηθεί, θα εμφανιζόταν μόλις λυνόταν το `import()`.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.innerHTML).toBe('');
  });

  /**
   * ⚠️ **Μετρημένο**: μέσα στο jest το αληθινό `next/dynamic` λύνει το `import()` **σύγχρονα** — η σκηνή είναι ήδη στο
   * πρώτο καρέ και η θέση αναμονής δεν αποδίδεται ποτέ. Άρα το όριο δεν φαίνεται από το DOM· εδώ διαβάζεται η **δήλωσή**
   * του (τι ζητήθηκε από το `next/dynamic`), και ο φορτωτής **εκτελείται**. Ότι η εικόνα δεν ζητείται πριν ανοίξει η
   * καρτέλα το μετρά μόνο η καταγραφή δικτύου ενός browser.
   */
  it('ΦΟ-3 η σκηνή ζει πίσω από ΕΝΑ όριο `next/dynamic` χωρίς SSR, με θέση αναμονής αόρατη στον αναγνώστη οθόνης', async () => {
    type Loader = () => Promise<unknown>;
    interface Boundary {
      readonly loader: Loader;
      readonly options: { readonly ssr?: boolean; readonly loading?: () => React.ReactElement };
    }
    const boundaries: Boundary[] = [];

    jest.isolateModules(() => {
      jest.doMock('next/dynamic', () => ({
        __esModule: true,
        default: (loader: Loader, options: Boundary['options']) => {
          boundaries.push({ loader, options });
          return () => null;
        },
      }));
      require('../ListingFloorPlates');
    });
    jest.dontMock('next/dynamic');

    expect(boundaries).toHaveLength(1);
    const [{ loader, options }] = boundaries;
    expect(options.ssr).toBe(false);

    // Ο φορτωτής ΕΚΤΕΛΕΙΤΑΙ: εξαγωγή που μετονομάστηκε θα έδινε `undefined` και κενή καρτέλα στον επισκέπτη.
    const loaded = await loader();
    expect(typeof loaded).toBe('function');
    expect((loaded as { name: string }).name).toBe('ListingFloorPlateStage');

    expect(options.loading).toBeDefined();
    const { container } = render(options.loading?.() ?? <></>);
    const placeholder = container.firstElementChild;
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveAttribute('aria-hidden');
    expect(container.textContent).toBe('');
  });

  it('ΦΟ-4 καμία επικεφαλίδα — ούτε του φύλλου, ούτε της σκηνής του', async () => {
    const { container } = renderLeaf([plate([SELF, NEIGHBOUR])]);

    await waitFor(() => expect(layerOf(container)).not.toBeNull());

    expect(screen.queryByRole('heading')).toBeNull();
  });
});
