/**
 * AddressResolutionSlot — the resolution band must not move controls (ADR-332).
 *
 * The failure this pins: the reconciliation and suggestions panels mount inline
 * about two seconds after the last keystroke, pushing everything below them
 * down. A user aiming at «Άφησέ τα όλα» hit Save and the contact was written.
 *
 * jsdom does no layout, so height cannot be measured here. What *is* observable
 * — and what actually carries the guarantee — is when the band holds space: it
 * must claim it while the editor is still resolving, keep it across the handover
 * from one panel to the other, and let go only once the cycle is over.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { AddressResolutionSlot, type AddressResolutionSlotProps } from '../components/AddressResolutionSlot';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const reconciliation: AddressResolutionSlotProps['reconciliation'] = {
  conflicts: [
    { field: 'street', userValue: 'Τσιμισκή', resolvedValue: 'Τσιμισκή 12' },
  ] as AddressResolutionSlotProps['reconciliation']['conflicts'],
  pending: [],
  decisions: {},
  resolved: false,
  applyField: jest.fn(),
  keepField: jest.fn(),
  applyAll: jest.fn(),
  keepAll: jest.fn(),
};

const suggestions: AddressResolutionSlotProps['suggestions'] = {
  trigger: 'zeroResults',
  candidates: [],
  nextOmitField: null,
  retryExhausted: false,
  onSelect: jest.fn(),
  onDismiss: jest.fn(),
} as AddressResolutionSlotProps['suggestions'];

function renderSlot(overrides: Partial<AddressResolutionSlotProps> = {}) {
  const { container } = render(
    <AddressResolutionSlot
      reserving={false}
      showReconciliation={false}
      showSuggestions={false}
      reconciliation={reconciliation}
      suggestions={suggestions}
      onMergeConfirm={jest.fn()}
      {...overrides}
    />,
  );
  return container.querySelector('section') as HTMLElement;
}

/** The band is reserved iff a min-height constraint is applied. */
const holdsSpace = (section: HTMLElement) => /\bmin-h-/.test(section.className);

describe('AddressResolutionSlot — space reservation', () => {
  it('claims the band while the editor is still resolving, before any panel exists', () => {
    const section = renderSlot({ reserving: true });

    expect(holdsSpace(section)).toBe(true);
    expect(section).toHaveAttribute('aria-busy', 'true');
  });

  it('releases the band when nothing is resolving and no panel is shown', () => {
    expect(holdsSpace(renderSlot())).toBe(false);
  });

  it('keeps the band once a panel occupies it, even after resolving ends', () => {
    // The FSM leaves `loading` the moment the result lands. If the band were
    // tied to `reserving` alone it would collapse in that same frame.
    const section = renderSlot({ reserving: false, showReconciliation: true });

    expect(holdsSpace(section)).toBe(true);
    expect(section).toHaveAttribute('aria-busy', 'false');
  });

  it('keeps the band across the reconciliation → suggestions handover', () => {
    expect(holdsSpace(renderSlot({ showSuggestions: true }))).toBe(true);
  });
});

describe('AddressResolutionSlot — panel wiring', () => {
  it('renders the reconciliation panel only when asked', () => {
    renderSlot({ showReconciliation: true });
    expect(screen.getByText('editor.reconciliation.title')).toBeInTheDocument();
  });

  it('offers the commit action only once every field has a decision', () => {
    renderSlot({ showReconciliation: true });
    // Footer keeps its own applyAll; the commit button is the extra one.
    expect(screen.getAllByText('editor.reconciliation.applyAll')).toHaveLength(1);

    renderSlot({
      showReconciliation: true,
      reconciliation: { ...reconciliation, resolved: true },
    });
    expect(screen.getAllByText('editor.reconciliation.applyAll').length).toBeGreaterThan(1);
  });
});
