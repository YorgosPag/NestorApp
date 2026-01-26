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

import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized UI components
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchInput } from '@/components/ui/search';
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
  SEARCH_ENTITY_TYPES.PARKING,
  SEARCH_ENTITY_TYPES.STORAGE,
];

/**
 * 🏢 ENTERPRISE: Centralized keyboard hint styling
 * Single source of truth for kbd element appearance in search dialog
 *
 * @design Based on macOS/Windows keyboard shortcut UI patterns
 * @see SAP Fiori, Salesforce Lightning Design System kbd patterns
 */
const KBD_STYLES = {
  /** Base classes for all kbd elements */
  base: 'inline-flex items-center justify-center font-medium bg-muted border rounded',
  /** Small kbd for arrow keys and single characters */
  sm: 'min-w-[1.5rem] h-6 px-1.5 text-xs',
  /** Medium kbd for text labels like "ESC" */
  md: 'min-w-[2rem] h-7 px-2 text-xs',
} as const;

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
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const borders = useBorderTokens();

  // === State ===
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

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
            handleResultClick();
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
        <div className={cn(
          'flex flex-col items-center justify-center text-center',
          // py-12 = 48px = 2xl spacing
          spacing.padding.y['2xl']
        )}>
          <Search className={cn(iconSizes.lg, 'text-muted-foreground/40', spacing.margin.bottom.sm)} />
          <p className={cn(typography.body.sm, 'text-muted-foreground')}>
            {t('search.hints.startTyping', 'Πληκτρολογήστε για αναζήτηση...')}
          </p>
          <p className={cn(typography.body.xs, 'text-muted-foreground/60', spacing.margin.top.xs)}>
            {t('search.hints.minChars', 'Τουλάχιστον {{count}} χαρακτήρες', { count: SEARCH_CONFIG.MIN_QUERY_LENGTH })}
          </p>
        </div>
      );
    }

    if (!isLoading && totalResults === 0 && !error) {
      return (
        <div className={cn(
          'flex flex-col items-center justify-center text-center',
          spacing.padding.y['2xl']
        )}>
          <Search className={cn(iconSizes.lg, 'text-muted-foreground/40', spacing.margin.bottom.sm)} />
          <p className={cn(typography.body.sm, 'text-muted-foreground')}>
            {t('search.noResults', 'Δεν βρέθηκαν αποτελέσματα')}
          </p>
          <p className={cn(typography.body.xs, 'text-muted-foreground/60', spacing.margin.top.xs)}>
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
      <div className={cn(
        'flex items-center',
        // Centralized spacing
        spacing.gap.sm, // gap-2
        spacing.padding.x.md, // px-4
        'py-3', // py-3 = 12px (not in tokens, keeping for visual consistency)
        // Centralized typography & colors
        typography.body.sm,
        'text-destructive bg-destructive/10',
        // Centralized borders
        borders.radiusClass.md,
        // Margins (mx-3 my-2 are micro values, keeping hardcoded)
        'mx-3 my-2'
      )}>
        <AlertCircle className={iconSizes.sm} />
        <span>{error}</span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          // Layout constraints (max-w-2xl is semantic for dialog width)
          'max-w-2xl',
          // Centralized spacing
          spacing.padding.none,
          spacing.gap.none,
          // Centralized colors
          colors.bg.primary
        )}
        onKeyDown={handleKeyDown}
        hideCloseButton
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {t('search.globalSearch', 'Παγκόσμια Αναζήτηση')}
        </DialogTitle>

        {/* 🏢 ENTERPRISE: Centralized Search Input */}
        <div className={cn(
          'relative',
          // Centralized spacing
          spacing.padding.x.md, // px-4
          'py-3', // py-3 = 12px (not in tokens, keeping for visual consistency)
          // Centralized borders
          borders.quick.borderB
        )}>
          <div className="flex items-center gap-3">
            {/* 🏢 ENTERPRISE: Search icon / Spinner - VS Code pattern */}
            {/* Spinner REPLACES the search icon when loading (not overlay) */}
            <div className="shrink-0 flex items-center justify-center w-5 h-5">
              {isLoading ? (
                <Spinner size="small" className="text-muted-foreground" />
              ) : (
                <Search className={cn(iconSizes.sm, 'text-muted-foreground')} />
              )}
            </div>

            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t('search.placeholder', 'Αναζήτηση σε έργα, επαφές, κτίρια...')}
              debounceMs={0} // Debouncing handled by useGlobalSearch hook
              showClearButton={true}
              onClear={() => setQuery('')}
              className={cn(
                'flex-1',
                // 🏢 ENTERPRISE: Hide built-in search icon (we use our own above)
                '[&_.absolute.left-4]:hidden'
              )}
            />

            {/* 🏢 ENTERPRISE: ESC hint + Close button inline */}
            <div className="flex items-center gap-3 shrink-0">
              <kbd className={cn(
                'hidden sm:inline-flex',
                KBD_STYLES.base,
                KBD_STYLES.md,
                'text-muted-foreground'
              )}>
                {t('search.hints.escKey', 'ESC')}
              </kbd>
              <DialogClose className={cn(
                // 🏢 ENTERPRISE: Override default absolute positioning
                'static',
                'inline-flex items-center justify-center',
                'rounded-md p-1.5',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-muted transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}>
                <X className={iconSizes.sm} />
                <span className="sr-only">{t('buttons.close', 'Κλείσιμο')}</span>
              </DialogClose>
            </div>
          </div>
        </div>

        {/* Results Area - 🏢 ENTERPRISE: Command palette pattern */}
        <ScrollArea
          className="max-h-[60vh]"
          role="listbox"
          aria-label={t('search.results', 'Αποτελέσματα αναζήτησης')}
        >
          <div className={cn(
            // 🏢 ENTERPRISE: Standard padding for command palette
            // No extra padding needed since hoverVariant="subtle" doesn't scale
            spacing.padding.sm,
            'space-y-1',
            // Centralized transitions
            TRANSITION_PRESETS.SMOOTH_ALL
          )}>
            {renderError()}
            {renderEmptyState()}
            {totalResults > 0 && renderResults()}
          </div>
        </ScrollArea>

        {/* Footer with keyboard hints */}
        {totalResults > 0 && (
          <div
            className={cn(
              'flex items-center justify-between',
              // Centralized spacing
              spacing.padding.x.md, // px-4
              spacing.padding.y.sm, // py-2
              // Centralized borders
              borders.quick.borderT,
              // Centralized typography
              typography.body.xs,
              'text-muted-foreground'
            )}
          >
            <div className={cn('flex items-center', spacing.gap.md)}>
              {/* 🏢 ENTERPRISE: Using centralized KBD_STYLES for consistent keyboard hints */}
              <span className={cn('flex items-center', spacing.gap.xs)}>
                <kbd className={cn(KBD_STYLES.base, KBD_STYLES.sm)}>↑</kbd>
                <kbd className={cn(KBD_STYLES.base, KBD_STYLES.sm)}>↓</kbd>
                <span className={spacing.margin.left.xs}>{t('search.navigate', 'πλοήγηση')}</span>
              </span>
              <span className={cn('flex items-center', spacing.gap.xs)}>
                <kbd className={cn(KBD_STYLES.base, KBD_STYLES.sm)}>↵</kbd>
                <span className={spacing.margin.left.xs}>{t('search.select', 'επιλογή')}</span>
              </span>
            </div>
            <span>
              {totalResults === 1
                ? t('search.resultsCount_one', '1 αποτέλεσμα').replace('{{count}}', '1')
                : t('search.resultsCount_other', `${totalResults} αποτελέσματα`).replace('{{count}}', String(totalResults))
              }
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
