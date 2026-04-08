/**
 * Project Associations Tab — Σύνδεση Επαφών με Έργο
 *
 * Αντικαθιστά τον παλιό ContributorsTab (stub).
 * Wrapper → EntityAssociationsManager entityType=ENTITY_TYPES.PROJECT
 */

'use client';

import { EntityAssociationsManager } from '@/components/associations/EntityAssociationsManager';
import { ENTITY_TYPES } from '@/config/domain-constants';

interface ProjectAssociationsTabProps {
  project?: { id: string; [key: string]: unknown };
  data?: { id: string; [key: string]: unknown };
}

export function ProjectAssociationsTab({ project, data }: ProjectAssociationsTabProps) {
  const projectData = project ?? data;
  const projectId = projectData?.id;

  if (!projectId) return null;

  return <EntityAssociationsManager entityType={ENTITY_TYPES.PROJECT} entityId={projectId} />;
}
