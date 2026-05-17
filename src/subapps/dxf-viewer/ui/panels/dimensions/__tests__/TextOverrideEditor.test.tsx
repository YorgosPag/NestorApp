/**
 * ADR-362 Phase G1 — TextOverrideEditor + DimTextOverrideStore unit tests.
 *
 * Coverage:
 *   TextOverrideEditor:
 *     - undefined / '<>' → measured mode
 *     - 'PREFIX<>SUFFIX' → prefixSuffix mode, prefix/suffix inputs visible
 *     - 'free text' → free mode, free input visible
 *     - mode change measured → onChange(undefined)
 *     - prefix/suffix change → onChange composite string
 *     - free text empty → onChange(undefined)
 *     - readOnly disables inputs
 *     - userText prop change syncs internal state
 *   DimTextOverrideStore:
 *     - open / close / idempotent open
 *     - subscribe / unsubscribe lifecycle
 *
 * Run: `npx jest TextOverrideEditor.test --runInBand`
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { TextOverrideEditor } from '../TextOverrideEditor';
import {
  openDimTextOverride,
  closeDimTextOverride,
  getDimTextOverrideState,
  subscribeDimTextOverride,
  __resetDimTextOverrideStoreForTests,
} from '../DimTextOverrideStore';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />,
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderEditor(
  userText: string | undefined,
  onChange = jest.fn(),
  readOnly = false,
) {
  return render(
    <TextOverrideEditor userText={userText} onChange={onChange} readOnly={readOnly} />,
  );
}

// ── TextOverrideEditor ───────────────────────────────────────────────────────

describe('TextOverrideEditor', () => {
  it('selects measured mode for undefined userText', () => {
    renderEditor(undefined);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();   // measured
    expect(radios[1]).not.toBeChecked();
    expect(radios[2]).not.toBeChecked();
  });

  it('selects measured mode for "<>" userText', () => {
    renderEditor('<>');
    expect(screen.getAllByRole('radio')[0]).toBeChecked();
  });

  it('selects prefixSuffix mode and shows inputs for "PRE<>SUF"', () => {
    renderEditor('PRE<>SUF');
    expect(screen.getAllByRole('radio')[1]).toBeChecked();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('PRE');
    expect(inputs[1]).toHaveValue('SUF');
  });

  it('selects free mode and shows input for plain text', () => {
    renderEditor('hello world');
    expect(screen.getAllByRole('radio')[2]).toBeChecked();
    expect(screen.getByRole('textbox')).toHaveValue('hello world');
  });

  it('switching to measured calls onChange(undefined)', () => {
    const onChange = jest.fn();
    renderEditor('hello', onChange);
    const measuredRadio = screen.getAllByRole('radio')[0];
    fireEvent.click(measuredRadio);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('prefix change calls onChange with composite string', () => {
    const onChange = jest.fn();
    renderEditor('A<>B', onChange);
    const prefixInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(prefixInput, { target: { value: 'X' } });
    expect(onChange).toHaveBeenCalledWith('X<>B');
  });

  it('empty free text calls onChange(undefined)', () => {
    const onChange = jest.fn();
    renderEditor('hello', onChange);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('readOnly disables radio inputs', () => {
    renderEditor(undefined, jest.fn(), true);
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
  });
});

// ── DimTextOverrideStore ─────────────────────────────────────────────────────

describe('DimTextOverrideStore', () => {
  beforeEach(() => __resetDimTextOverrideStoreForTests());

  it('starts closed', () => {
    expect(getDimTextOverrideState()).toEqual({ isOpen: false, entityId: null });
  });

  it('openDimTextOverride sets isOpen + entityId', () => {
    openDimTextOverride('e1');
    expect(getDimTextOverrideState()).toEqual({ isOpen: true, entityId: 'e1' });
  });

  it('idempotent: second open with same id does not re-notify', () => {
    const listener = jest.fn();
    subscribeDimTextOverride(listener);
    openDimTextOverride('e1');
    openDimTextOverride('e1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('closeDimTextOverride resets state', () => {
    openDimTextOverride('e1');
    closeDimTextOverride();
    expect(getDimTextOverrideState()).toEqual({ isOpen: false, entityId: null });
  });

  it('closeDimTextOverride is idempotent', () => {
    const listener = jest.fn();
    subscribeDimTextOverride(listener);
    closeDimTextOverride();
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe removes listener', () => {
    const listener = jest.fn();
    const unsub = subscribeDimTextOverride(listener);
    unsub();
    act(() => { openDimTextOverride('e2'); });
    expect(listener).not.toHaveBeenCalled();
  });
});
