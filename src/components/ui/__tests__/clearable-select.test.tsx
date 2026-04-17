/**
 * @tests ClearableSelect — ADR-287 Batch 26
 * Verifies sentinel conversion ('__clear__' → '') και passthrough των κανονικών values.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClearableSelect } from '../clearable-select';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

jest.mock('../select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <div data-testid="select-root" data-value={value ?? ''} data-disabled={disabled ? 'true' : 'false'}>
      <button type="button" data-testid="pick-clear" onClick={() => onValueChange('__clear__')}>clear</button>
      <button type="button" data-testid="pick-real" onClick={() => onValueChange('central')}>real</button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, size, id }: { children: React.ReactNode; size?: string; id?: string }) => (
    <div data-testid="select-trigger" data-size={size} id={id}>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid="select-item" data-value={value}>{children}</div>
  ),
}));

describe('ClearableSelect — sentinel conversion', () => {
  it('converts SELECT_CLEAR_VALUE → empty string στο onValueChange', () => {
    const handleChange = jest.fn();
    render(
      <ClearableSelect
        value="central"
        onValueChange={handleChange}
        placeholder="pick"
        clearLabel="clear"
      >
        <div />
      </ClearableSelect>,
    );

    fireEvent.click(screen.getByTestId('pick-clear'));
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('propagates normal values unchanged', () => {
    const handleChange = jest.fn();
    render(
      <ClearableSelect
        value=""
        onValueChange={handleChange}
        placeholder="pick"
        clearLabel="clear"
      >
        <div />
      </ClearableSelect>,
    );

    fireEvent.click(screen.getByTestId('pick-real'));
    expect(handleChange).toHaveBeenCalledWith('central');
  });

  it('passes value through to Select root (empty string accepted)', () => {
    render(
      <ClearableSelect
        value=""
        onValueChange={jest.fn()}
        placeholder="pick heating"
        clearLabel="clear"
      >
        <div />
      </ClearableSelect>,
    );

    expect(screen.getByTestId('select-root')).toHaveAttribute('data-value', '');
    expect(screen.getByTestId('select-value')).toHaveTextContent('pick heating');
  });

  it('renders the clear sentinel item with the provided label', () => {
    render(
      <ClearableSelect
        value=""
        onValueChange={jest.fn()}
        placeholder="pick"
        clearLabel="Καθαρισμός"
      >
        <div data-testid="child-option" />
      </ClearableSelect>,
    );

    const items = screen.getAllByTestId('select-item');
    const sentinelItem = items.find((el) => el.getAttribute('data-value') === SELECT_CLEAR_VALUE);
    expect(sentinelItem).toBeDefined();
    expect(sentinelItem).toHaveTextContent('Καθαρισμός');
  });

  it('forwards disabled state to the underlying Select', () => {
    render(
      <ClearableSelect
        value=""
        onValueChange={jest.fn()}
        placeholder="pick"
        clearLabel="clear"
        disabled
      >
        <div />
      </ClearableSelect>,
    );

    expect(screen.getByTestId('select-root')).toHaveAttribute('data-disabled', 'true');
  });
});
