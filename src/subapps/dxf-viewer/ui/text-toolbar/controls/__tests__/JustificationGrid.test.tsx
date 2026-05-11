/**
 * ADR-344 Phase 5.I — JustificationGrid render matrix tests.
 *
 * Verifies:
 *  - 9 buttons rendered (TL, TC, ..., BR)
 *  - active value highlights one button via aria-checked
 *  - null (mixed) renders the fieldset with data-state="indeterminate"
 *  - clicking a button fires onChange with the matching code
 *  - disabled prop blocks clicks
 */

import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { JustificationGrid } from '../JustificationGrid';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const ALL_POINTS = ['TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'] as const;

describe('JustificationGrid', () => {
  it('renders 9 attachment-point buttons', () => {
    render(<JustificationGrid value="ML" onChange={() => {}} />);
    ALL_POINTS.forEach((p) => {
      expect(screen.getByText(p)).toBeTruthy();
    });
  });

  it.each(ALL_POINTS)('marks %s as checked when it is the value', (point) => {
    render(<JustificationGrid value={point} onChange={() => {}} />);
    const btn = screen.getByText(point);
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('null value renders the fieldset as indeterminate', () => {
    const { container } = render(<JustificationGrid value={null} onChange={() => {}} />);
    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.getAttribute('data-state')).toBe('indeterminate');
    ALL_POINTS.forEach((p) => {
      expect(screen.getByText(p).getAttribute('aria-checked')).toBe('false');
    });
  });

  it('clicking a button fires onChange with the matching code', () => {
    const onChange = jest.fn();
    render(<JustificationGrid value="ML" onChange={onChange} />);
    fireEvent.click(screen.getByText('BR'));
    expect(onChange).toHaveBeenCalledWith('BR');
  });

  it('disabled prop blocks click events', () => {
    const onChange = jest.fn();
    render(<JustificationGrid value="ML" onChange={onChange} disabled />);
    fireEvent.click(screen.getByText('BR'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
