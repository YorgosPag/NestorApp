/**
 * ADR-362 Phase F2 — DimStyleAccordion unit tests.
 *
 * Coverage:
 *   - Renders 3 accordion sections (lines, symbols, text).
 *   - Number input change fires onChange with correct patch.
 *   - Checkbox toggle fires onChange with correct patch.
 *   - Select (dimtad) change fires onChange with correct patch.
 *   - Select (dimblk) change fires onChange with dimblk/dimblk1/dimblk2.
 *   - readOnly=true → all inputs/selects/checkboxes disabled.
 *   - readOnly=false → all inputs/selects/checkboxes enabled.
 *
 * Run: `npx jest DimStyleAccordion.test --runInBand`
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DimStyleRegistry,
  __setDimStyleRegistryForTests,
} from '../../../../systems/dimensions/dim-style-registry';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../../components/dxf-settings/settings/shared/AccordionSection',
  () => ({
    AccordionSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <section data-testid={`accordion-${title}`}>
        <h4>{title}</h4>
        {children}
      </section>
    ),
  }),
);

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />,
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id, checked, onCheckedChange, disabled,
  }: {
    id?: string; checked?: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    value, onValueChange, disabled, children,
  }: {
    value?: string; onValueChange?: (v: string) => void; disabled?: boolean; children: React.ReactNode;
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

// ── Setup/teardown ───────────────────────────────────────────────────────────

import { DimStyleAccordion } from '../DimStyleAccordion';
import type { DimStyle } from '../../../../types/dimension';
import type { UpdateCustomStylePatch } from '../../../../systems/dimensions/dim-style-registry';

function freshRegistry() {
  const reg = new DimStyleRegistry();
  __setDimStyleRegistryForTests(reg);
  return reg;
}

afterEach(() => {
  __setDimStyleRegistryForTests(null);
});

function getBuiltInStyle(): DimStyle {
  return freshRegistry().getAllStyles()[0];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ADR-362 Phase F2 — DimStyleAccordion', () => {
  it('renders 3 accordion sections', () => {
    const style = getBuiltInStyle();
    render(<DimStyleAccordion style={style} onChange={jest.fn()} />);
    expect(screen.getByTestId(/accordion-panels\.dimensions\.editor\.sections\.lines/)).toBeInTheDocument();
    expect(screen.getByTestId(/accordion-panels\.dimensions\.editor\.sections\.symbols/)).toBeInTheDocument();
    expect(screen.getByTestId(/accordion-panels\.dimensions\.editor\.sections\.text/)).toBeInTheDocument();
  });

  it('number input change fires onChange with correct patch', () => {
    const style = getBuiltInStyle();
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<DimStyleAccordion style={style} onChange={onChange} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0];
    expect(Object.keys(patch)).toHaveLength(1);
    expect(Object.values(patch)[0]).toBe(5);
  });

  it('checkbox toggle fires onChange with correct patch', () => {
    const style = getBuiltInStyle();
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<DimStyleAccordion style={style} onChange={onChange} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0];
    expect(Object.keys(patch)).toHaveLength(1);
  });

  it('dimtad select change fires onChange with dimtad patch', () => {
    const style = getBuiltInStyle();
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<DimStyleAccordion style={style} onChange={onChange} />);
    const selects = screen.getAllByTestId('select');
    const tadSelect = selects.find((s) => {
      const options = s.querySelectorAll('option');
      return Array.from(options).some((o) => o.value === 'above');
    });
    expect(tadSelect).toBeDefined();
    fireEvent.change(tadSelect!, { target: { value: 'above' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dimtad: 'above' }));
  });

  it('dimblk select change fires onChange with dimblk/dimblk1/dimblk2', () => {
    const style = getBuiltInStyle();
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<DimStyleAccordion style={style} onChange={onChange} />);
    const selects = screen.getAllByTestId('select');
    const blkSelect = selects.find((s) => {
      const options = s.querySelectorAll('option');
      return Array.from(options).some((o) => o.value === 'dot');
    });
    expect(blkSelect).toBeDefined();
    fireEvent.change(blkSelect!, { target: { value: 'dot' } });
    expect(onChange).toHaveBeenCalledWith({ dimblk: 'dot', dimblk1: 'dot', dimblk2: 'dot' });
  });

  it('readOnly=true disables all spinbutton inputs', () => {
    const style = getBuiltInStyle();
    render(<DimStyleAccordion style={style} onChange={jest.fn()} readOnly />);
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach((input) => expect(input).toBeDisabled());
  });

  it('readOnly=true disables all checkboxes', () => {
    const style = getBuiltInStyle();
    render(<DimStyleAccordion style={style} onChange={jest.fn()} readOnly />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());
  });

  it('readOnly=false leaves inputs enabled', () => {
    const reg = freshRegistry();
    const created = reg.createCustomStyle({ name: 'Test', ...buildCustomFields(reg.getAllStyles()[0]) });
    render(<DimStyleAccordion style={created} onChange={jest.fn()} readOnly={false} />);
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach((input) => expect(input).not.toBeDisabled());
  });
});

function buildCustomFields(base: DimStyle): Omit<import('../../../../systems/dimensions/dim-style-registry').CreateCustomStyleInput, 'name'> {
  const { id: _id, isBuiltIn: _bi, name: _n, ...rest } = base;
  return rest;
}
