/**
 * =============================================================================
 * 🔍 SEARCH RESULT ITEM COMPONENT
 * =============================================================================
 *
 * Individual search result item for the Global Search Dialog.
 * Uses centralized ListCard component for enterprise consistency.
 *
 * @module components/search/SearchResultItem
 * @enterprise ADR-029 - Global Search v1
 * @compliance Local_Protocol.txt - ZERO any, NO inline styles
 * @see ListCard for base component
 */

"use client";

import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';

// 🏢 ENTERPRISE: Centralized ListCard from Design System
import { ListCard } from '@/design-system';
import type { ListCardBadge } from '@/design-system/components/ListCard/ListCard.types';
import type { StatItem } from '@/design-system/primitives/Card/types';

// 🏢 ENTERPRISE: Centralized entity configuration
import { NAVIGATION_ENTITIES, type NavigationEntityType } from '@/components/navigation/config';

// 🏢 DOMAIN TYPES
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
// ENTITY TYPE MAPPING
// =============================================================================

/**
 * Maps SearchEntityType to NavigationEntityType.
 * Required because search types and navigation types may differ.
 */
const SEARCH_TO_NAVIGATION_ENTITY: Record<SearchEntityType, NavigationEntityType> = {
  [SEARCH_ENTITY_TYPES.PROJECT]: 'project',
  [SEARCH_ENTITY_TYPES.BUILDING]: 'building',
  [SEARCH_ENTITY_TYPES.UNIT]: 'unit',
  [SEARCH_ENTITY_TYPES.CONTACT]: 'contact',
  [SEARCH_ENTITY_TYPES.FILE]: 'file',
  [SEARCH_ENTITY_TYPES.PARKING]: 'parking',
  [SEARCH_ENTITY_TYPES.STORAGE]: 'storage',
  [SEARCH_ENTITY_TYPES.OPPORTUNITY]: 'opportunity',
  [SEARCH_ENTITY_TYPES.COMMUNICATION]: 'communication',
  [SEARCH_ENTITY_TYPES.TASK]: 'task',
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
  [SEARCH_ENTITY_TYPES.PARKING]: 'search.entityTypes.parking',
  [SEARCH_ENTITY_TYPES.STORAGE]: 'search.entityTypes.storage',
  [SEARCH_ENTITY_TYPES.OPPORTUNITY]: 'search.entityTypes.opportunity',
  [SEARCH_ENTITY_TYPES.COMMUNICATION]: 'search.entityTypes.communication',
  [SEARCH_ENTITY_TYPES.TASK]: 'search.entityTypes.task',
};

/**
 * @deprecated Use ENTITY_LABEL_KEYS with useTranslation hook instead
 * Entity type labels for accessibility and display (fallbacks).
 */
const ENTITY_LABELS: Partial<Record<SearchEntityType, string>> = {};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Individual search result item component.
 *
 * Uses centralized ListCard from Design System for enterprise consistency.
 * All styling comes from centralized systems - ZERO hardcoded values.
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

  // === Computed Values ===
  const navigationEntityType = SEARCH_TO_NAVIGATION_ENTITY[result.entityType];
  const entityLabelKey = ENTITY_LABEL_KEYS[result.entityType];
  const entityLabel = t(entityLabelKey, ENTITY_LABELS[result.entityType] ?? entityLabelKey);

  // === Badges ===
  // 🏢 ENTERPRISE: Show entity type badge + status badge for parking/storage
  const badges = useMemo<ListCardBadge[]>(() => {
    const badgeList: ListCardBadge[] = [];

    // Status badge for parking/storage (if status exists)
    if (result.status && (result.entityType === 'parking' || result.entityType === 'storage')) {
      // Map status to badge variant
      const statusVariants: Record<string, ListCardBadge['variant']> = {
        available: 'success',
        occupied: 'info',
        reserved: 'warning',
        sold: 'secondary',
        maintenance: 'destructive',
      };
      const variant = statusVariants[result.status] || 'default';
      // Translate status label
      const statusLabel = t(`parking.status.${result.status}`, result.status);
      badgeList.push({ label: statusLabel, variant });
    }

    return badgeList;
  }, [result.status, result.entityType, t]);

  // === Stats ===
  // 🏢 ENTERPRISE: Convert SearchResultStat to StatItem for ListCard
  const stats = useMemo<StatItem[]>(() => {
    if (!result.stats || result.stats.length === 0) return [];

    return result.stats.map((stat) => {
      // Get icon and color from NAVIGATION_ENTITIES if iconKey provided
      const entityConfig = stat.iconKey ? NAVIGATION_ENTITIES[stat.iconKey as NavigationEntityType] : null;
      const fallbackConfig = NAVIGATION_ENTITIES.file;

      return {
        icon: entityConfig?.icon ?? fallbackConfig.icon,
        iconColor: entityConfig?.color ?? fallbackConfig.color,
        label: stat.label,
        value: stat.value,
      };
    });
  }, [result.stats]);

  // === Event Handlers ===

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

  // === Render ===
  // 🏢 ENTERPRISE: Show stats if available (e.g., floor/area for parking/storage)
  const hasStats = stats.length > 0;

  return (
    <ListCard
      entityType={navigationEntityType}
      title={result.title}
      subtitle={result.subtitle}
      badges={badges}
      stats={hasStats ? stats : undefined}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-label={`${entityLabel}: ${result.title}`}
      compact
      hideStats={!hasStats}
      inlineBadges
      // 🏢 ENTERPRISE: Command palette hover pattern (VS Code, Salesforce, SAP Fiori)
      // Subtle hover = background only, no scale effect
      hoverVariant="subtle"
      className={className}
    />
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
  const spacing = useSpacingTokens();
  const typography = useTypography();

  // 🏢 ENTERPRISE: Get icon and color from centralized NAVIGATION_ENTITIES
  const navigationEntityType = SEARCH_TO_NAVIGATION_ENTITY[entityType];
  const entityConfig = NAVIGATION_ENTITIES[navigationEntityType];
  const IconComponent = entityConfig?.icon || FileText;
  const iconColor = entityConfig?.color || 'text-muted-foreground';

  const entityLabelKey = ENTITY_LABEL_KEYS[entityType];
  const label = t(entityLabelKey, ENTITY_LABELS[entityType] ?? entityLabelKey);

  return (
    <section className={spacing.margin.bottom.sm} aria-label={label}>
      {/* Group Header */}
      <header className={cn(
        'flex items-center uppercase tracking-wider',
        spacing.gap.sm,
        'px-3 py-1.5',
        typography.label.xs,
        'text-muted-foreground'
      )}>
        <IconComponent className={cn('h-3.5 w-3.5', iconColor)} aria-hidden="true" />
        <span>{label}</span>
        <span className="text-muted-foreground/60">({count})</span>
      </header>

      {/* Results */}
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { SearchResultItemProps, SearchResultGroupProps };

// 🏢 ENTERPRISE: Re-export mappings for other components that may need them
export { ENTITY_LABEL_KEYS, ENTITY_LABELS, SEARCH_TO_NAVIGATION_ENTITY };


