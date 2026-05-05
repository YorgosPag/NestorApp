/**
 * Integration tests — AddressEditor coordinator (ADR-332 Phase 5)
 *
 * Verifies that the coordinator:
 *   - renders all 8 form fields
 *   - calls onChange on field edit
 *   - shows fields as disabled in view mode
 *   - exposes context via useAddressEditorContext
 *   - undo/redo buttons render (enabled state)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddressEditor } from '../AddressEditor';
import { useAddressEditorContext } from '../AddressEditorContext';

// --- Mocks ---

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn().mockResolvedValue(null),
}));

// Radix Dialog needs pointer-events
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../components/AddressFieldTooltip', () => ({
  AddressFieldTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Fixtures ---

const EMPTY_ADDRESS = {};
const INITIAL_ADDRESS = {
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Θεσσαλονίκη',
  postalCode: '54621',
};

// --- Helpers ---

function renderEditor(
  props: Partial<React.ComponentProps<typeof AddressEditor>> = {},
) {
  const onChange = jest.fn();
  const { rerender } = render(
    <AddressEditor
      value={INITIAL_ADDRESS}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, rerender };
}

// --- Tests ---

describe('AddressEditor — coordinator', () => {
  it('renders all 8 address fields', () => {
    renderEditor();
    expect(screen.getByLabelText(/addr-street/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addr-number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addr-postalCode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addr-neighborhood/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addr-city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addr-county/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addr-region/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addr-country/i)).toBeInTheDocument();
  });

  it('calls onChange when a field is edited', () => {
    const { onChange } = renderEditor();
    const input = screen.getByDisplayValue('Σαμοθράκης');
    fireEvent.change(input, { target: { value: 'Εγνατίας' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ street: 'Εγνατίας' }),
    );
  });

  it('initialises fields from value prop', () => {
    renderEditor();
    expect(screen.getByDisplayValue('Σαμοθράκης')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Θεσσαλονίκη')).toBeInTheDocument();
  });

  it('disables all inputs in view mode', () => {
    renderEditor({ mode: 'view' });
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it('renders undo/redo toolbar buttons', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
  });

  it('hides activity log in view mode', () => {
    renderEditor({ mode: 'view' });
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });
});

// --- Context test ---

function ContextConsumer() {
  const ctx = useAddressEditorContext();
  return <div data-testid="phase">{ctx.editorState.phase}</div>;
}

describe('AddressEditorContext', () => {
  it('exposes editorState via context', () => {
    render(
      <AddressEditor value={EMPTY_ADDRESS} onChange={jest.fn()}>
        <ContextConsumer />
      </AddressEditor>,
    );
    expect(screen.getByTestId('phase')).toHaveTextContent('idle');
  });

  it('throws outside AddressEditor', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ContextConsumer />)).toThrow(
      'useAddressEditorContext must be used inside <AddressEditor>',
    );
    spy.mockRestore();
  });
});
