/**
 * @fileoverview ΑΓΚΥΡΑ: **`MainLandmark`**, ένα ορόσημο `main` ανά σελίδα, όπου κι αν αποδοθεί η οθόνη (ADR-939 §6.1 Γ2).
 *
 * 🔴 Μετρημένο 2026-11-12: το `ErrorFallbackUI` απέδιδε ΠΑΝΤΑ `<main>`. Στους 52 `error.tsx` του `(app)` αυτό
 * έδινε ΔΙΠΛΟ ορόσημο (το κέλυφος δίνει ήδη `ShellSurface as="main"`). Το `BackendUnavailableFallback` δεν
 * απέδιδε κανένα, οπότε στην `(link)` η σελίδα έμενε ΧΩΡΙΣ `main`.
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { BackendUnavailableFallback } from '@/components/ui/ErrorBoundary/BackendUnavailableFallback';

import { MainLandmark } from '../main-landmark';
import { ShellSurface } from '../ShellSurface';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('MainLandmark', () => {
  it('Μ1 · χωρίς πρόγονο `main` ⇒ αποδίδει `main` (σελίδα χωρίς κέλυφος: `(link)`, `global-error`)', () => {
    const { container } = render(<MainLandmark className="k">x</MainLandmark>);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('main')).toHaveClass('k');
  });

  it('Μ2 · μέσα σε `ShellSurface as="main"` ⇒ `div` με την ΙΔΙΑ κλάση, ΕΝΑ ορόσημο συνολικά', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `MainLandmarkScope` από το `ShellSurface` ⇒ 2 `main` ⇒ κοκκινίζει.
    const { container } = render(
      <ShellSurface as="main"><MainLandmark className="k">x</MainLandmark></ShellSurface>,
    );
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelector('main > div.k')).toBeInTheDocument();
  });

  it('Μ3 · `ShellSurface` ως `div` ΔΕΝ δηλώνει πεδίο: δεν είναι ορόσημο', () => {
    const { container } = render(<ShellSurface><MainLandmark>x</MainLandmark></ShellSurface>);
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });

  it('Μ4 · φωλιασμένα `MainLandmark` ⇒ μόνο το εξωτερικό γίνεται `main`', () => {
    const { container } = render(<MainLandmark><MainLandmark>x</MainLandmark></MainLandmark>);
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });
});

describe('BackendUnavailableFallback — ορόσημο', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Μ5 · έξω από κέλυφος ⇒ ΕΝΑ `main` (ήταν μηδέν)', () => {
    const { container } = render(<BackendUnavailableFallback />);
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });

  it('Μ6 · μέσα στο κέλυφος ⇒ κανένα δεύτερο `main`', () => {
    const { container } = render(<ShellSurface as="main"><BackendUnavailableFallback /></ShellSurface>);
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });
});
