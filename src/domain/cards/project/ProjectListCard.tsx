'use client';

/**
 * 📋 ENTERPRISE PROJECT LIST CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useProjectCardModel
 * (ADR-585) and delegates rendering to the DomainCard list shell. Subtitle is
 * List-specific (company-first — company is the primary business info).
 *
 * @fileoverview Project domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see useProjectCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';

import type { Project } from '@/types/project';
import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import { useProjectCardModel } from './useProjectCardModel';

export interface ProjectListCardProps extends DomainCardInteraction {
  /** Project data */
  project: Project;
}

/**
 * 📋 ProjectListCard — domain card for projects in list views.
 */
export function ProjectListCard({ project, ...interaction }: ProjectListCardProps) {
  const model = useProjectCardModel(project);

  /** Company-first subtitle (List-specific) — company is the primary business info */
  const subtitle = useMemo(() => {
    return project.company || project.city || project.address || '';
  }, [project.company, project.city, project.address]);

  return <DomainCard variant="list" model={{ ...model, subtitle }} {...interaction} />;
}

ProjectListCard.displayName = 'ProjectListCard';

export default ProjectListCard;
