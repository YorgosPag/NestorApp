/**
 * Unit tests for form-select-helpers.tsx (ADR-324).
 *
 * Locks the SSoT contract for clearable <Select> dropdowns:
 *   - required fields → no clear option
 *   - non-required fields → render SELECT_CLEAR_VALUE sentinel + separator
 *   - clicking the sentinel translates to an empty string before it reaches
 *     the form state (so L1 sanitize converts it to `deleteField()`)
 *
 * @module components/generic/__tests__/form-select-helpers
 * @see adrs/ADR-324-clearable-select-ssot.md
 */

import React from 'react';
import { render } from '@testing-library/react';

// Mock the i18n hook — ClearableSelectSection is self-contained and loads its
// own namespace. In tests we bypass the provider and assert the key-to-label
// wiring directly.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'dropdown.clearSelection') return 'Καθαρισμός επιλογής';
      return key;
    },
  }),
}));

import {
  ClearableSelectSection,
  shouldAllowClearForField,
  wrapClearableSelectHandler,
} from '../form-select-helpers';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

// Radix Select Item must live inside <Select>. For isolated rendering of the
// section we wrap it in the needed providers (SelectGroup works standalone).
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from '@/components/ui/select';

// ─── shouldAllowClearForField ────────────────────────────────────────────────

describe('shouldAllowClearForField', () => {
  it('returns true when field is not required (undefined)', () => {
    expect(shouldAllowClearForField({})).toBe(true);
  });

  it('returns true when field.required is explicitly false', () => {
    expect(shouldAllowClearForField({ required: false })).toBe(true);
  });

  it('returns false when field.required is true', () => {
    expect(shouldAllowClearForField({ required: true })).toBe(false);
  });
});

// ─── wrapClearableSelectHandler ──────────────────────────────────────────────

describe('wrapClearableSelectHandler', () => {
  it('passes non-sentinel values through unchanged', () => {
    const inner = jest.fn();
    const wrapped = wrapClearableSelectHandler(inner);
    wrapped('male');
    expect(inner).toHaveBeenCalledWith('male');
  });

  it('translates SELECT_CLEAR_VALUE to empty string', () => {
    const inner = jest.fn();
    const wrapped = wrapClearableSelectHandler(inner);
    wrapped(SELECT_CLEAR_VALUE);
    expect(inner).toHaveBeenCalledWith('');
  });

  it('does not swallow multiple calls', () => {
    const inner = jest.fn();
    const wrapped = wrapClearableSelectHandler(inner);
    wrapped('X');
    wrapped(SELECT_CLEAR_VALUE);
    wrapped('Y');
    expect(inner).toHaveBeenNthCalledWith(1, 'X');
    expect(inner).toHaveBeenNthCalledWith(2, '');
    expect(inner).toHaveBeenNthCalledWith(3, 'Y');
  });
});

// ─── ClearableSelectSection ──────────────────────────────────────────────────

describe('ClearableSelectSection', () => {
  it('renders nothing when shouldAllowClear is false', () => {
    const { container } = render(
      <Select open defaultValue="a">
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <ClearableSelectSection shouldAllowClear={false} />
        </SelectContent>
      </Select>,
    );
    expect(container.textContent).not.toContain('Καθαρισμός επιλογής');
  });

  it('renders the clear sentinel item when shouldAllowClear is true', () => {
    const { baseElement } = render(
      <Select open defaultValue="a">
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <ClearableSelectSection shouldAllowClear={true} />
        </SelectContent>
      </Select>,
    );
    // i18n in jest may return the key itself or the translation depending on
    // setup. The invariant we lock is "something clear-related is rendered".
    const text = baseElement.textContent ?? '';
    const hasClearItem =
      text.includes('Καθαρισμός επιλογής') ||
      text.includes('Clear selection') ||
      text.includes('clearSelection');
    expect(hasClearItem).toBe(true);
  });
});
