/**
 * =============================================================================
 * 🔍 SEARCH RESULT ITEM COMPONENT
 * =============================================================================
 *
 * Individual search result item for the Global Search Dialog.
 * Displays entity icon, title, subtitle, and handles navigation.
 *
 * @module components/search/SearchResultItem
 * @enterprise ADR-029 - Global Search v1
 * @compliance Local_Protocol.txt - ZERO any, NO inline styles
 */

"use client";

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  Building2,
  Home,
  User,
  FileText,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { TRANSITION_PRESETS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SearchResult, SearchEntityType } from '@/types/search';
import { SEARCH_ENTITY_TYPES } from '@/types/search';

// =============================================================================
// TYPES
// =============================================================================

interface SearchResultItemProps {
  /** Search result data */
  result: SearchResult;

  /** Whether this item is currently selected/highlighted */
  isSelected?: boolean;

  /** Callback when item is clicked */
  onClick?: (result: SearchResult) => void;

  /** Callback when mouse enters */
  onMouseEnter?: () => void;

  /** Additional className */
  className?: string;
}

// =============================================================================
// ENTITY ICON MAPPING
// =============================================================================

/**
 * Maps entity types to their corresponding icons.
 * Centralized for consistency across the application.
 */
const ENTITY_ICONS: Record<SearchEntityType, LucideIcon> = {
  [SEARCH_ENTITY_TYPES.PROJECT]: FolderKanban,
  [SEARCH_ENTITY_TYPES.BUILDING]: Building2,
  [SEARCH_ENTITY_TYPES.UNIT]: Home,
  [SEARCH_ENTITY_TYPES.CONTACT]: User,
  [SEARCH_ENTITY_TYPES.FILE]: FileText,
};

/**
 * Entity type i18n keys for accessibility and display.
 */
const ENTITY_LABEL_KEYS: Record<SearchEntityType, string> = {
  [SEARCH_ENTITY_TYPES.PROJECT]: 'search.entityTypes.project',
  [SEARCH_ENTITY_TYPES.BUILDING]: 'search.entityTypes.building',
  [SEARCH_ENTITY_TYPES.UNIT]: 'search.entityTypes.unit',
  [SEARCH_ENTITY_TYPES.CONTACT]: 'search.entityTypes.contact',
  [SEARCH_ENTITY_TYPES.FILE]: 'search.entityTypes.file',
};

/**
 * @deprecated Use ENTITY_LABEL_KEYS with useTranslation hook instead
 * Entity type labels for accessibility and display.
 */
const ENTITY_LABELS: Record<SearchEntityType, string> = {
  [SEARCH_ENTITY_TYPES.PROJECT]: 'Έργο',
  [SEARCH_ENTITY_TYPES.BUILDING]: 'Κτίριο',
  [SEARCH_ENTITY_TYPES.UNIT]: 'Μονάδα',
  [SEARCH_ENTITY_TYPES.CONTACT]: 'Επαφή',
  [SEARCH_ENTITY_TYPES.FILE]: 'Αρχείο',
};

/**
 * Entity type colors for visual differentiation.
 */
const ENTITY_COLORS: Record<SearchEntityType, string> = {
  [SEARCH_ENTITY_TYPES.PROJECT]: 'text-blue-500',
  [SEARCH_ENTITY_TYPES.BUILDING]: 'text-emerald-500',
  [SEARCH_ENTITY_TYPES.UNIT]: 'text-amber-500',
  [SEARCH_ENTITY_TYPES.CONTACT]: 'text-violet-500',
  [SEARCH_ENTITY_TYPES.FILE]: 'text-slate-500',
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Individual search result item component.
 *
 * Features:
 * - Entity-specific icon with color coding
 * - Title and subtitle display
 * - Keyboard and mouse navigation
 * - Accessibility support
 *
 * @example
 * ```tsx
 * <SearchResultItem
 *   result={searchResult}
 *   isSelected={index === selectedIndex}
 *   onClick={handleResultClick}
 *   onMouseEnter={() => setSelectedIndex(index)}
 * />
 * ```
 */
export function SearchResultItem({
  result,
  isSelected = false,
  onClick,
  onMouseEnter,
  className,
}: SearchResultItemProps) {
  const router = useRouter();
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Get icon component for entity type
  const IconComponent = ENTITY_ICONS[result.entityType] || FileText;
  const iconColor = ENTITY_COLORS[result.entityType] || 'text-muted-foreground';
  const entityLabelKey = ENTITY_LABEL_KEYS[result.entityType];
  const entityLabel = t(entityLabelKey, ENTITY_LABELS[result.entityType]);

  /**
   * Handle item click - navigate to entity page.
   */
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(result);
    }
    router.push(result.href);
  }, [onClick, result, router]);

  /**
   * Handle keyboard navigation.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={`${entityLabel}: ${result.title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      className={cn(
        // Base styles
        'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-md',
        // Transitions
        TRANSITION_PRESETS.SMOOTH_ALL,
        // Hover state
        HOVER_BACKGROUND_EFFECTS.MUTED,
        // Selected state
        isSelected && `${colors.bg.secondary} ring-1 ring-primary/20`,
        // Focus state
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        // Custom className
        className
      )}
    >
      {/* Entity Icon */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-muted/50',
          TRANSITION_PRESETS.STANDARD_COLORS
        )}
      >
        <IconComponent className={cn(iconSizes.sm, iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <div
          className={cn(
            'font-medium text-sm truncate',
            colors.text.primary
          )}
        >
          {result.title}
        </div>

        {/* Subtitle */}
        {result.subtitle && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {result.subtitle}
          </div>
        )}
      </div>

      {/* Entity Type Badge */}
      <div
        className={cn(
          'flex-shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded',
          'bg-muted text-muted-foreground'
        )}
      >
        {entityLabel}
      </div>
    </button>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Group header for search results grouped by entity type.
 */
interface SearchResultGroupProps {
  /** Entity type for this group */
  entityType: SearchEntityType;

  /** Number of results in this group */
  count: number;

  /** Children (result items) */
  children: React.ReactNode;
}

export function SearchResultGroup({
  entityType,
  count,
  children,
}: SearchResultGroupProps) {
  const { t } = useTranslation('common');
  const IconComponent = ENTITY_ICONS[entityType] || FileText;
  const iconColor = ENTITY_COLORS[entityType] || 'text-muted-foreground';
  const entityLabelKey = ENTITY_LABEL_KEYS[entityType];
  const label = t(entityLabelKey, ENTITY_LABELS[entityType]);

  return (
    <div className="mb-3">
      {/* Group Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <IconComponent className={cn('h-3.5 w-3.5', iconColor)} />
        <span>{label}</span>
        <span className="text-muted-foreground/60">({count})</span>
      </div>

      {/* Results */}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { SearchResultItemProps, SearchResultGroupProps };
export { ENTITY_ICONS, ENTITY_LABELS, ENTITY_LABEL_KEYS, ENTITY_COLORS };
