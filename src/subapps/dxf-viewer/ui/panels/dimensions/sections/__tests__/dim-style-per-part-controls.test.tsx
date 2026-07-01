/**
 * ADR-562 Φ5 — Style Manager per-part controls (Lines/Text/Symbols sections).
 *
 * Asserts each NEW control emits the correct `updateCustomStyle` patch:
 *   - LinesSection: dimclrd/dimclre (colour), dimlwd/dimlwe (lineweight),
 *     dimltype (linetype), dimltex1 (linetype, mirrors dimltex2).
 *   - TextSection: dimclrt (colour), textFontFamily (font).
 *   - SymbolsSection: arrowColor (colour, separate channel).
 *
 * Run: `npx jest dim-style-per-part-controls --runInBand`
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />,
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange, disabled }: {
    id?: string; checked?: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean;
  }) => (
    <input type="checkbox" id={id} checked={checked} disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: {
    value?: string; onValueChange?: (v: string) => void; disabled?: boolean; children: React.ReactNode;
  }) => (
    <select value={value} disabled={disabled} data-testid="select"
      onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  // Real Radix SelectItem is not an <option>, so it may hold rich children (swatch
  // span). The native-<select> mock cannot nest a <span> in <option>, so render the
  // value only — tests match by option `value`, not label text.
  SelectItem: ({ value }: { value: string; children: React.ReactNode }) => (
    <option value={value} />
  ),
}));

jest.mock('@/components/ui/utils/dynamic-styles', () => ({
  getDynamicBackgroundClass: () => 'dynamic-bg-mock',
}));

jest.mock('../../../../../stores/LinetypeRegistry', () => ({
  listSelectableLinetypeNames: () => ['ByLayer', 'Continuous', 'DASHED'],
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { LinesSection } from '../LinesSection';
import { TextSection } from '../TextSection';
import { SymbolsSection } from '../SymbolsSection';
import {
  DimStyleRegistry,
  type UpdateCustomStylePatch,
} from '../../../../../systems/dimensions/dim-style-registry';
import type { DimStyle } from '../../../../../types/dimension';

function baseStyle(): DimStyle {
  return new DimStyleRegistry().getAllStyles()[0];
}

/** All selects whose option list contains `optionValue`. */
function selectsWithOption(optionValue: string): HTMLSelectElement[] {
  return screen.getAllByTestId('select').filter((s) =>
    Array.from(s.querySelectorAll('option')).some((o) => o.value === optionValue),
  ) as HTMLSelectElement[];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ADR-562 Φ5 — LinesSection per-part controls', () => {
  it('colour select (dimclrd) fires onChange with ACI number', () => {
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<LinesSection style={baseStyle()} onChange={onChange} />);
    // Two colour selects (dimclrd, dimclre): option '256' = ByLayer marks colour.
    const colour = selectsWithOption('256');
    expect(colour).toHaveLength(2);
    fireEvent.change(colour[0], { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith({ dimclrd: 1 });
    fireEvent.change(colour[1], { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ dimclre: 3 });
  });

  it('lineweight select (dimlwd) fires onChange with a LineweightMm number', () => {
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<LinesSection style={baseStyle()} onChange={onChange} />);
    // Two lineweight selects (dimlwd, dimlwe): option '-2' = ByLayer marks lineweight.
    const weight = selectsWithOption('-2').filter((s) =>
      // Exclude colour selects (their ByLayer is '256', not '-2') — already disjoint,
      // but also ensure it has a concrete mm option.
      Array.from(s.querySelectorAll('option')).some((o) => o.value === '0.5'),
    );
    expect(weight).toHaveLength(2);
    fireEvent.change(weight[0], { target: { value: '0.5' } });
    expect(onChange).toHaveBeenCalledWith({ dimlwd: 0.5 });
  });

  it('linetype select (dimltex1) writes both dimltex1 and dimltex2', () => {
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<LinesSection style={baseStyle()} onChange={onChange} />);
    // Two linetype selects (dimltype, dimltex1): option 'DASHED' marks linetype.
    const linetype = selectsWithOption('DASHED');
    expect(linetype).toHaveLength(2);
    fireEvent.change(linetype[0], { target: { value: 'DASHED' } });
    expect(onChange).toHaveBeenCalledWith({ dimltype: 'DASHED' });
    fireEvent.change(linetype[1], { target: { value: 'Continuous' } });
    expect(onChange).toHaveBeenCalledWith({ dimltex1: 'Continuous', dimltex2: 'Continuous' });
  });
});

describe('ADR-562 Φ5 — TextSection per-part controls', () => {
  it('text colour select (dimclrt) fires onChange with ACI number', () => {
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<TextSection style={baseStyle()} onChange={onChange} />);
    fireEvent.change(selectsWithOption('256')[0], { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({ dimclrt: 5 });
  });

  it('font select (textFontFamily) fires onChange with the font name', () => {
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<TextSection style={baseStyle()} onChange={onChange} />);
    const font = selectsWithOption('Arial');
    expect(font).toHaveLength(1);
    fireEvent.change(font[0], { target: { value: 'Roboto' } });
    expect(onChange).toHaveBeenCalledWith({ textFontFamily: 'Roboto' });
  });
});

describe('ADR-562 Φ5 — SymbolsSection per-part controls', () => {
  it('arrow colour select (arrowColor) fires onChange with ACI number', () => {
    const onChange = jest.fn<void, [UpdateCustomStylePatch]>();
    render(<SymbolsSection style={baseStyle()} onChange={onChange} />);
    fireEvent.change(selectsWithOption('256')[0], { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ arrowColor: 2 });
  });

  it('readOnly disables the arrow colour select', () => {
    render(<SymbolsSection style={baseStyle()} onChange={jest.fn()} readOnly />);
    selectsWithOption('256').forEach((s) => expect(s).toBeDisabled());
  });
});
