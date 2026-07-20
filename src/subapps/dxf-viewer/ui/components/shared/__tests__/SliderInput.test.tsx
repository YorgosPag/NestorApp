/**
 * SliderInput — a11y wiring + the NaN guard (ADR-682).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SliderInput } from '../SliderInput';
import { SLIDER_VALUE_UNITS } from '../slider-value-units';

describe('paired number input — NaN guard', () => {
  it('does NOT write NaN into the setting when the field is cleared', () => {
    const onChange = jest.fn();
    render(
      <SliderInput value={5} min={0} max={10} onChange={onChange} label="Width" showNumberInput />
    );
    const number = screen.getByRole('spinbutton');

    fireEvent.change(number, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(number, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });
});

describe('a11y wiring', () => {
  it('names the editable value field from the label', () => {
    render(
      <SliderInput
        value={0.6}
        min={0}
        max={1}
        step={0.1}
        onChange={jest.fn()}
        label="Opacity"
        showValue
        unit={SLIDER_VALUE_UNITS.percent01}
      />
    );
    // Both controls for this parameter carry the name: the typed field and the
    // Radix thumb (role="slider"). Pick the field explicitly.
    const named = screen.getAllByLabelText('Opacity');
    expect(named.map((el) => el.tagName)).toContain('INPUT');
    expect(named.some((el) => el.getAttribute('role') === 'slider')).toBe(true);
  });

  it('falls back to the tooltip when there is no visible label', () => {
    render(
      <SliderInput
        value={0.6}
        min={0}
        max={1}
        step={0.1}
        onChange={jest.fn()}
        tooltip="Fill opacity"
        showValue
        unit={SLIDER_VALUE_UNITS.percent01}
      />
    );
    const named = screen.getAllByLabelText('Fill opacity');
    expect(named.map((el) => el.tagName)).toContain('INPUT');
    expect(named.some((el) => el.getAttribute('role') === 'slider')).toBe(true);
  });

  it('keeps the legacy read-only value when no unit is declared', () => {
    const { container } = render(
      <SliderInput
        value={0.6}
        min={0}
        max={1}
        step={0.1}
        onChange={jest.fn()}
        label="Opacity"
        showValue
        formatValue={(v) => `${Math.round(v * 100)}%`}
      />
    );
    // Only the slider's own inputs exist — no focusable value field.
    expect(container.querySelector('input[type="text"]')).toBeNull();
    expect(container.textContent).toContain('60%');
  });
});

// =============================================================================
// ROUND 3 — `tooltip` names the control; it does NOT render a native title.
//
// It used to be handed to the wrapper as `title`, so 18 sliders grew a browser
// hover bubble that merely repeated the heading rendered directly above them.
// A native title is also keyboard-unreachable and invisible to touch — hence
// the CHECK 3.23 ratchet this removal pays down.
// =============================================================================

describe('tooltip is an accessible name, not a native title', () => {
  it('renders NO title attribute anywhere, even when tooltip is given', () => {
    const { container } = render(
      <SliderInput
        value={0.6}
        min={0}
        max={1}
        step={0.1}
        onChange={jest.fn()}
        label="Opacity"
        tooltip="Fill opacity"
        showValue
        unit={SLIDER_VALUE_UNITS.percent01}
      />
    );
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('still names the thumb from the tooltip when no label is visible', () => {
    const { container } = render(
      <SliderInput
        value={5}
        min={0}
        max={10}
        onChange={jest.fn()}
        tooltip="Line width"
      />
    );
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
    expect(screen.getByLabelText('Line width').getAttribute('role')).toBe('slider');
  });
});
