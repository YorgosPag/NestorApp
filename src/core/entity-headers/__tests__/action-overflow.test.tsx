/**
 * Υ6 — **ΟΙ ΕΝΕΡΓΕΙΕΣ ΥΠΟΧΩΡΟΥΝ, ΤΟ ΟΝΟΜΑ ΟΧΙ** (ADR-777 §8.87.7).
 *
 * 🔴 **Η αφορμή, μετρημένη στην παραγωγή (2026-10-08)**: στη στενή δεξιά στήλη του `/spaces/properties`, πέντε ενέργειες
 * (820px) μέσα σε γραμμή 517–671px ⇒ τίτλος **0px** και το τελευταίο κουμπί κομμένο. Η §8.87.2 είχε θεραπεύσει μόνο
 * τον κλάδο `media`· ο κλάδος χωρίς `media` — που τροφοδοτεί ~20 κεφαλίδες — κρατούσε το ίδιο σφάλμα.
 *
 * ⚠️ **Τι αποδεικνύει και τι όχι.** Το jsdom δεν έχει διάταξη: η αριθμητική (`countFittingActions`) ελέγχεται με τα
 * **μετρημένα** πλάτη της παραγωγής, και η συμπεριφορά με ψεύτικο παρατηρητή + ψεύτικα πλάτη. Το ότι το πλέγμα δίνει
 * πράγματι αυτόν τον χώρο στον browser **δεν** αποδεικνύεται εδώ — μετριέται ζωντανά.
 */

/* global describe, it, expect, jest, beforeEach, afterEach */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';

import { countFittingActions } from '../action-overflow';
import { createEntityAction } from '../entity-action-presets';
import { EntityDetailsHeader } from '../UnifiedEntityHeaderSystem';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Τα πέντε κουμπιά της στενής στήλης. **Μετρημένο** είναι το σύνολο (820px μαζί με τέσσερα κενά των 8px)· ο
 * επιμερισμός ανά κουμπί είναι ενδεικτικός.
 */
const PRODUCTION_WIDTHS = [172, 138, 142, 176, 160];
const GAP = 8;
const MORE = 32;

describe('Υ6α — `countFittingActions`: η αριθμητική', () => {
  it('✅ χωρούν όλες ⇒ όλες, χωρίς να κρατηθεί χώρος για το «Περισσότερα»', () => {
    expect(countFittingActions(PRODUCTION_WIDTHS, 820, GAP, MORE)).toBe(5);
  });

  it('🔴 1px λιγότερο ⇒ φεύγει ενέργεια, και ο χώρος του «Περισσότερα» ΜΕΤΡΑ', () => {
    // 819 − 32 (μενού) = 787: 172+8+138+8+142+8+176+8 = 660 χωρά, +160+8 = 828 όχι.
    expect(countFittingActions(PRODUCTION_WIDTHS, 819, GAP, MORE)).toBe(4);
  });

  it('🔴 τα μετρημένα πλάτη της παραγωγής: 403px ⇒ 2 ενέργειες · 249px ⇒ 1', () => {
    expect(countFittingActions(PRODUCTION_WIDTHS, 403, GAP, MORE)).toBe(2);
    expect(countFittingActions(PRODUCTION_WIDTHS, 249, GAP, MORE)).toBe(1);
  });

  it('✅ δεν χωρά ούτε η πρώτη ⇒ 0 ορατές (όλες στο μενού), ποτέ αρνητικός', () => {
    expect(countFittingActions(PRODUCTION_WIDTHS, 100, GAP, MORE)).toBe(0);
  });

  it('🔴 ΑΜΕΤΡΗΤΟΣ χώρος (0) ⇒ ΟΛΕΣ: το «δεν ξέρω» δεν κρύβει τίποτα', () => {
    expect(countFittingActions(PRODUCTION_WIDTHS, 0, GAP, MORE)).toBe(5);
    expect(countFittingActions(PRODUCTION_WIDTHS, Number.NaN, GAP, MORE)).toBe(5);
  });

  it('✅ κλασματικά πλάτη (zoom 80%) δεν ρίχνουν ενέργεια για μισό pixel', () => {
    expect(countFittingActions([100.3, 100.3], 208.4, GAP, MORE)).toBe(2);
  });
});

// ── Συμπεριφορά: ψεύτικος παρατηρητής + ψεύτικα πλάτη ─────────────────────────────────────────────────────────────

type ObserverCallback = (entries: readonly { contentBoxSize: readonly { inlineSize: number; blockSize: number }[] }[]) => void;

let notifyResize: (width: number) => void = () => undefined;
let containerWidth = 0;

const LABELS = ['Άνοιγμα', 'Επεξεργασία', 'Νέο', 'Επίδειξη', 'Κάδος'];

function installLayout() {
  class FakeResizeObserver {
    constructor(private readonly callback: ObserverCallback) {
      notifyResize = (width) => {
        containerWidth = width;
        this.callback([{ contentBoxSize: [{ inlineSize: width, blockSize: 32 }] }]);
      };
    }
    observe() { /* η πρώτη μέτρηση γίνεται από το `getBoundingClientRect` */ }
    disconnect() { /* τίποτα να αποσυνδεθεί */ }
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, writable: true, value: FakeResizeObserver });

  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const index = LABELS.findIndex((label) => this.textContent === label);
    const width = this.hasAttribute('data-entity-action')
      ? PRODUCTION_WIDTHS[index] ?? 0
      : this.hasAttribute('data-entity-action-more')
        ? MORE
        : containerWidth;
    return { width, height: 32, top: 0, left: 0, right: width, bottom: 32, x: 0, y: 0, toJSON: () => ({}) };
  });
}

function mountHeader(initialWidth: number) {
  containerWidth = initialWidth;
  const handlers = LABELS.map(() => jest.fn());
  const actions = LABELS.map((label, index) => createEntityAction('edit', label, handlers[index]));
  render(<EntityDetailsHeader icon={User} title="ΔΟΚΙΜΗ — κάδος (χωρίς αναφορές)" actions={actions} />);
  return handlers;
}

const visibleActions = () => screen.queryAllByRole('button').map((button) => button.textContent);

describe('Υ6β — η γραμμή ενεργειών της κεφαλίδας', () => {
  beforeEach(installLayout);
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  });

  it('✅ ΠΑΡΟΝΟΜΑΣΤΗΣ: αρκετός χώρος ⇒ και οι πέντε, κανένα μενού', () => {
    mountHeader(900);

    expect(visibleActions()).toEqual(LABELS);
    expect(screen.queryByRole('button', { name: 'actions.more' })).toBeNull();
  });

  it('🔴 στενή στήλη (403px): μένουν οι ΔΥΟ ΠΡΩΤΕΣ, οι άλλες δεν εστιάζονται ούτε διαβάζονται', () => {
    mountHeader(403);

    // `getAllByRole` αγνοεί ό,τι είναι `aria-hidden` — ακριβώς ό,τι βλέπει ένας αναγνώστης οθόνης.
    expect(visibleActions()).toEqual(['Άνοιγμα', 'Επεξεργασία', '']);
    expect(screen.getByRole('button', { name: 'actions.more' })).toBeInTheDocument();
    expect(screen.getByText('Κάδος').closest('button')).toHaveAttribute('tabindex', '-1');
    // Ο τίτλος ζει ακόμη, ολόκληρος, ως επικεφαλίδα.
    expect(screen.getByRole('heading', { level: 3, name: 'ΔΟΚΙΜΗ — κάδος (χωρίς αναφορές)' })).toBeInTheDocument();
  });

  it('🔴 η ενέργεια που κρύφτηκε ΕΚΤΕΛΕΙΤΑΙ από το μενού — καμία δεν χάνεται', async () => {
    const handlers = mountHeader(403);

    await userEvent.click(screen.getByRole('button', { name: 'actions.more' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Νέο', 'Επίδειξη', 'Κάδος']);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Κάδος' }));
    expect(handlers[4]).toHaveBeenCalledTimes(1);
    expect(handlers[0]).not.toHaveBeenCalled();
  });

  it('🔴 ο χώρος που ΞΑΝΑΒΡΙΣΚΕΤΑΙ φαίνεται: η στήλη πλαταίνει ⇒ οι ενέργειες γυρίζουν, το μενού φεύγει', () => {
    mountHeader(249);
    expect(visibleActions()).toEqual(['Άνοιγμα', '']);

    act(() => notifyResize(900));

    expect(visibleActions()).toEqual(LABELS);
    expect(screen.queryByRole('button', { name: 'actions.more' })).toBeNull();
  });
});

describe('Υ6γ — χωρίς μέτρηση (jsdom · SSR)', () => {
  it('✅ φαίνονται ΟΛΕΣ: καμία ενέργεια δεν κρύβεται από χώρο που δεν μετρήθηκε', () => {
    mountHeader(0);

    expect(visibleActions()).toEqual(LABELS);
  });

  it('✅ ο κλάδος `media` ΔΕΝ υπερχειλίζει — αναδιπλώνεται, όπως μετρήθηκε στη §8.87.5', () => {
    const actions = LABELS.map((label) => createEntityAction('edit', label, jest.fn()));
    const { container } = render(
      <EntityDetailsHeader icon={User} title="Δοκιμή" actions={actions} media={<figure />} />,
    );

    expect(container.querySelector('.flex-wrap.max-w-full')).not.toBeNull();
    expect(container.querySelector('.flex-row-reverse')).toBeNull();
  });
});
