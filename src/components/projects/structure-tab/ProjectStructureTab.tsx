'use client';

import React from 'react';
import type { ProjectStructureTabProps } from './types';
import { useProjectStructure } from './hooks/useProjectStructure';
import { getTotals } from './utils/selectors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

import { LoadingSkeleton } from './parts/LoadingSkeleton';
import { EmptyState } from './parts/EmptyState';
import { StatsOverview } from './parts/StatsOverview';
import { ProjectHeader } from './parts/ProjectHeader';
import { BuildingNode } from './parts/BuildingNode';

export function ProjectStructureTab({ projectId }: ProjectStructureTabProps) {
  const { structure, loading, error } = useProjectStructure(projectId);
  const { quick } = useBorderTokens();

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
    <div className="p-4">
      <StatsOverview {...totals} />
      
      <div className={`border-l-4 ${quick.info} pl-4 my-6`}>
        <ProjectHeader 
          name={structure.project.name}
          buildingsCount={structure.buildings.length}
          totalUnits={totals.totalUnits}
        />
      </div>

      <div className="space-y-4">
        {structure.buildings.map(building => (
          <BuildingNode key={building.id} building={building} />
        ))}
      </div>
    </div>
  );
}
