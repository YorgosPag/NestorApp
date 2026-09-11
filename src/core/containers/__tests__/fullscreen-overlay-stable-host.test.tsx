/**
 * @jest-environment jsdom
 *
 * ADR-241 · ADR-780 §5quater.5 #7 — **Η ΠΛΗΡΗΣ ΟΘΟΝΗ ΔΕΝ ΞΑΝΑΧΤΙΖΕΙ ΤΑ ΠΑΙΔΙΑ ΤΗΣ.**
 *
 * 🔴 Μετρημένο ζωντανά 2026-09-11: το `FullscreenOverlay` επέστρεφε `<section>{children}</section>` ή
 * `createPortal(<section>{children}</section>, body)` — **άλλη θέση στο δέντρο** ⇒ το React ξαναπροσάρτα τα παιδιά σε
 * κάθε εναλλαγή, αντίθετα με το σχόλιο «Children are NOT remounted — state is preserved»:
 *   - Νομικά: ανοιχτό πεδίο «Ανάθεση επαγγελματία» **χάθηκε** στην έξοδο από την πλήρη οθόνη·
 *   - DXF: **4/4 καμβάδες** αντικαταστάθηκαν στην είσοδο **και** στην έξοδο (probe στα στοιχεία `<canvas>`).
 * Και μια δεύτερη συνέπεια: το κουμπί που άνοιξε την πλήρη οθόνη **δεν υπάρχει πια** στην έξοδο, άρα η επαναφορά
 * focus σε αυτό ήταν αδύνατη.
 *
 *  D1 — ο **ίδιος** κόμβος DOM (`===`) με την **ίδια** τιμή σε δύο εναλλαγές.
 *  D2 — ένα mount, όσες εναλλαγές κι αν γίνουν.
 *  D3 — η κλάση του καταναλωτή ζει στον **άμεσο** γονέα των παιδιών και στις δύο μορφές (`space-y-*` της Tailwind 3.4
 *       είναι επιλογέας παιδιού — σε ενδιάμεσο wrapper θα έπαυε σιωπηλά να ισχύει).
 */

import React, { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';

let mounts = 0;

function MountCounter(): null {
  useEffect(() => {
    mounts += 1;
  }, []);
  return null;
}

function Harness({ isFullscreen }: { isFullscreen: boolean }): React.ReactElement {
  return (
    <FullscreenOverlay
      isFullscreen={isFullscreen}
      onToggle={() => undefined}
      ariaLabel="Δοκιμή"
      className="space-y-2"
      fullscreenClassName="p-4 space-y-3"
    >
      <input data-testid="probe" defaultValue="" aria-label="probe" />
      <MountCounter />
    </FullscreenOverlay>
  );
}

beforeEach(() => {
  mounts = 0;
});

describe('D1 — ο ίδιος κόμβος, η ίδια τιμή', () => {
  test('είσοδος και έξοδος: `===` και η πληκτρολογημένη τιμή επιβιώνει', () => {
    const view = render(<Harness isFullscreen={false} />);
    const probe = screen.getByTestId('probe') as HTMLInputElement;
    fireEvent.change(probe, { target: { value: 'Ανάθεση' } });

    act(() => view.rerender(<Harness isFullscreen />));
    const inFullscreen = screen.getByTestId('probe') as HTMLInputElement;
    expect(inFullscreen).toBe(probe);
    expect(inFullscreen.value).toBe('Ανάθεση');
    expect(inFullscreen.closest('[role="dialog"]')).not.toBeNull();

    act(() => view.rerender(<Harness isFullscreen={false} />));
    const back = screen.getByTestId('probe') as HTMLInputElement;
    expect(back).toBe(probe);
    expect(back.value).toBe('Ανάθεση');
    expect(back.closest('[role="dialog"]')).toBeNull();
  });
});

describe('D2 — ένα mount', () => {
  test('δύο εναλλαγές ⇒ τα παιδιά προσαρτήθηκαν ΜΙΑ φορά', () => {
    const view = render(<Harness isFullscreen={false} />);
    act(() => view.rerender(<Harness isFullscreen />));
    act(() => view.rerender(<Harness isFullscreen={false} />));
    expect(mounts).toBe(1);
  });
});

describe('D5 — η επιφάνεια μένει προσαρτημένη, κρυφή', () => {
  /**
   * Αν η επιφάνεια ξεπροσαρτιόταν στην έξοδο, το React θα την αφαιρούσε από το DOM **πριν** τρέξουν οι layout
   * effects — με τον ξενιστή μέσα της. Ο ξενιστής θα επέστρεφε μετά με `appendChild` (γι' αυτό το D1 δεν το βλέπει στο
   * jsdom), αλλά **αποσυνδεδεμένος**: χωρίς `moveBefore`, focus χαμένο, iframes ξαναφορτωμένα. Η απόφαση καρφώνεται
   * εδώ· το όφελος μετριέται ζωντανά.
   */
  test('μετά την έξοδο η επιφάνεια υπάρχει στο DOM, `hidden`, χωρίς κλάσεις διάταξης', () => {
    const view = render(<Harness isFullscreen />);
    act(() => view.rerender(<Harness isFullscreen={false} />));
    const surface = document.querySelector('[data-fullscreen-surface]');
    expect(surface).not.toBeNull();
    expect(surface?.hasAttribute('hidden')).toBe(true);
    // Ένα `flex` σε κρυφή επιφάνεια θα νικούσε το `[hidden]{display:none}` του preflight (ίδια ειδικότητα).
    expect(surface?.getAttribute('class') ?? '').not.toMatch(/(^|\s)(flex|grid|block)(\s|$)/);
  });

  test('η επιφάνεια δεν δηλώνει `aria-modal` (με συνοδό έξω της, θα έκρυβε την παλέτα του DXF στο VoiceOver)', () => {
    render(<Harness isFullscreen />);
    const surface = document.querySelector('[data-fullscreen-surface]');
    expect(surface?.getAttribute('role')).toBe('dialog');
    expect(surface?.hasAttribute('aria-modal')).toBe(false);
  });
});

describe('D3 — η κλάση του καταναλωτή στον άμεσο γονέα', () => {
  test('inline ⇒ `className`', () => {
    render(<Harness isFullscreen={false} />);
    const parent = screen.getByTestId('probe').parentElement;
    expect(parent?.className).toContain('space-y-2');
  });

  test('πλήρης οθόνη ⇒ `fullscreenClassName`', () => {
    render(<Harness isFullscreen />);
    const parent = screen.getByTestId('probe').parentElement;
    expect(parent?.className).toContain('space-y-3');
    expect(parent?.className).toContain('p-4');
  });
});
