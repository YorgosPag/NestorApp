/**
 * ADR-363 — «Ετικέτες ανοιγμάτων» ribbon toggle ↔ `opening-tag-layer` SSoT.
 *
 * Το widget μετακινήθηκε από το αριστερό panel (πρώην `AnnotationsSection`) στο
 * contextual tab «Ιδιότητες Ανοίγματος». Ελέγχει το ΠΡΑΓΜΑΤΙΚΟ wiring στο in-memory
 * layer store (όχι mock store): default ορατό → pressed, click → flip της ορατότητας,
 * και ότι μια ήδη-κρυμμένη κατάσταση αποδίδεται σωστά. Mock μόνο i18n + semantic colors
 * (ίδιο μοτίβο με `RibbonToggleWidget.test.tsx`), ώστε ο έλεγχος να μένει στο wiring.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { OpeningTagLayerToggle } from '../OpeningTagLayerToggle';
import {
  isOpeningTagLayerVisible,
  setOpeningTagLayerVisible,
  __resetOpeningTagLayerForTests,
} from '../../../../systems/layers/opening-tag-layer';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    bg: { backgroundSecondary: 'bg-secondary' },
    text: { info: 'text-info', secondary: 'text-secondary', muted: 'text-muted' },
  }),
}));

describe('OpeningTagLayerToggle — wires to opening-tag-layer SSoT (ADR-363)', () => {
  afterEach(() => __resetOpeningTagLayerForTests());

  it('reflects the store default (visible → pressed, offers the hide action)', () => {
    const { getByRole } = render(<OpeningTagLayerToggle />);
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('true'); // default ON
    expect(btn.textContent).toContain('ribbon.commands.openingEditor.tagVisibility.hide');
    expect(btn.getAttribute('aria-label')).toBe(
      'ribbon.commands.openingEditor.tagVisibility.tooltipHide',
    );
  });

  it('reflects a hidden store (value=false → not pressed, offers the show action)', () => {
    setOpeningTagLayerVisible(false);
    const { getByRole } = render(<OpeningTagLayerToggle />);
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.textContent).toContain('ribbon.commands.openingEditor.tagVisibility.show');
  });

  it('click flips the SSoT store visibility (both directions)', () => {
    const { getByRole } = render(<OpeningTagLayerToggle />);
    expect(isOpeningTagLayerVisible()).toBe(true);
    fireEvent.click(getByRole('button'));
    expect(isOpeningTagLayerVisible()).toBe(false);
    fireEvent.click(getByRole('button'));
    expect(isOpeningTagLayerVisible()).toBe(true);
  });
});
