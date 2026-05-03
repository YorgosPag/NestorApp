/**
 * @related ADR-186 §8b — Project tab container for the Phase 2 form
 *
 * Wires the form to `useProjectBuildingCode` and the project passed by
 * `UniversalTabsRenderer`. Reads `project` (or `data` for legacy compatibility
 * with the renderer's polymorphic prop set).
 */
'use client';

import type { Project } from '@/types/project';
import { useProjectBuildingCode } from '@/hooks/useProjectBuildingCode';
import { BuildingCodeForm } from './BuildingCodeForm';

interface BuildingCodeTabProps {
  project?: Project | null;
  data?: Project | null;
}

export function BuildingCodeTab({ project, data }: BuildingCodeTabProps) {
  const projectData = project ?? data ?? null;
  const hook = useProjectBuildingCode(projectData);

  return (
    <section className="p-6 max-w-4xl mx-auto">
      <BuildingCodeForm hook={hook} />
    </section>
  );
}

export default BuildingCodeTab;
