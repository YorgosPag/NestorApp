/**
 * =============================================================================
 * 🔍 GLOBAL SEARCH DIALOG (COMMAND PALETTE)
 * =============================================================================
 *
 * Enterprise Command Palette for Global Search.
 * Opens with Cmd+K / Ctrl+K and provides unified search across all entities.
 *
 * @module components/search/GlobalSearchDialog
 * @enterprise ADR-029 - Global Search v1
 * @compliance Local_Protocol.txt - ZERO any, NO inline styles
 *
 * FEATURES:
 * - ⌨️ Keyboard shortcuts (⌘K / Ctrl+K)
 * - 🔍 Real-time search with debouncing
 * - 📦 Results grouped by entity type
 * - ⬆️⬇️ Keyboard navigation (arrow keys)
 * - 🎯 Direct navigation to entity pages
 * - ♿ Full accessibility support
 */

"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SearchResultItem,
  SearchResultGroup,
} from './SearchResultItem';
import { SEARCH_CONFIG, SEARCH_ENTITY_TYPES } from '@/types/search';
import type { SearchResult, SearchEntityType } from '@/types/search';

// =============================================================================
// TYPES
// =============================================================================

interface GlobalSearchDialogProps {
  /** Whether the dialog is open (controlled) */
  open?: boolean;

  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;

  /** Filter by specific entity types */
  types?: SearchEntityType[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Order in which entity groups should be displayed.
 */
const ENTITY_DISPLAY_ORDER: SearchEntityType[] = [
  SEARCH_ENTITY_TYPES.PROJECT,
  SEARCH_ENTITY_TYPES.CONTACT,
  SEARCH_ENTITY_TYPES.BUILDING,
  SEARCH_ENTITY_TYPES.UNIT,
  SEARCH_ENTITY_TYPES.FILE,
];

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Global Search Dialog (Command Palette).
 *
 * Provides unified search across all searchable entities with:
 * - Real-time search with debouncing
 * - Results grouped by entity type
 * - Keyboard navigation
 * - Direct navigation to entity pages
 *
 * @example
 * ```tsx
 * // Uncontrolled (uses Cmd+K automatically)
 * <GlobalSearchDialog />
 *
 * // Controlled
 * const [open, setOpen] = useState(false);
 * <GlobalSearchDialog open={open} onOpenChange={setOpen} />
 * ```
 */
export function GlobalSearchDialog({
  open: controlledOpen,
  onOpenChange,
  types,
}: GlobalSearchDialogProps) {
  // === Hooks ===
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // === State ===
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine if controlled or uncontrolled
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  // === Search Hook ===
  const {
    query,
    setQuery,
    results,
    groupedResults,
    isLoading,
    error,
    clear,
    totalResults,
  } = useGlobalSearch({
    types,
    debounceMs: SEARCH_CONFIG.DEBOUNCE_MS,
    limit: SEARCH_CONFIG.DEFAULT_LIMIT,
  });

  // === Handlers ===

  /**
   * Handle open state change.
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen);
      } else {
        setInternalOpen(newOpen);
      }

      // Reset state when closing
      if (!newOpen) {
        clear();
        setSelectedIndex(0);
      }
    },
    [isControlled, onOpenChange, clear]
  );

  /**
   * Open the dialog.
   */
  const openDialog = useCallback(() => {
    handleOpenChange(true);
  }, [handleOpenChange]);

  /**
   * Close the dialog.
   */
  const closeDialog = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  /**
   * Get flat list of results in display order.
   */
  const getFlatResults = useCallback((): SearchResult[] => {
    const flatResults: SearchResult[] = [];

    for (const entityType of ENTITY_DISPLAY_ORDER) {
      const groupResults = groupedResults.get(entityType);
      if (groupResults) {
        flatResults.push(...groupResults);
      }
    }

    return flatResults;
  }, [groupedResults]);

  /**
   * Handle result click - close dialog after navigation.
   */
  const handleResultClick = useCallback(
    () => {
      closeDialog();
    },
    [closeDialog]
  );

  /**
   * Handle keyboard navigation.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const flatResults = getFlatResults();

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatResults.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatResults.length - 1
          );
          break;

        case 'Enter':
          event.preventDefault();
          if (flatResults[selectedIndex]) {
            handleResultClick(flatResults[selectedIndex]);
            // Navigation handled by SearchResultItem
          }
          break;

        case 'Escape':
          event.preventDefault();
          closeDialog();
          break;
      }
    },
    [getFlatResults, selectedIndex, handleResultClick, closeDialog]
  );

  // === Keyboard Shortcut ===
  useKeyboardShortcut('k', openDialog);

  // === Effects ===

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // === Render Helpers ===

  /**
   * Render grouped results.
   */
  const renderResults = () => {
    const flatResults = getFlatResults();
    let currentIndex = 0;

    return ENTITY_DISPLAY_ORDER.map((entityType) => {
      const groupResults = groupedResults.get(entityType);
      if (!groupResults || groupResults.length === 0) {
        return null;
      }

      const groupStartIndex = currentIndex;
      const items = groupResults.map((result, idx) => {
        const itemIndex = groupStartIndex + idx;
        currentIndex++;

        return (
          <SearchResultItem
            key={`${result.entityType}-${result.entityId}`}
            result={result}
            isSelected={selectedIndex === itemIndex}
            onClick={handleResultClick}
            onMouseEnter={() => setSelectedIndex(itemIndex)}
          />
        );
      });

      return (
        <SearchResultGroup
          key={entityType}
          entityType={entityType}
          count={groupResults.length}
        >
          {items}
        </SearchResultGroup>
      );
    });
  };

  /**
   * Render empty state.
   */
  const renderEmptyState = () => {
    if (query.length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className={cn(iconSizes.lg, 'text-muted-foreground/40 mb-3')} />
          <p className="text-sm text-muted-foreground">
            {t('search.hints.startTyping', 'Πληκτρολογήστε για αναζήτηση...')}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t('search.hints.minChars', 'Τουλάχιστον {{count}} χαρακτήρες', { count: SEARCH_CONFIG.MIN_QUERY_LENGTH })}
          </p>
        </div>
      );
    }

    if (!isLoading && totalResults === 0 && !error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className={cn(iconSizes.lg, 'text-muted-foreground/40 mb-3')} />
          <p className="text-sm text-muted-foreground">
            {t('search.noResults', 'Δεν βρέθηκαν αποτελέσματα')}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t('search.tryDifferent', 'Δοκιμάστε διαφορετική αναζήτηση')}
          </p>
        </div>
      );
    }

    return null;
  };

  /**
   * Render error state.
   */
  const renderError = () => {
    if (!error) return null;

    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-destructive bg-destructive/10 rounded-md mx-3 my-2">
        <AlertCircle className={iconSizes.sm} />
        <span>{error}</span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'max-w-2xl p-0 gap-0 overflow-hidden',
          colors.bg.primary
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {t('search.globalSearch', 'Παγκόσμια Αναζήτηση')}
        </DialogTitle>

        {/* Search Input */}
        <div className={cn('flex items-center gap-3 px-4 py-3 border-b', colors.border.default)}>
          {isLoading ? (
            <Spinner size="small" className="text-muted-foreground" />
          ) : (
            <Search className={cn(iconSizes.md, 'text-muted-foreground')} />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder', 'Αναζήτηση σε έργα, επαφές, κτίρια...')}
            className={cn(
              'flex-1 bg-transparent border-0 outline-none text-base',
              colors.text.primary,
              'placeholder:text-muted-foreground'
            )}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className={cn(
                'p-1 rounded-md text-muted-foreground',
                TRANSITION_PRESETS.STANDARD_COLORS,
                'hover:text-foreground hover:bg-muted'
              )}
              aria-label={t('buttons.clear', 'Καθαρισμός')}
            >
              <X className={iconSizes.sm} />
            </button>
          )}

          {/* Keyboard shortcut hint */}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted rounded border">
            {t('search.hints.escKey', 'ESC')}
          </kbd>
        </div>

        {/* Results Area */}
        <div
          className={cn(
            'max-h-[60vh] overflow-y-auto p-2',
            TRANSITION_PRESETS.SMOOTH_ALL
          )}
          role="listbox"
          aria-label={t('search.results', 'Αποτελέσματα αναζήτησης')}
        >
          {renderError()}
          {renderEmptyState()}
          {totalResults > 0 && renderResults()}
        </div>

        {/* Footer with keyboard hints */}
        {totalResults > 0 && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground',
              colors.border.default
            )}
          >
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">↓</kbd>
                <span className="ml-1">{t('search.navigate', 'πλοήγηση')}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">↵</kbd>
                <span className="ml-1">{t('search.select', 'επιλογή')}</span>
              </span>
            </div>
            <span>
              {t('search.resultsCount', '{{count}} αποτελέσματα', { count: totalResults })}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { GlobalSearchDialogProps };
