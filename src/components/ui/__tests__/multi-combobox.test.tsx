import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MultiCombobox } from '../multi-combobox';
import type { MultiComboboxOption } from '../multi-combobox';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: () => void }) => (
    <input type="checkbox" checked={checked} onChange={onCheckedChange} data-testid="cb" readOnly />
  ),
}));

jest.mock('@radix-ui/react-popover', () => ({
  Root: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void }) => (
    <div data-testid="popover-root" onClick={() => onOpenChange?.(true)}>{children}</div>
  ),
  Trigger: ({ children, asChild: _asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  Content: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const OPTIONS: MultiComboboxOption[] = [
  { value: 'opt1', label: 'Επιλογή 1' },
  { value: 'opt2', label: 'Επιλογή 2' },
  { value: 'opt3', label: 'ΤΣΙΜΕΝΤΟ' },
];

describe('MultiCombobox', () => {
  it('renders placeholder when no values selected', () => {
    render(<MultiCombobox value={[]} onChange={jest.fn()} options={OPTIONS} placeholder="Επιλογή..." />);
    expect(screen.getByText('Επιλογή...')).toBeInTheDocument();
  });

  it('renders chips for selected values', () => {
    render(<MultiCombobox value={['opt1', 'opt2']} onChange={jest.fn()} options={OPTIONS} />);
    expect(screen.getAllByText('Επιλογή 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Επιλογή 2').length).toBeGreaterThan(0);
  });

  it('shows overflow count when selections exceed maxChipsDisplay', () => {
    render(
      <MultiCombobox value={['opt1', 'opt2', 'opt3']} onChange={jest.fn()} options={OPTIONS} maxChipsDisplay={2} />,
    );
    expect(screen.getByText(/selectedCount/)).toBeInTheDocument();
  });

  it('calls onChange with toggled array when option clicked', () => {
    const handleChange = jest.fn();
    render(<MultiCombobox value={[]} onChange={handleChange} options={OPTIONS} />);
    const items = screen.getAllByRole('option');
    fireEvent.click(items[0]);
    expect(handleChange).toHaveBeenCalledWith(['opt1']);
  });

  it('removes value from selection on second click (deselect)', () => {
    const handleChange = jest.fn();
    render(<MultiCombobox value={['opt1']} onChange={handleChange} options={OPTIONS} />);
    const items = screen.getAllByRole('option');
    fireEvent.click(items[0]);
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('calls onChange without removed value when chip X clicked', () => {
    const handleChange = jest.fn();
    render(<MultiCombobox value={['opt1', 'opt2']} onChange={handleChange} options={OPTIONS} />);
    const removeButtons = screen.getAllByRole('button', { name: /removeChip/i });
    fireEvent.click(removeButtons[0]);
    expect(handleChange).toHaveBeenCalledWith(['opt2']);
  });

  it('filters options when search input changes', () => {
    render(<MultiCombobox value={[]} onChange={jest.fn()} options={OPTIONS} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'ΤΣΙΜ' } });
    expect(screen.getByText('ΤΣΙΜΕΝΤΟ')).toBeInTheDocument();
    expect(screen.queryByText('Επιλογή 1')).not.toBeInTheDocument();
  });

  it('shows empty message when no options match search', () => {
    render(<MultiCombobox value={[]} onChange={jest.fn()} options={OPTIONS} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('multiCombobox.emptyMessage')).toBeInTheDocument();
  });

  it('ArrowDown moves focus to next option', () => {
    render(<MultiCombobox value={[]} onChange={jest.fn()} options={OPTIONS} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const items = screen.getAllByRole('option');
    expect(items[1]).toHaveClass('bg-accent');
  });

  it('Enter key toggles focused option', () => {
    const handleChange = jest.fn();
    render(<MultiCombobox value={[]} onChange={handleChange} options={OPTIONS} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith(['opt1']);
  });

  it('clears all values when clear-all button clicked', () => {
    const handleChange = jest.fn();
    render(<MultiCombobox value={['opt1', 'opt2']} onChange={handleChange} options={OPTIONS} />);
    const clearBtn = screen.getByText('multiCombobox.clearAll');
    fireEvent.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('trigger has aria-multiselectable', () => {
    render(<MultiCombobox value={[]} onChange={jest.fn()} options={OPTIONS} ariaLabel="test-combo" />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-multiselectable');
  });

  it('listbox has aria-multiselectable', () => {
    render(<MultiCombobox value={[]} onChange={jest.fn()} options={OPTIONS} />);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-multiselectable');
  });
});
