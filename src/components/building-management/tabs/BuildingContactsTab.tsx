/**
 * Building Contacts Tab — Σύνδεση Επαφών με Κτίριο
 *
 * Wrapper → EntityAssociationsManager entityType="building"
 */

'use client';

import { EntityAssociationsManager } from '@/components/associations/EntityAssociationsManager';

interface BuildingContactsTabProps {
  building?: { id: string; [key: string]: unknown };
  data?: { id: string; [key: string]: unknown };
}

export function BuildingContactsTab({ building, data }: BuildingContactsTabProps) {
  const buildingData = building ?? data;
  const buildingId = buildingData?.id;

  if (!buildingId) return null;

  return <EntityAssociationsManager entityType="building" entityId={buildingId} />;
}
