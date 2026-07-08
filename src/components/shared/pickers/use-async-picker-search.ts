'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// SSoT: headless async-autocomplete picker mechanics (ADR-601)
// ----------------------------------------------------------------------------
// Owns the search/debounce/loading/highlight/keyboard-navigation machinery that
// EmployerPicker, EscoOccupationPicker and EscoSkillPicker each hand-rolled
// identically. Deliberately state-model-agnostic: the value shape and the
// emit-on-select / emit-on-free-text logic (single value+id vs multi-select
// array append) stay in each component via injected callbacks — NO God-hook,
// no `if (multiSelect)` branching here.
//
// Commit callbacks receive a `PickerCommitCtx` (the hook's own setters + live
// inputValue + inputRef) so each component's emit logic can be written inline
// at the hook call-site without a use-before-defined cycle. `commitResult` /
// `commitFreeText` are the single source used by BOTH keyboard Enter and the
// listbox click path.
// ============================================================================

const logger = createModuleLogger('useAsyncPickerSearch');

const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 300;

export interface PickerCommitCtx<TResult> {
  /** Live input text at commit time. */
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setResults: React.Dispatch<React.SetStateAction<TResult[]>>;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Close popover + drop results. */
  resetResults: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

export interface UseAsyncPickerSearchConfig<TResult> {
  /** Produces the result list (owns filtering/slicing/service call/language). */
  search: (query: string) => Promise<TResult[]>;
  /** Commit the highlighted/clicked result (component-specific emit). */
  onSelectResult: (result: TResult, ctx: PickerCommitCtx<TResult>) => void;
  /** Commit the current input as free text (component-specific emit). */
  onFreeText: (ctx: PickerCommitCtx<TResult>) => void;
  /** Optional: Backspace on empty input (multi-select chip removal). */
  onBackspaceEmpty?: () => void;
  minChars?: number;
  debounceMs?: number;
}

export interface UseAsyncPickerSearch<TResult> {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  results: TResult[];
  setResults: React.Dispatch<React.SetStateAction<TResult[]>>;
  isLoading: boolean;
  highlightedIndex: number;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  inputRef: React.RefObject<HTMLInputElement>;
  listRef: React.RefObject<HTMLUListElement>;
  minChars: number;
  /** inputValue.trim().length >= minChars — drives the free-text affordance. */
  showFreeText: boolean;
  /** Debounced search trigger (input change / focus). */
  triggerSearch: (query: string) => void;
  /** On query change: open + debounced-search when it qualifies, else close. */
  syncQuery: (query: string) => void;
  /** On focus: open + search when the input qualifies and `canOpen` is true. */
  handleFocus: (canOpen: boolean) => void;
  /** Clear the input + results and refocus (component clear button). */
  clearInput: () => void;
  /** Close the popover and drop results (Escape / commit). */
  resetResults: () => void;
  /** Commit a result (keyboard Enter AND listbox click share this). */
  commitResult: (result: TResult) => void;
  /** Commit current input as free text. */
  commitFreeText: () => void;
  /** Shared keyboard navigation (Arrow/Enter/Escape + optional Backspace). */
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function useAsyncPickerSearch<TResult>(
  config: UseAsyncPickerSearchConfig<TResult>,
): UseAsyncPickerSearch<TResult> {
  const {
    search,
    onSelectResult,
    onFreeText,
    onBackspaceEmpty,
    minChars = DEFAULT_MIN_CHARS,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = config;

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<TResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFreeText = inputValue.trim().length >= minChars;

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < minChars) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const found = await search(query);
      setResults(found);
      setHighlightedIndex(-1);
    } catch (error) {
      logger.error('Search error', { error });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, minChars]);

  const triggerSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, debounceMs);
  }, [runSearch, debounceMs]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const resetResults = useCallback(() => {
    setIsOpen(false);
    setResults([]);
  }, []);

  const syncQuery = useCallback((query: string) => {
    if (query.trim().length >= minChars) {
      setIsOpen(true);
      triggerSearch(query);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [minChars, triggerSearch]);

  const handleFocus = useCallback((canOpen: boolean) => {
    if (canOpen && inputValue.trim().length >= minChars) {
      setIsOpen(true);
      triggerSearch(inputValue);
    }
  }, [inputValue, minChars, triggerSearch]);

  const clearInput = useCallback(() => {
    setInputValue('');
    setResults([]);
    inputRef.current?.focus();
  }, []);

  const buildCtx = useCallback((): PickerCommitCtx<TResult> => ({
    inputValue,
    setInputValue,
    setResults,
    setIsOpen,
    resetResults,
    inputRef,
  }), [inputValue, resetResults]);

  const commitResult = useCallback((result: TResult) => {
    onSelectResult(result, buildCtx());
  }, [onSelectResult, buildCtx]);

  const commitFreeText = useCallback(() => {
    onFreeText(buildCtx());
  }, [onFreeText, buildCtx]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      // Multi-select: Backspace on empty input removes the last committed item.
      if (onBackspaceEmpty && e.key === 'Backspace' && !inputValue) {
        e.preventDefault();
        onBackspaceEmpty();
      }
      return;
    }

    // Total items = results + 1 free-text option (when the input qualifies)
    const totalItems = results.length + (showFreeText ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          commitResult(results[highlightedIndex]);
        } else if (highlightedIndex === results.length) {
          commitFreeText();
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setResults([]);
        break;
    }
  }, [isOpen, results, highlightedIndex, showFreeText, commitResult, commitFreeText, onBackspaceEmpty, inputValue]);

  return {
    isOpen,
    setIsOpen,
    inputValue,
    setInputValue,
    results,
    setResults,
    isLoading,
    highlightedIndex,
    setHighlightedIndex,
    inputRef,
    listRef,
    minChars,
    showFreeText,
    triggerSearch,
    syncQuery,
    handleFocus,
    clearInput,
    resetResults,
    commitResult,
    commitFreeText,
    handleKeyDown,
  };
}
