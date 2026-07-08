'use client';

/**
 * 📋 ENTERPRISE PROJECT GRID CARD - Domain Component
 *
 * Thin wrapper: computes the shared view-model via useProjectCardModel (ADR-585)
 * and renders it into the GridCard shell. Subtitle is Grid-specific (location).
 *
 * @fileoverview Project domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see ProjectListCard for list view equivalent
 * @see useProjectCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React, { useMemo } from 'react';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Project } from '@/types/project';

// 🏢 SHARED VIEW-MODEL (ADR-585)
import { useProjectCardModel } from './useProjectCardModel';

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
// 🏢 COMPONENT
// =============================================================================

/**
 * 📋 ProjectGridCard Component
 *
 * Domain-specific card for projects in grid views.
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
  const { ariaLabel, ...cardProps } = useProjectCardModel(project);

  /** Get location for subtitle (Grid-specific) */
  const subtitle = useMemo(() => {
    if (project.city && project.address) {
      return `${project.city} - ${project.address}`;
    }
    return project.city || project.address || project.company;
  }, [project.city, project.address, project.company]);

  return (
    <GridCard
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

ProjectGridCard.displayName = 'ProjectGridCard';

export default ProjectGridCard;
