/**
 * Κλείδωμα του `scrollResetToken` του DetailsContainer (ADR-332 D19).
 *
 * ΤΙ ΠΡΟΣΤΑΤΕΥΕΙ: όταν κλείνει ένας inline editor, το περιεχόμενο του πάνακα
 * συρρικνώνεται κατά εκατοντάδες pixel ενώ το `scrollTop` μένει εκεί που ήταν.
 * Ο χρήστης έβλεπε το κάτω κομμάτι μιας πλέον κοντής λίστας — χωρίς επικεφαλίδα
 * ενότητας και χωρίς μπάρα καρτελών — και το διάβαζε ως **απώλεια δεδομένων**
 * τη στιγμή ακριβώς που το σύστημα έλεγε «αποθηκεύτηκε επιτυχώς».
 *
 * Το container της κύλισης είναι ΕΝΑ και ζει στον DetailsContainer, οπότε εδώ
 * κλειδώνεται και η συμπεριφορά — για κάθε σελίδα λεπτομερειών, όχι μόνο επαφές.
 *
 * @module core/containers/__tests__/details-container-scroll-reset
 */

import React from 'react';
import { render } from '@testing-library/react';

// ─── Mocks (απλά στοιχεία — ελέγχουμε καλωδίωση, όχι styling) ────────────────

jest.mock('@/lib/design-system', () => ({}), { virtual: true });

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ xl4: 'xl4' }),
}));

jest.mock('@/hooks/useSpacingTokens', () => ({
  useSpacingTokens: () => ({
    padding: { lg: 'p-lg', sm: 'p-sm' },
    margin: { bottom: { md: 'mb-md' } },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/i18n/namespace-bundles', () => ({ COMMON_NAMESPACES: [] }));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: 'muted' } }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
}));

import { DetailsContainer } from '../DetailsContainer';

const SELECTED = { id: 'c1', name: 'Δοκιμή' };

/**
 * Το jsdom δεν υλοποιεί `Element.scrollTo`. Το εγκαθιστούμε στο prototype ώστε
 * να καταγράφονται όλες οι κλήσεις ανεξάρτητα από ποιο στοιχείο τις δέχεται.
 */
function installScrollToSpy(): jest.Mock {
  const spy = jest.fn();
  Object.defineProperty(Element.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: spy,
  });
  return spy;
}

describe('DetailsContainer — scrollResetToken', () => {
  let scrollTo: jest.Mock;

  beforeEach(() => {
    scrollTo = installScrollToSpy();
  });

  it('δεν κυλά στο πρώτο mount, ακόμη κι όταν δίνεται token', () => {
    render(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={0}>
        <p>περιεχόμενο</p>
      </DetailsContainer>,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('επαναφέρει την κύλιση στην κορυφή όταν αλλάξει το token', () => {
    const { rerender } = render(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={0}>
        <p>περιεχόμενο</p>
      </DetailsContainer>,
    );

    rerender(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={1}>
        <p>περιεχόμενο</p>
      </DetailsContainer>,
    );

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('δεν κυλά σε re-render με αμετάβλητο token', () => {
    const { rerender } = render(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={7}>
        <p>πρώτο</p>
      </DetailsContainer>,
    );

    rerender(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={7}>
        <p>δεύτερο</p>
      </DetailsContainer>,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('κυλά ξανά σε κάθε νέα αλλαγή token (διαδοχικές συνεδρίες επεξεργασίας)', () => {
    const { rerender } = render(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={0}>
        <p>περιεχόμενο</p>
      </DetailsContainer>,
    );

    rerender(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={1}>
        <p>περιεχόμενο</p>
      </DetailsContainer>,
    );
    rerender(
      <DetailsContainer selectedItem={SELECTED} scrollResetToken={2}>
        <p>περιεχόμενο</p>
      </DetailsContainer>,
    );

    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('δεν σκάει όταν το token αλλάζει ενώ προβάλλεται η κενή κατάσταση', () => {
    const { rerender } = render(
      <DetailsContainer selectedItem={null} scrollResetToken={0} />,
    );

    expect(() =>
      rerender(<DetailsContainer selectedItem={null} scrollResetToken={1} />),
    ).not.toThrow();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('παραμένει αδρανές όταν δεν δίνεται καθόλου token (υπόλοιπες σελίδες λεπτομερειών)', () => {
    const { rerender } = render(
      <DetailsContainer selectedItem={SELECTED}>
        <p>πρώτο</p>
      </DetailsContainer>,
    );

    rerender(
      <DetailsContainer selectedItem={SELECTED}>
        <p>δεύτερο</p>
      </DetailsContainer>,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
