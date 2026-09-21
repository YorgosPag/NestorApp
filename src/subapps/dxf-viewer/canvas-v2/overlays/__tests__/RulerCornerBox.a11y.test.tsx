/**
 * Άγκυρα — **Η ΓΩΝΙΑ ΤΩΝ ΧΑΡΑΚΩΝ ΕΙΝΑΙ ΚΟΥΜΠΙ ΜΕ ΠΡΟΕΠΙΛΕΓΜΕΝΗ ΕΝΕΡΓΕΙΑ ΚΑΙ ΠΡΑΓΜΑΤΙΚΟ ΜΕΝΟΥ**
 *
 * ## Γιατί υπάρχει
 *
 * Ως τις 2026-09-21 το μενού ζουμ ήταν `PopoverContent` με `button[role=menuitem]` **χωρίς**
 * `role="menu"`, χωρίς βελάκια, με `nav` και `aria-pressed` για τις κλίμακες. Το κουμπί
 * δήλωνε `aria-haspopup="menu"`, αλλά το μενού άνοιγε **μόνο** με δεξί κλικ, άρα ήταν
 * απρόσιτο από πληκτρολόγιο (WCAG 2.1.1).
 *
 * Τώρα `DropdownMenu` του SSoT (APG *menu button*), με μία διαφορά: το αριστερό κλικ και το
 * Enter/Space **παραμένουν** «Προσαρμογή» (split button, AutoCAD/Revit). Το μενού ανοίγει με
 * ↓ ή με το μονοπάτι του context menu. Οι κλίμακες είναι `menuitemradio` με `aria-checked`.
 *
 * @see ADR-418 · ADR-598 G11
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RulerCornerBox from '../RulerCornerBox';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { expectNoA11yViolations } from '@/test-utils/a11y';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../systems/zoom/hooks/useViewScale', () => ({
  useViewScale: () => ({ ratioN: 100, label: '1:100' }),
}));

// ⚠️ Το jsdom ΔΕΝ έχει `PointerEvent`: χωρίς αυτό το `fireEvent.pointerDown` δεν φέρει `button`,
// ο handler του Radix δεν τρέχει ποτέ, και το test «αριστερό κλικ δεν ανοίγει μενού» είναι πράσινο
// χωρίς να ρωτά τίποτα (μετρημένο: η μετάλλαξη που αφαιρεί την καταστολή ΕΠΕΖΗΣΕ).
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class JsdomPointerEvent extends MouseEvent {
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerType = init.pointerType ?? 'mouse';
      }
    }
    Object.defineProperty(window, 'PointerEvent', { value: JsdomPointerEvent, configurable: true });
  }
});

function setup() {
  const handlers = {
    onZoomToFit: jest.fn(),
    onZoomActualSize: jest.fn(),
    onZoomIn: jest.fn(),
    onZoomOut: jest.fn(),
    onZoomPrevious: jest.fn(),
    onZoomToRatio: jest.fn(),
  };
  render(
    <RulerCornerBox rulerWidth={30} rulerHeight={30} backgroundColor="#000" textColor="#fff" {...handlers} />,
  );
  const button = document.querySelector('[data-ruler-corner-box]') as HTMLButtonElement;
  return { handlers, button };
}

describe('RulerCornerBox — μενού ζουμ (APG menu button με προεπιλεγμένη ενέργεια)', () => {
  it('κλειστό: το κουμπί υπόσχεται μενού (από το Radix) και περνά το axe', async () => {
    const { button } = setup();
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await expectNoA11yViolations(document.body);
  });

  it('↓ ανοίγει ΠΡΑΓΜΑΤΙΚΟ μενού: 5 ενέργειες + 6 κλίμακες ως menuitemradio, η ενεργή σημειωμένη', async () => {
    const { button } = setup();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(5);
    const radios = screen.getAllByRole('menuitemradio');
    expect(radios.map((r) => r.textContent)).toEqual(['1:1', '1:20', '1:50', '1:100', '1:200', '1:500']);
    expect(screen.getByRole('menuitemradio', { name: '1:100' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: '1:50' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('group', { name: 'rulerCornerBox.menu.viewScalePresets' })).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await expectNoA11yViolations(document.body);
  });

  it('αριστερό κλικ (pointerdown + click) = Προσαρμογή, και ΔΕΝ ανοίγει μενού', () => {
    jest.useFakeTimers();
    try {
      const { handlers, button } = setup();
      fireEvent.pointerDown(button, { button: 0, ctrlKey: false, pointerType: 'mouse' });
      fireEvent.click(button);
      act(() => {
        jest.advanceTimersByTime(PANEL_LAYOUT.TIMING.DOUBLE_CLICK_WINDOW + 10);
      });
      expect(handlers.onZoomToFit).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Enter = Προσαρμογή, και ΔΕΝ ανοίγει μενού', () => {
    const { handlers, button } = setup();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handlers.onZoomToFit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('δεξί κλικ / Shift+F10 (contextmenu) ανοίγει το μενού', async () => {
    const { button } = setup();
    fireEvent.contextMenu(button);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('επιλογή ενέργειας την εκτελεί και κλείνει το μενού', async () => {
    const { handlers, button } = setup();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /rulerCornerBox\.menu\.zoomIn/ }));
    expect(handlers.onZoomIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('επιλογή κλίμακας ⇒ onZoomToRatio(N)', async () => {
    const { handlers, button } = setup();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: '1:50' }));
    expect(handlers.onZoomToRatio).toHaveBeenCalledWith(50);
  });
});
