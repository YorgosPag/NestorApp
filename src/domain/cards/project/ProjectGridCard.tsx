'use client';

/**
 * 📋 ENTERPRISE PROJECT GRID CARD - Domain Component
 *
 * Domain-specific card for projects in grid/tile views.
 * Extends GridCard with project-specific defaults and stats.
 *
 * @fileoverview Project domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see ProjectListCard for list view equivalent
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatCurrency, formatNumber } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES
import type { Project } from '@/types/project';
import { PROJECT_STATUS_LABELS } from '@/types/project';

// 🏢 BADGE VARIANT MAPPING
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface ProjectGridCardProps {
  /** Project data */
  project: Project;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler */
  onSelect?: () => void;
  /** Favorite toggle handler */
  onToggleFavorite?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 STATUS TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

const STATUS_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  planning: 'warning',
  in_progress: 'info',
  completed: 'success',
  on_hold: 'secondary',
  cancelled: 'destructive',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 📋 ProjectGridCard Component
 *
 * Domain-specific card for projects in grid views.
 * Uses GridCard with project defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <ProjectGridCard
 *   project={project}
 *   isSelected={selectedId === project.id}
 *   onSelect={() => setSelectedId(project.id)}
 *   onToggleFavorite={() => toggleFavorite(project.id)}
 *   isFavorite={favorites.has(project.id)}
 * />
 * ```
 */
export function ProjectGridCard({
  project,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: ProjectGridCardProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Build stats array from project data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Progress - 🏢 ENTERPRISE: i18n label
    if (project.progress !== undefined) {
      items.push({
        icon: TrendingUp,
        label: t('listCard.progress'),
        value: `${project.progress}%`,
        valueColor: project.progress >= 80 ? 'text-green-600 dark:text-green-400' : undefined,
      });
    }

    // Total Area - 🏢 ENTERPRISE: Using centralized area icon/color + i18n label
    if (project.totalArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('listCard.totalArea'),
        value: `${formatNumber(project.totalArea)} m²`,
      });
    }

    // Total Value - 🏢 ENTERPRISE: Using centralized price icon/color + i18n label
    if (project.totalValue && project.totalValue > 0) {
      items.push({
        icon: NAVIGATION_ENTITIES.price.icon,
        iconColor: NAVIGATION_ENTITIES.price.color,
        label: t('listCard.value'),
        value: formatCurrency(project.totalValue, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        valueColor: NAVIGATION_ENTITIES.price.color,
      });
    }

    return items;
  }, [project.progress, project.totalArea, project.totalValue, t]);

  /** Build badges from status */
  const badges = useMemo(() => {
    const status = project.status || 'planning';
    const statusLabel = PROJECT_STATUS_LABELS[status] || status;
    const variant = STATUS_BADGE_VARIANTS[status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [project.status]);

  /** Get location for subtitle */
  const subtitle = useMemo(() => {
    if (project.city && project.address) {
      return `${project.city} - ${project.address}`;
    }
    return project.city || project.address || project.company;
  }, [project.city, project.address, project.company]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <GridCard
      entityType="project"
      title={project.name || project.title || project.id}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={t('listCard.ariaLabel', { name: project.name || project.title || project.id })}
    />
  );
}

ProjectGridCard.displayName = 'ProjectGridCard';

export default ProjectGridCard;
