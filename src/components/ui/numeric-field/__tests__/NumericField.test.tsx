/**
 * ADR-706 — NumericField behavioural contract.
 *
 * The headline test is `commits 2.4 when the user types "2.4"`: that is the
 * exact keystroke sequence that `<input type="number">` silently committed as
 * **4** (React #11877). If that test ever goes red, the regression is back.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NumericField } from '../NumericField';

/** Controlled harness mirroring how real callers wire the component. */
function Harness({
  initial = 0,
  onCommit,
  ...props
}: { initial?: number; onCommit?: (v: number) => void } & Partial<React.ComponentProps<typeof NumericField>>) {
  const [value, setValue] = React.useState(initial);
  return (
    <NumericField
      id="test-field"
      aria-label="test"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onCommit?.(next);
      }}
      {...props}
    />
  );
}

const field = () => screen.getByRole('spinbutton');

describe('NumericField — decimal typing (the type="number" regression)', () => {
  it.each([
    ['2.4', 2.4],
    ['2,4', 2.4],
    ['21.5', 21.5],
    ['21,5', 21.5],
    ['0.8', 0.8],
    ['70.5', 70.5],
  ])('commits %s → %s', async (typed, expected) => {
    const onCommit = jest.fn();
    const user = userEvent.setup();
    render(<Harness onCommit={onCommit} step={0.01} />);

    await user.click(field());
    await user.clear(field());
    await user.type(field(), typed);
    await user.tab();

    expect(onCommit).toHaveBeenLastCalledWith(expected);
  });

  it('never loses the leading digit while typing a decimal', async () => {
    const user = userEvent.setup();
    render(<Harness step={0.01} />);

    await user.click(field());
    await user.clear(field());
    await user.type(field(), '2.');
    // The half-typed value must survive on screen — this is what broke before.
    expect(field()).toHaveValue('2.');

    await user.type(field(), '4');
    expect(field()).toHaveValue('2.4');
  });
});

describe('NumericField — expression input (Figma/Revit parity)', () => {
  it.each([
    ['1200/2', 600],
    ['18+3', 21],
    ['(18+3)*2', 42],
  ])('evaluates %s → %s on blur', async (typed, expected) => {
    const onCommit = jest.fn();
    const user = userEvent.setup();
    render(<Harness onCommit={onCommit} />);

    await user.click(field());
    await user.clear(field());
    await user.type(field(), typed);
    await user.tab();

    expect(onCommit).toHaveBeenLastCalledWith(expected);
  });

  it('reverts to the model value when the formula is incomplete', async () => {
    const user = userEvent.setup();
    render(<Harness initial={12} />);

    await user.click(field());
    await user.clear(field());
    await user.type(field(), '5*');
    await user.tab();

    // "5*" is unparseable; the live sync had already committed 5, so 5 is kept
    // rather than a bogus 0 — no silent data loss either way.
    expect(field()).toHaveValue('5');
  });
});

describe('NumericField — keyboard nudge (WAI-ARIA spinbutton)', () => {
  // Asserted through the committed model value, not the rendered text, so the
  // test is independent of the test runner's locale decimal mark.
  it('ArrowUp / ArrowDown move by one step', async () => {
    const onCommit = jest.fn();
    const user = userEvent.setup();
    render(<Harness initial={10} step={0.5} onCommit={onCommit} />);

    await user.click(field());
    await user.keyboard('{ArrowUp}');
    expect(onCommit).toHaveBeenLastCalledWith(10.5);

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(onCommit).toHaveBeenLastCalledWith(9.5);
  });

  it('Shift+Arrow applies the big nudge (×10)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={10} step={1} />);

    await user.click(field());
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(field()).toHaveValue('20');
  });

  it('Home / End jump to min / max', async () => {
    const user = userEvent.setup();
    render(<Harness initial={50} min={0} max={100} />);

    await user.click(field());
    await user.keyboard('{Home}');
    expect(field()).toHaveValue('0');

    await user.keyboard('{End}');
    expect(field()).toHaveValue('100');
  });

  it('Escape reverts to the value the field was focused with', async () => {
    const user = userEvent.setup();
    render(<Harness initial={7} />);

    await user.click(field());
    await user.clear(field());
    await user.type(field(), '99');
    await user.keyboard('{Escape}');

    expect(field()).toHaveValue('7');
  });

  // ADR-364 T2 — the competitor here is the host dialog's dismiss layer, not the
  // ESC bus (which skips editable focus). One press must not both revert the
  // draft AND close the dialog; the second press, with nothing left to revert,
  // has to reach it.
  it('Escape is two-stage: consumed while a draft is pending, released once it is not', async () => {
    const onDismiss = jest.fn();
    const user = userEvent.setup();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- stands in for a dialog's dismiss layer
      <section onKeyDown={onDismiss}>
        <Harness initial={7} />
      </section>,
    );

    await user.click(field());
    await user.clear(field());
    await user.type(field(), '99');
    onDismiss.mockClear(); // the digits legitimately bubble — only ESC is under test

    await user.keyboard('{Escape}');
    expect(field()).toHaveValue('7');
    expect(onDismiss).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('NumericField — bounds and empty handling', () => {
  it('clamps to max on commit but does not block typing', async () => {
    const user = userEvent.setup();
    render(<Harness min={0} max={100} />);

    await user.click(field());
    await user.clear(field());
    await user.type(field(), '150');
    expect(field()).toHaveValue('150'); // typing is never fought
    await user.tab();
    expect(field()).toHaveValue('100'); // clamped on commit
  });

  it('commits emptyValue when cleared', async () => {
    const onCommit = jest.fn();
    const user = userEvent.setup();
    render(<Harness initial={42} onCommit={onCommit} emptyValue={0} />);

    await user.click(field());
    await user.clear(field());
    await user.tab();

    expect(onCommit).toHaveBeenLastCalledWith(0);
  });

  it('exposes spinbutton ARIA state', () => {
    render(<Harness initial={21.5} min={0} max={40} />);
    expect(field()).toHaveAttribute('aria-valuenow', '21.5');
    expect(field()).toHaveAttribute('aria-valuemin', '0');
    expect(field()).toHaveAttribute('aria-valuemax', '40');
  });

  it('is not a type="number" input', () => {
    render(<Harness />);
    expect(field()).toHaveAttribute('type', 'text');
    expect(field()).toHaveAttribute('inputmode', 'decimal');
  });
});
