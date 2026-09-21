/**
 * @fileoverview SearchableCombobox — Types and constants
 * @description Extracted types and constants for SearchableCombobox component.
 * @see searchable-combobox.tsx
 */

import type { FieldAccessibleName } from '@/lib/a11y/accessible-name';

// Wrappers (`DoyPicker`, `TradeSelector`, …) take the same name and FORWARD it — never invent one.
export type { FieldAccessibleName } from '@/lib/a11y/accessible-name';

// ============================================================================
// TYPES
// ============================================================================

export interface ComboboxOption {
  /** Unique value stored on selection */
  value: string;
  /** Primary display text */
  label: string;
  /** Optional secondary text (e.g. code, region) */
  secondaryLabel?: string;
  /** When true, option is visible but not selectable (greyed out) */
  disabled?: boolean;
  /** Hint text shown next to disabled options (e.g. "Ήδη καταχωρημένο") */
  disabledHint?: string;
}

/**
 * Everything except the NAME — the name is a separate, REQUIRED axis (`FieldAccessibleName`):
 * `id` (named by a `<Label htmlFor>`, react-select `inputId`), `aria-label` or `aria-labelledby`.
 * A nameless `role="combobox"` is a compile error, not an axe finding (ADR-598 G11,
 * ADR-841 §7 Α19.4δ). A dangling `id` passes the type — the runtime guard in
 * `searchable-combobox.tsx` reports it (`findMissingAccessibleName`).
 */
export interface SearchableComboboxBaseProps {
  /** Current value (matches option.value or free text) */
  value: string;
  /** Callback on value change. Passes the selected option or null for free text. */
  onValueChange: (value: string, option: ComboboxOption | null) => void;
  /** Available options to search through */
  options: ComboboxOption[];
  /** Input placeholder */
  placeholder?: string;
  /** Message when no options match the search */
  emptyMessage?: string;
  /** Shows loading spinner (e.g. while lazy-loading options) */
  isLoading?: boolean;
  /** Maximum number of options to display at once. Default: 50 */
  maxDisplayed?: number;
  /** Debounce delay in ms for filtering. Default: 150 */
  debounceMs?: number;
  /** Allow typing values not in the options list. Default: false */
  allowFreeText?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /**
   * When set, typed text that matches no existing option is offered as the LAST option
   * of the list (`role="option"`), reachable with ↑/↓ + Enter — react-select *Creatable*,
   * MUI Autocomplete `freeSolo`. Receives the typed text, trimmed (ADR-841 §7 Α19.4δ).
   * The parent is responsible for adding the new option to the options array.
   */
  onAddNew?: (label: string) => void;
  /**
   * Visible text of the add-new option for the typed text (react-select `formatCreateLabel`).
   * Default: `common:dropdown.addNewOption` — «Προσθήκη «x»» / `Add "x"`.
   */
  formatAddNewLabel?: (inputValue: string) => string;
}

export type SearchableComboboxProps = SearchableComboboxBaseProps & FieldAccessibleName;

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_MAX_DISPLAYED = 50;
export const DEFAULT_DEBOUNCE_MS = 150;
