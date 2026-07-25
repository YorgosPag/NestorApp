/**
 * ADR-706 — the numeric branch of UnifiedFormField must not regress to
 * `type="number"` + `parseFloat`, which broke BOTH decimal separators.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UnifiedFormField } from '../FormField';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Harness({ onCommit }: { onCommit: (v: number) => void }) {
  const [value, setValue] = React.useState<number>(0);
  return (
    <UnifiedFormField
      id="qty"
      type="number"
      label="Qty"
      value={value}
      onChange={(next) => {
        const numeric = typeof next === 'number' ? next : Number(next);
        setValue(numeric);
        onCommit(numeric);
      }}
      step={0.01}
    />
  );
}

const field = () => screen.getByRole('spinbutton');

describe('UnifiedFormField type="number"', () => {
  it('is not a native number input', () => {
    render(<Harness onCommit={jest.fn()} />);
    expect(field()).toHaveAttribute('type', 'text');
    expect(field()).toHaveAttribute('inputmode', 'decimal');
  });

  it.each([
    ['2.4', 2.4],
    ['2,4', 2.4],
    ['21.5', 21.5],
  ])('commits %s → %s', async (typed, expected) => {
    const onCommit = jest.fn();
    const user = userEvent.setup();
    render(<Harness onCommit={onCommit} />);

    await user.click(field());
    await user.clear(field());
    await user.type(field(), typed);
    await user.tab();

    expect(onCommit).toHaveBeenLastCalledWith(expected);
  });
});
