/**
 * Project Associations Tab — Σύνδεση Μηχανικών/Επαφών με Έργο
 *
 * Wrapper → EntityAssociationsManager entityType=ENTITY_TYPES.PROJECT
 * Integrates useGuardedEngineerRemoval (ADR-305): impact guard before removing
 * a project engineer with open obligations.
 */

'use client';

import { useCallback } from 'react';
import { EntityAssociationsManager } from '@/components/associations/EntityAssociationsManager';
import { useGuardedEngineerRemoval } from '@/hooks/useGuardedEngineerRemoval';
import { outcomeOrThrow } from '@/hooks/impact-guard/guard-result';
import { ENTITY_TYPES } from '@/config/domain-constants';

interface ProjectAssociationsTabProps {
  project?: { id: string; [key: string]: unknown };
  data?: { id: string; [key: string]: unknown };
}

export function ProjectAssociationsTab({ project, data }: ProjectAssociationsTabProps) {
  const projectData = project ?? data;
  const projectId = projectData?.id;

  const { ImpactDialog, runRemoveOperation } = useGuardedEngineerRemoval(projectId ?? '');

  const handleRemoveIntercept = useCallback(
    (contactId: string, role: string, proceed: () => Promise<void>) => {
      // ADR-777 §8.69.13 — `failed` ξαναγίνεται απόρριψη, όπως ήταν πάντα η αποτυχία του `proceed`.
      void runRemoveOperation({ contactId, role }, proceed).then(outcomeOrThrow);
    },
    [runRemoveOperation],
  );

  if (!projectId) return null;

  return (
    <>
      <EntityAssociationsManager
        entityType={ENTITY_TYPES.PROJECT}
        entityId={projectId}
        onRemoveIntercept={handleRemoveIntercept}
      />
      {ImpactDialog}
    </>
  );
}
