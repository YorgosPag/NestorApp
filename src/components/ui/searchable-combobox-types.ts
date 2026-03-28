/**
 * @fileoverview SearchableCombobox — Types and constants
 * @description Extracted types and constants for SearchableCombobox component.
 * @see searchable-combobox.tsx
 */

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

export interface SearchableComboboxProps {
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
   * When set, shows a "+ Add new" button at the bottom of the dropdown.
   * Callback receives the new label typed by the user.
   * The parent is responsible for adding the new option to the options array.
   */
  onAddNew?: (label: string) => void;
  /** Label for the "add new" button. Default: "+ Add new" */
  addNewButtonLabel?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_MAX_DISPLAYED = 50;
export const DEFAULT_DEBOUNCE_MS = 150;
