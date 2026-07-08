'use client';

/**
 * 📋 ENTERPRISE PROJECT LIST CARD - Domain Component
 *
 * Thin wrapper: computes the shared view-model via useProjectCardModel (ADR-585)
 * and renders it into the ListCard shell. Subtitle is List-specific
 * (company-first — company is the primary business info).
 *
 * @fileoverview Project domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see useProjectCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Project } from '@/types/project';

// 🏢 SHARED VIEW-MODEL (ADR-585)
import { useProjectCardModel } from './useProjectCardModel';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface ProjectListCardProps {
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
// 🏢 COMPONENT
// =============================================================================

/**
 * 📋 ProjectListCard Component
 *
 * Domain-specific card for projects in list views.
 *
 * @example
 * ```tsx
 * <ProjectListCard
 *   project={project}
 *   isSelected={selectedId === project.id}
 *   onSelect={() => setSelectedId(project.id)}
 *   onToggleFavorite={() => toggleFavorite(project.id)}
 *   isFavorite={favorites.has(project.id)}
 * />
 * ```
 */
export function ProjectListCard({
  project,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: ProjectListCardProps) {
  const { ariaLabel, ...cardProps } = useProjectCardModel(project);

  /** Get company for subtitle - 🏢 ENTERPRISE: Company is PRIMARY info (List-specific) */
  const subtitle = useMemo(() => {
    // 🏢 ENTERPRISE: Always show company first (primary business info)
    // Location is secondary and shown in stats/details if needed
    return project.company || project.city || project.address || '';
  }, [project.company, project.city, project.address]);

  return (
    <ListCard
      {...cardProps}
      subtitle={subtitle}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

ProjectListCard.displayName = 'ProjectListCard';

export default ProjectListCard;
