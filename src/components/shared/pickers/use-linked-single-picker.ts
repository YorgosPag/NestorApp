'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAsyncPickerSearch, type UseAsyncPickerSearch } from './use-async-picker-search';

// ============================================================================
// SSoT: single-select linked picker composition (ADR-601)
// ----------------------------------------------------------------------------
// Second tier over useAsyncPickerSearch for the "linked single-select" shape
// shared by EmployerPicker and EscoOccupationPicker: external value↔input sync,
// a "linked" flag (badge), emit-free-text-on-change, and a clear button. The
// per-variant emit payloads are injected via buildSelected/buildFreeText — the
// component keeps ONLY its data source + render. (EscoSkillPicker is multi-select
// and uses the base hook directly, not this composition.)
// ============================================================================

export interface UseLinkedSinglePickerConfig<TResult, TValue> {
  /** External text value (synced into the input). */
  value: string;
  /** External linked id (presence drives the "linked" badge flag). */
  linkedId?: string;
  /** Data source (owns filtering/slicing/service/language). */
  search: (query: string) => Promise<TResult[]>;
  /** Display label for a result (set as input value on select). */
  getResultLabel: (result: TResult) => string;
  /** Emit payload when a result is picked. */
  buildSelected: (result: TResult, label: string) => TValue;
  /** Emit payload for free text (input change, free-text option, clear). */
  buildFreeText: (text: string) => TValue;
  onChange: (value: TValue) => void;
}

export interface UseLinkedSinglePicker<TResult> {
  picker: UseAsyncPickerSearch<TResult>;
  /** True when the current value is a linked entity (not free text). */
  hasSelection: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClear: () => void;
}

export function useLinkedSinglePicker<TResult, TValue>(
  config: UseLinkedSinglePickerConfig<TResult, TValue>,
): UseLinkedSinglePicker<TResult> {
  const { value, linkedId, search, getResultLabel, buildSelected, buildFreeText, onChange } = config;

  const [hasSelection, setHasSelection] = useState(!!linkedId);

  const picker = useAsyncPickerSearch<TResult>({
    search,
    onSelectResult: (result, ctx) => {
      const label = getResultLabel(result);
      ctx.setInputValue(label);
      setHasSelection(true);
      ctx.resetResults();
      onChange(buildSelected(result, label));
    },
    onFreeText: (ctx) => {
      ctx.resetResults();
      setHasSelection(false);
      onChange(buildFreeText(ctx.inputValue));
    },
  });

  const { setInputValue, syncQuery, clearInput } = picker;

  // Sync external value changes
  useEffect(() => {
    setInputValue(value ?? '');
    setHasSelection(!!linkedId);
  }, [value, linkedId, setInputValue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHasSelection(false);
    onChange(buildFreeText(newValue)); // emit free text immediately
    syncQuery(newValue);
  }, [onChange, buildFreeText, setInputValue, syncQuery]);

  const handleClear = useCallback(() => {
    clearInput();
    setHasSelection(false);
    onChange(buildFreeText(''));
  }, [onChange, buildFreeText, clearInput]);

  return { picker, hasSelection, handleInputChange, handleClear };
}
