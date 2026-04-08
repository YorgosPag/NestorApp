/**
 * Building Contacts Tab — Σύνδεση Επαφών με Κτίριο
 *
 * Wrapper → EntityAssociationsManager entityType="building"
 * Passes parentProjectId for inheritance (Project contacts appear here).
 */

'use client';

import { EntityAssociationsManager } from '@/components/associations/EntityAssociationsManager';
import { ENTITY_TYPES } from '@/config/domain-constants';

interface BuildingContactsTabProps {
  building?: { id: string; projectId?: string; [key: string]: unknown };
  data?: { id: string; projectId?: string; [key: string]: unknown };
}

export function BuildingContactsTab({ building, data }: BuildingContactsTabProps) {
  const buildingData = building ?? data;
  const buildingId = buildingData?.id;
  const parentProjectId = buildingData?.projectId as string | undefined;

  if (!buildingId) return null;

  return (
    <EntityAssociationsManager
      entityType={ENTITY_TYPES.BUILDING}
      entityId={buildingId}
      parentProjectId={parentProjectId}
    />
  );
}
