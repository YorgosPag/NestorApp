/**
 * SliderValueField — degradation rule + the four round-1 regressions (ADR-682).
 *
 * Every test here corresponds to a way the field silently corrupted a setting.
 * They are pinned, not illustrative.
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SliderValueField } from '../SliderValueField';
import { SLIDER_VALUE_UNITS } from '../slider-value-units';

const percent = SLIDER_VALUE_UNITS.percent01;

function renderField(overrides: Partial<React.ComponentProps<typeof SliderValueField>> = {}) {
  const onChange = jest.fn();
  const utils = render(
    <SliderValueField
      value={0.6}
      min={0}
      max={1}
      step={0.1}
      onChange={onChange}
      unit={percent}
      ariaLabel="Opacity"
      {...overrides}
    />
  );
  return { onChange, ...utils };
}

describe('degradation rule', () => {
  it('renders a NON-focusable span when no unit is given', () => {
    const { container } = renderField({ unit: undefined, formatValue: (v) => `${v * 100}%` });
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toBe('60%');
  });

  it('renders a NON-focusable span when there is no accessible name', () => {
    const { container } = renderField({ ariaLabel: '   ' });
    expect(container.querySelector('input')).toBeNull();
  });

  it('renders an editable input when both unit and name are given', () => {
    renderField();
    expect(screen.getByLabelText('Opacity').tagName).toBe('INPUT');
  });
});

describe('round trip — the blocker', () => {
  it('typing 80 commits 0.8, NOT a clamped 1', () => {
    const { onChange } = renderField();
    const input = screen.getByLabelText('Opacity');

    expect(input).toHaveValue('60%');
    fireEvent.focus(input);
    expect(input).toHaveValue('60'); // display space, no symbol
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0.8);
  });
});

describe('regression 1 — untouched text must not commit', () => {
  it('focus + blur with no edit does NOT call onChange', () => {
    const { onChange } = renderField({ value: 0.8, step: 0.5 });
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.blur(input); // a bare Tab across the field

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('regression 2 — nudge from an empty draft', () => {
  it('ArrowUp on a cleared field starts from the prop value, not 0', () => {
    const { onChange } = renderField({ value: 0.6, step: 0.1 });
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onChange).toHaveBeenCalledWith(0.7);
  });

  it('Shift+ArrowUp moves ten steps', () => {
    const { onChange } = renderField({ value: 0.1, step: 0.01 });
    fireEvent.focus(screen.getByLabelText('Opacity'));
    fireEvent.keyDown(screen.getByLabelText('Opacity'), { key: 'ArrowUp', shiftKey: true });

    expect(onChange).toHaveBeenCalledWith(0.2);
  });
});

describe('regression 3 — stale draft', () => {
  function Harness() {
    const [value, setValue] = useState(0.6);
    const [disabled, setDisabled] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setDisabled(true)}>disable</button>
        <button type="button" onClick={() => setValue(0.2)}>external</button>
        <SliderValueField
          value={value}
          min={0}
          max={1}
          step={0.1}
          onChange={setValue}
          unit={percent}
          ariaLabel="Opacity"
          disabled={disabled}
        />
      </>
    );
  }

  it('drops the draft when the field is disabled mid-typing', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Opacity');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });

    act(() => { screen.getByText('disable').click(); });

    expect(input).toHaveValue('60%');
  });

  it('drops the draft when the value changes externally', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Opacity');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });

    act(() => { screen.getByText('external').click(); });

    expect(input).toHaveValue('20%');
  });
});

describe('regression 4 — rejection is visible, never silent', () => {
  it('flags unparseable input, reverts, and does NOT commit', () => {
    const { onChange } = renderField();
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue('60%');
  });

  it('flags an out-of-range value before clamping it', () => {
    const { onChange } = renderField();
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(1);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Escape reverts without committing', () => {
  it('restores the formatted value and skips onChange', () => {
    const { onChange } = renderField();
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('60%');
  });
});

// =============================================================================
// ROUND 3 — Escape must cancel the SESSION, not just the unsent text.
//
// An arrow nudge pushes onChange immediately, so by the time Escape arrives the
// setting has already moved. Dropping the draft therefore reverted nothing —
// SliderInput's header documented "Escape reverts" and, after a nudge, that
// promise was silently false.
// =============================================================================

describe('Escape cancels the whole editing session', () => {
  function ControlledHarness({ onValue }: { onValue: (v: number) => void }) {
    const [value, setValue] = useState(0.6);
    return (
      <SliderValueField
        value={value}
        min={0}
        max={1}
        step={0.1}
        onChange={(v) => { setValue(v); onValue(v); }}
        unit={percent}
        ariaLabel="Opacity"
      />
    );
  }

  it('restores the value that a nudge had already committed', () => {
    const onValue = jest.fn();
    render(<ControlledHarness onValue={onValue} />);
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValue).toHaveBeenLastCalledWith(0.8);

    fireEvent.keyDown(input, { key: 'Escape' });

    // Back to the value as it stood when the field took focus.
    expect(onValue).toHaveBeenLastCalledWith(0.6);
    expect(input).toHaveValue('60%');
  });

  it('reverts a nudge followed by typing, in one keystroke', () => {
    const onValue = jest.fn();
    render(<ControlledHarness onValue={onValue} />);
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: '95' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onValue).toHaveBeenLastCalledWith(0.6);
    expect(input).toHaveValue('60%');
  });

  it('emits NOTHING when the session never moved the value (idempotent)', () => {
    const onValue = jest.fn();
    render(<ControlledHarness onValue={onValue} />);
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onValue).not.toHaveBeenCalled();
    expect(input).toHaveValue('60%');
  });
});

// =============================================================================
// ROUND 3b — two holes found by adversarial review of the round-3 Escape fix.
// Both were REPRODUCED before being fixed; these pin them shut.
// =============================================================================

describe('Escape survives an external value change mid-session', () => {
  function Harness({ onValue }: { onValue: (v: number) => void }) {
    const [value, setValue] = useState(0.6);
    return (
      <>
        <button type="button" onClick={() => setValue(0.3)}>external</button>
        <SliderValueField
          value={value}
          min={0}
          max={1}
          step={0.1}
          onChange={(v) => { setValue(v); onValue(v); }}
          unit={percent}
          ariaLabel="Opacity"
        />
      </>
    );
  }

  it('re-arms the baseline so a nudge AFTER an external change is still revertible', () => {
    // The external change resets the draft — but the input never lost focus, so
    // the session is alive. Without re-arming, Escape found a null baseline and
    // did nothing, silently reconstituting the very bug it was added to fix.
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    act(() => { screen.getByText('external').click(); });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValue).toHaveBeenLastCalledWith(0.4);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onValue).toHaveBeenLastCalledWith(0.3);
  });
});

describe('the blur latch cannot swallow a later commit', () => {
  it('commits normally on the edit AFTER an Escape', () => {
    // `skipBlurRef` is armed before a programmatic blur(). If that blur does not
    // fire, a stale `true` ate the next real commit. handleFocus disarms it.
    const onChange = jest.fn();
    render(
      <SliderValueField
        value={0.6} min={0} max={1} step={0.1}
        onChange={onChange} unit={percent} ariaLabel="Opacity"
      />
    );
    const input = screen.getByLabelText('Opacity');

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0.9);
  });
});
