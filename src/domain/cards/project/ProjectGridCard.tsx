'use client';

/**
 * 📋 ENTERPRISE PROJECT GRID CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useProjectCardModel
 * (ADR-585) and delegates rendering to the DomainCard grid shell. Subtitle is
 * Grid-specific (location).
 *
 * @fileoverview Project domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ProjectListCard for list view equivalent
 * @see useProjectCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React, { useMemo } from 'react';

import type { Project } from '@/types/project';
import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import { useProjectCardModel } from './useProjectCardModel';

export interface ProjectGridCardProps extends DomainCardInteraction {
  /** Project data */
  project: Project;
}

/**
 * 📋 ProjectGridCard — domain card for projects in grid/tile views.
 */
export function ProjectGridCard({ project, ...interaction }: ProjectGridCardProps) {
  const model = useProjectCardModel(project);

  /** Location subtitle (Grid-specific) */
  const subtitle = useMemo(() => {
    if (project.city && project.address) {
      return `${project.city} - ${project.address}`;
    }
    return project.city || project.address || project.company;
  }, [project.city, project.address, project.company]);

  return <DomainCard variant="grid" model={{ ...model, subtitle }} {...interaction} />;
}

ProjectGridCard.displayName = 'ProjectGridCard';

export default ProjectGridCard;
