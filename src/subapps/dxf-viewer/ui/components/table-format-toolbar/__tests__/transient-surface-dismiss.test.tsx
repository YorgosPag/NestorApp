/**
 * 🔴 ADR-739 §67.10 — **Η ΓΡΑΜΜΗ ΦΕΥΓΕΙ ΜΟΝΗ ΤΗΣ, ΚΑΙ ΜΟΝΟ ΟΤΑΝ ΠΡΕΠΕΙ.**
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Στις τρεις άλλες υποδοχές το mini toolbar κάθεται πάνω σε μενού Radix, οπότε το κλείσιμό του
 * είναι δωρεάν (`DismissableLayer`). Όταν ο ιδιοκτήτης ζήτησε **μόνο τη γραμμή, χωρίς μενού**
 * (μέτρηση Excel, 10/08), ο κύκλος ζωής έγινε **δικός μας** — και ένας κύκλος ζωής χωρίς άγκυρα
 * είναι επιφάνεια που ή δεν φεύγει ποτέ ή φεύγει τη λάθος στιγμή. Και τα δύο φαίνονται **μόνο με
 * το μάτι**, που είναι ακριβώς ο λόγος που γράφεται εδώ.
 *
 * ## Ο κανόνας είναι του Excel, όχι δικός μας
 * *«if you use the scroll wheel or **press any key** then the toolbar automatically
 * disappears»* — καταγεγραμμένο στο ADR-739 §64 ερευνώντας **άλλο** ελάττωμα.
 *
 * @see ui/components/table-format-toolbar/use-transient-surface-dismiss.ts
 */

import React, { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useTransientSurfaceDismiss } from '../use-transient-surface-dismiss';

/** Μια επιφάνεια με ένα κουμπί μέσα της — δηλαδή το σχήμα της πραγματικής γραμμής. */
function Surface({
  active, dismiss,
}: {
  readonly active: boolean;
  readonly dismiss: () => void;
}): React.ReactElement {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useTransientSurfaceDismiss({ active, surfaceRef, dismiss });
  return (
    <>
      <div ref={surfaceRef} data-testid="surface">
        <button type="button" data-testid="inside">Β</button>
        <input data-testid="inside-field" />
      </div>
      <button type="button" data-testid="outside">έξω</button>
    </>
  );
}

function mount(dismiss: () => void, active = true): void {
  render(<Surface active={active} dismiss={dismiss} />);
}

const el = (id: string): HTMLElement => {
  const node = document.querySelector(`[data-testid="${id}"]`);
  if (!(node instanceof HTMLElement)) throw new Error(`λείπει το ${id}`);
  return node;
};

describe('Δ — οι τρεις αφορμές αποχώρησης (Excel: any key · scroll · κλικ έξω)', () => {
  it('🔴 Δ1 — πάτημα ΕΞΩ από τη γραμμή τη διώχνει', () => {
    const dismiss = jest.fn();
    mount(dismiss);
    fireEvent.pointerDown(el('outside'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('🔴 Δ2 — πάτημα ΜΕΣΑ στη γραμμή ΔΕΝ τη διώχνει', () => {
    // Χωρίς αυτόν τον φύλακα, το πρώτο «Β» θα την έκλεινε στο `pointerdown`, δηλαδή **πριν**
    // εκδοθεί το `click` — η ίδια παγίδα που φυλάει το `useKeepOpenOnSurface` στα τρία μενού.
    const dismiss = jest.fn();
    mount(dismiss);
    fireEvent.pointerDown(el('inside'));
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('🔴 Δ3 — οποιοδήποτε πλήκτρο τη διώχνει (ο χρήστης συνέχισε να γράφει)', () => {
    const dismiss = jest.fn();
    mount(dismiss);
    fireEvent.keyDown(document.body, { key: 'Α' });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('🔴 Δ4 — πλήκτρο ΜΕΣΑ στη γραμμή ΔΕΝ τη διώχνει', () => {
    // Το combobox μεγέθους δέχεται πληκτρολόγηση: χωρίς τον φύλακα, ο πρώτος χαρακτήρας θα
    // εξαφάνιζε το πεδίο που γράφει ο χρήστης.
    const dismiss = jest.fn();
    mount(dismiss);
    const field = el('inside-field');
    field.focus();
    fireEvent.keyDown(field, { key: '1' });
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('Δ5 — η κύλιση τη διώχνει (το σχέδιο κύλησε κάτω από την άγκυρά της)', () => {
    const dismiss = jest.fn();
    mount(dismiss);
    fireEvent.wheel(document.body, { deltaY: 120 });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('🔴 Δ6 — ΤΟ `Escape` ΔΕΝ ΚΑΤΑΝΑΛΩΝΕΤΑΙ — η γραμμή υποχωρεί, δεν το διεκδικεί', () => {
    // Στο Excel το `Escape` σε κατάσταση Επεξεργασίας **ακυρώνει τη γραφή**· η γραμμή φεύγει σαν
    // παρενέργεια. Ένα σκαλί στον escape-bus πάνω από το `MODAL_DIALOG` θα έτρωγε το πλήκτρο και
    // θα άφηνε τον χρήστη μέσα στο κελί με το πρόχειρό του άθικτο, ενώ πάτησε «άκυρο».
    const dismiss = jest.fn();
    mount(dismiss);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('Δ7 — ανενεργή γραμμή: κανένας ακροατής, καμία κλήση', () => {
    const dismiss = jest.fn();
    mount(dismiss, false);
    fireEvent.pointerDown(el('outside'));
    fireEvent.keyDown(document.body, { key: 'Α' });
    fireEvent.wheel(document.body, { deltaY: 120 });
    expect(dismiss).not.toHaveBeenCalled();
  });
});
