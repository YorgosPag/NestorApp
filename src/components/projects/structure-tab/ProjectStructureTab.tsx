'use client';

import React from 'react';
import type { ProjectStructureTabProps } from './types';
import { useProjectStructure } from './hooks/useProjectStructure';
import { getTotals } from './utils/selectors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { LoadingSkeleton } from './parts/LoadingSkeleton';
import { EmptyState } from './parts/EmptyState';
import { StatsOverview } from './parts/StatsOverview';
import { ProjectHeader } from './parts/ProjectHeader';
import { BuildingNode } from './parts/BuildingNode';
import '@/lib/design-system';

export function ProjectStructureTab({ projectId }: ProjectStructureTabProps) {
  const { structure, loading, error } = useProjectStructure(projectId);
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className={cn(spacing.padding.md, "text-center", colors.text.error)}>{t(error, { defaultValue: error })}</div>
    );
  }

  if (!structure) {
    return <EmptyState />;
  }

  const totals = getTotals(structure);

  return (
    <section className={`${spacing.padding.top.sm} ${spacing.spaceBetween.sm}`}>
      <StatsOverview {...totals} />

      {/* 🏢 ENTERPRISE: Project header - minimal design (no border wrapper) */}
      <ProjectHeader
        name={structure.project.name}
        buildingsCount={structure.buildings.length}
        totalProperties={totals.totalProperties}
      />

      {/* 🏢 ENTERPRISE: Buildings list - 8px unified spacing */}
      <div className={spacing.spaceBetween.sm}>
        {structure.buildings.map(building => (
          <BuildingNode key={String(building.id)} building={building} />
        ))}
      </div>
    </section>
  );
}
