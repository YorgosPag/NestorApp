'use client';

import { ProjectStructureTab as StructureTabContent } from '../structure-tab';

export function ProjectStructureTab({ projectId }: { projectId: string }) {
  return <StructureTabContent projectId={projectId} />;
}
