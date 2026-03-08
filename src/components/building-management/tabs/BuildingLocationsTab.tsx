/**
 * Building Locations Tab — Τοποθεσίες & Διευθύνσεις Κτιρίου
 *
 * Ξεχωριστή καρτέλα για multi-address management (ADR-167).
 * Ίδιο pattern με το Έργο (ProjectLocationsTab).
 * Μετακινήθηκε από τα "Γενικά" για συνέπεια.
 */

'use client';

import { BuildingAddressesCard } from './GeneralTabContent/BuildingAddressesCard';
import type { ProjectAddress } from '@/types/project/addresses';

interface BuildingLocationsTabProps {
  building?: {
    id: string;
    projectId?: string;
    addresses?: ProjectAddress[];
    address?: string;
    city?: string;
    [key: string]: unknown;
  };
  data?: {
    id: string;
    projectId?: string;
    addresses?: ProjectAddress[];
    address?: string;
    city?: string;
    [key: string]: unknown;
  };
}

export function BuildingLocationsTab({ building, data }: BuildingLocationsTabProps) {
  const buildingData = building ?? data;
  const buildingId = buildingData?.id;

  if (!buildingId) return null;

  return (
    <BuildingAddressesCard
      buildingId={String(buildingId)}
      projectId={buildingData.projectId as string | undefined}
      addresses={buildingData.addresses as ProjectAddress[] | undefined}
      legacyAddress={buildingData.address as string | undefined}
      legacyCity={buildingData.city as string | undefined}
    />
  );
}
