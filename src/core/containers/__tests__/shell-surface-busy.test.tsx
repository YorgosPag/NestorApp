/**
 * @fileoverview ΑΓΚΥΡΑ — **`ShellSurface.busy`**: η σελίδα δηλώνει ότι φορτώνει (ADR-797 §Φ.Ρ.3).
 *
 * Ένα σήμα, δύο αναγνώστες: ο αναγνώστης οθόνης (WAI-ARIA `aria-busy`) και η πύλη **CHECK 3.94**, που
 * περιμένει `<main aria-busy="false">` πριν μετρήσει. Μετρημένο 2026-09-26: χωρίς αυτό η πύλη έκρινε
 * ήρεμη μια ΑΔΕΙΑ σελίδα (`/stay`, ~3 s χωρίς πεδίο και κάρτες) — πράσινο που σήμαινε «κανείς δεν κοίταξε».
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ShellSurface } from '../ShellSurface';

describe('ShellSurface — busy', () => {
  it('Β1 · `main` αποδίδει `aria-busy` ΚΑΙ στις δύο τιμές — το "false" είναι ο μάρτυρας ετοιμότητας', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `aria-busy` από το `ShellSurface` ⇒ κοκκινίζει (και η πύλη 3.94 περιμένει για πάντα).
    const { container, rerender } = render(<ShellSurface as="main" busy>x</ShellSurface>);
    expect(container.querySelector('main')).toHaveAttribute('aria-busy', 'true');
    rerender(<ShellSurface as="main" busy={false}>x</ShellSurface>);
    expect(container.querySelector('main')).toHaveAttribute('aria-busy', 'false');
  });

  it('Β2 · σε `div` ΔΕΝ αποδίδεται — όπως το `ariaLabel`, έχει νόημα μόνο στο ορόσημο', () => {
    const { container } = render(<ShellSurface busy>x</ShellSurface>);
    expect(container.firstElementChild).not.toHaveAttribute('aria-busy');
  });

  it('Β3 · σελίδα χωρίς δεδομένα δεν δηλώνει τίποτα', () => {
    const { container } = render(<ShellSurface as="main">x</ShellSurface>);
    expect(container.querySelector('main')).not.toHaveAttribute('aria-busy');
  });
});
