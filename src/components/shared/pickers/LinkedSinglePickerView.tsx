'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PickerPopoverShell } from './picker-popover-shell';
import { PickerSearchInput } from './PickerSearchInput';
import { PickerResultsList, type PickerResultsListLabels } from './PickerResultsList';
import { useLinkedSinglePicker } from './use-linked-single-picker';

// ============================================================================
// SSoT: linked single-select picker view (ADR-601)
// ----------------------------------------------------------------------------
// The full render (popover shell + search input + linked badge + clear button +
// results list) for a linked single-select picker, shared by EmployerPicker and
// EscoOccupationPicker. Composes useLinkedSinglePicker internally; each host only
// supplies its data source, payload builders, icon/badge and row renderer. This
// is the library-grade "<Autocomplete/>" seam — no per-variant branching here.
// ============================================================================

export interface LinkedSinglePickerViewProps<TResult, TValue> {
  // data + behaviour
  value: string;
  linkedId?: string;
  search: (query: string) => Promise<TResult[]>;
  getResultLabel: (result: TResult) => string;
  buildSelected: (result: TResult, label: string) => TValue;
  buildFreeText: (text: string) => TValue;
  onChange: (value: TValue) => void;
  // presentation
  disabled?: boolean;
  placeholder?: string;
  /** aria-label for the clear button. */
  clearLabel: string;
  /** Left search/entity icon. */
  leftIcon: React.ReactNode;
  /** Badge shown at right while a linked entity is selected. */
  badge?: React.ReactNode;
  /** Input right padding while the badge is visible (e.g. 'pr-20'). */
  selectedInputPadding?: string;
  // results
  getKey: (result: TResult) => string;
  renderItemContent: (result: TResult) => React.ReactNode;
  labels: PickerResultsListLabels;
}

export function LinkedSinglePickerView<TResult, TValue>({
  value,
  linkedId,
  search,
  getResultLabel,
  buildSelected,
  buildFreeText,
  onChange,
  disabled = false,
  placeholder,
  clearLabel,
  leftIcon,
  badge,
  selectedInputPadding,
  getKey,
  renderItemContent,
  labels,
}: LinkedSinglePickerViewProps<TResult, TValue>) {
  const colors = useSemanticColors();
  const { picker, hasSelection, handleInputChange, handleClear } = useLinkedSinglePicker<TResult, TValue>({
    value,
    linkedId,
    search,
    getResultLabel,
    buildSelected,
    buildFreeText,
    onChange,
  });

  return (
    <PickerPopoverShell open={picker.isOpen && !disabled} onOpenChange={picker.setIsOpen}
      anchor={
        <PickerSearchInput
          picker={picker}
          onChange={handleInputChange}
          onFocus={() => picker.handleFocus(!hasSelection)}
          disabled={disabled}
          placeholder={placeholder}
          hasRightIcon={!!picker.inputValue || picker.isLoading}
          inputClassName={cn(hasSelection && selectedInputPadding)}
          leftIcon={leftIcon}
        >
          {hasSelection && !disabled && badge}
          {!picker.isLoading && picker.inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className={cn("absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 hover:text-foreground transition-colors", colors.text.muted)}
              aria-label={clearLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </PickerSearchInput>
      }
    >
      <PickerResultsList<TResult>
        picker={picker}
        getKey={getKey}
        renderItemContent={renderItemContent}
        labels={labels}
      />
    </PickerPopoverShell>
  );
}
