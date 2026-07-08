'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

// ============================================================================
// SSoT: shared picker search input anchor (ADR-601)
// ----------------------------------------------------------------------------
// The left icon + combobox <Input> (identical aria contract) + loading spinner
// were duplicated across all three pickers. Shared input bindings come from the
// picker hook (value/keydown/open/ref/loading); per-variant extras (LINKED/ESCO
// badge, clear button — absent in the multi-select skill picker) are injected
// via `children`, NO variant branching.
// ============================================================================

/** Structural subset of useAsyncPickerSearch this input binds to. */
export interface PickerInputBindings {
  inputValue: string;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isOpen: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  isLoading: boolean;
}

export interface PickerSearchInputProps {
  picker: PickerInputBindings;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** hasRightIcon on the Input (reserves right padding for spinner/clear). */
  hasRightIcon: boolean;
  /** Left search/entity icon (positioned absolutely by the caller's className). */
  leftIcon: React.ReactNode;
  /** Extra input className (e.g. right padding when a badge is shown). */
  inputClassName?: string;
  /** Per-variant right-slot content: badge + clear button. */
  children?: React.ReactNode;
}

export function PickerSearchInput({
  picker,
  onChange,
  onFocus,
  disabled = false,
  placeholder,
  hasRightIcon,
  leftIcon,
  inputClassName,
  children,
}: PickerSearchInputProps) {
  return (
    <>
      {leftIcon}
      <Input
        ref={picker.inputRef}
        value={picker.inputValue}
        onChange={onChange}
        onKeyDown={picker.handleKeyDown}
        onFocus={onFocus}
        disabled={disabled}
        placeholder={placeholder}
        hasLeftIcon
        hasRightIcon={hasRightIcon}
        className={cn(inputClassName)}
        aria-expanded={picker.isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        role="combobox"
      />
      {picker.isLoading && (
        <Spinner size="small" className="absolute right-3 top-1/2 -translate-y-1/2" />
      )}
      {children}
    </>
  );
}
