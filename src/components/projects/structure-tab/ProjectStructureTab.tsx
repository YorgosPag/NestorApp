'use client';

import React from 'react';
import type { ProjectStructureTabProps } from './types';
import { useProjectStructure } from './hooks/useProjectStructure';
import { getTotals } from './utils/selectors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { LoadingSkeleton } from './parts/LoadingSkeleton';
import { EmptyState } from './parts/EmptyState';
import { StatsOverview } from './parts/StatsOverview';
import { ProjectHeader } from './parts/ProjectHeader';
import { BuildingNode } from './parts/BuildingNode';

export function ProjectStructureTab({ projectId }: ProjectStructureTabProps) {
  const { structure, loading, error } = useProjectStructure(projectId);
  const spacing = useSpacingTokens();

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">{error}</div>
    );
  }

  if (!structure) {
    return <EmptyState projectId={projectId} />;
  }

  const totals = getTotals(structure);

  return (
    <section className={`${spacing.padding.top.md} ${spacing.spaceBetween.lg}`}>
      <StatsOverview {...totals} />

      {/* 🏢 ENTERPRISE: Project header - minimal design (no border wrapper) */}
      <ProjectHeader
        name={structure.project.name}
        buildingsCount={structure.buildings.length}
        totalUnits={totals.totalUnits}
      />

      {/* 🏢 ENTERPRISE: Buildings list - minimal design */}
      <div className="space-y-4">
        {structure.buildings.map(building => (
          <BuildingNode key={building.id} building={building} />
        ))}
      </div>
    </section>
  );
}
