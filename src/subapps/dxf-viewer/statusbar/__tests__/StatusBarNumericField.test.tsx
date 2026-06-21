/**
 * StatusBarNumericField — shared live-apply numeric field tests (ADR-510 Φ2E #2).
 *
 * Locks the range-guard SSoT extracted from the snap-step + LTSCALE fields:
 *   - valid drafts commit live; invalid drafts (below min / wrong sign) do not;
 *   - `minExclusive` enforces strictly-greater (LTSCALE > 0);
 *   - external value changes re-sync the local buffer;
 *   - the optional unit suffix renders.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { StatusBarNumericField } from '../StatusBarNumericField';

function setup(props: Partial<React.ComponentProps<typeof StatusBarNumericField>> = {}) {
  const onCommit = jest.fn();
  const utils = render(
    <StatusBarNumericField
      id="fld"
      value={1}
      onCommit={onCommit}
      ariaLabel="field"
      {...props}
    />,
  );
  const input = screen.getByLabelText('field') as HTMLInputElement;
  return { onCommit, input, ...utils };
}

describe('StatusBarNumericField', () => {
  it('commits a valid typed number live', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onCommit).toHaveBeenCalledWith(2.5);
  });

  it('does NOT commit a value below an inclusive min (default 0)', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: '-1' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits the inclusive min (0 with default min=0)', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: '0' } });
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it('minExclusive rejects the boundary (0) but accepts > min', () => {
    const { onCommit, input } = setup({ min: 0, minExclusive: true });
    fireEvent.change(input, { target: { value: '0' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '0.5' } });
    expect(onCommit).toHaveBeenCalledWith(0.5);
  });

  it('keeps a partial/empty draft visible without committing', () => {
    const { onCommit, input } = setup();
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('re-syncs the buffer when the external value changes', () => {
    const { input, rerender, onCommit } = setup({ value: 1 });
    rerender(
      <StatusBarNumericField id="fld" value={4} onCommit={onCommit} ariaLabel="field" />,
    );
    expect(input.value).toBe('4');
  });

  it('renders the optional unit suffix', () => {
    setup({ unitSuffix: 'mm' });
    expect(screen.getByText('mm')).toBeInTheDocument();
  });
});
