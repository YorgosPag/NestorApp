'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PenLine } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// SSoT: generic autocomplete results listbox (ADR-601)
// ----------------------------------------------------------------------------
// The `<ul role="listbox">` — result rows + no-results message + separator +
// free-text fallback row + scroll-highlighted-into-view — was duplicated across
// all three pickers. Shared bindings come from the picker hook; only the per-row
// content differs (company vs occupation vs skill) → injected via
// `renderItemContent`, NO variant branching.
// ============================================================================

export interface PickerResultsListLabels {
  /** aria-label for the listbox */
  searchResults: string;
  /** "no results" message */
  noResults: string;
  /** free-text fallback label (rendered as `${useFreeText}: "input"`) */
  useFreeText: string;
}

/** Structural subset of useAsyncPickerSearch this listbox binds to. */
export interface PickerListBindings<TResult> {
  results: TResult[];
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  isLoading: boolean;
  showFreeText: boolean;
  inputValue: string;
  commitResult: (result: TResult) => void;
  commitFreeText: () => void;
  listRef: React.RefObject<HTMLUListElement>;
}

export interface PickerResultsListProps<TResult> {
  picker: PickerListBindings<TResult>;
  getKey: (result: TResult) => string;
  renderItemContent: (result: TResult) => React.ReactNode;
  labels: PickerResultsListLabels;
}

const OPTION_BASE = 'px-3 py-2 cursor-pointer transition-colors';
const optionStateClass = (active: boolean) =>
  active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted';

export function PickerResultsList<TResult>({
  picker,
  getKey,
  renderItemContent,
  labels,
}: PickerResultsListProps<TResult>) {
  const colors = useSemanticColors();
  const {
    results, highlightedIndex, setHighlightedIndex, isLoading,
    showFreeText, inputValue, commitResult, commitFreeText, listRef,
  } = picker;

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      const item = items[highlightedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, listRef]);

  const freeTextIndex = results.length;

  return (
    <ul ref={listRef} role="listbox" aria-label={labels.searchResults} className="py-1">
      {/* Search results */}
      {results.map((result, index) => (
        <li
          key={getKey(result)}
          role="option"
          aria-selected={highlightedIndex === index}
          className={cn('flex flex-col', OPTION_BASE, optionStateClass(highlightedIndex === index))}
          onClick={() => commitResult(result)}
          onMouseEnter={() => setHighlightedIndex(index)}
        >
          {renderItemContent(result)}
        </li>
      ))}

      {/* No results message */}
      {!isLoading && results.length === 0 && showFreeText && (
        <li className={cn('px-3 py-2 text-sm text-center', colors.text.muted)}>
          {labels.noResults}
        </li>
      )}

      {/* Separator */}
      {results.length > 0 && (
        <li role="separator" className="border-t border-border my-1" />
      )}

      {/* Free text fallback option */}
      {showFreeText && (
        <li
          role="option"
          aria-selected={highlightedIndex === freeTextIndex}
          className={cn('flex items-center gap-2', OPTION_BASE, optionStateClass(highlightedIndex === freeTextIndex))}
          onClick={commitFreeText}
          onMouseEnter={() => setHighlightedIndex(freeTextIndex)}
        >
          <PenLine className={cn('h-4 w-4 shrink-0', colors.text.muted)} />
          <span className="text-sm">
            {labels.useFreeText}: &quot;{inputValue}&quot;
          </span>
        </li>
      )}
    </ul>
  );
}
