'use client';

import { ProjectStructureTab as StructureTabContent } from '../structure-tab';

export function ProjectStructureTab({ projectId }: { projectId: number }) {
  return <StructureTabContent projectId={projectId} />;
}
