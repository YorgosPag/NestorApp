/**
 * Building Locations Tab — Τοποθεσίες & Διευθύνσεις Κτιρίου
 *
 * Ξεχωριστή καρτέλα για multi-address management (ADR-167).
 * Ίδιο pattern με το Έργο (ProjectLocationsTab).
 * Μετακινήθηκε από τα "Γενικά" για συνέπεια.
 */

'use client';

import { BuildingAddressesCard } from './GeneralTabContent/BuildingAddressesCard';
import { BuildingPlaceLinkCard } from './GeneralTabContent/BuildingPlaceLinkCard';
import type { ProjectAddress } from '@/types/project/addresses';
import type { PlaceRef } from '@/types/geo/public-place';

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
    <div className="space-y-4">
      <BuildingAddressesCard
        buildingId={String(buildingId)}
        projectId={buildingData.projectId as string | undefined}
        addresses={buildingData.addresses as ProjectAddress[] | undefined}
        legacyAddress={buildingData.address as string | undefined}
        legacyCity={buildingData.city as string | undefined}
      />
      {/*
        ADR-777 §14.5 — δίπλα στις διευθύνσεις επίτηδες: η διεύθυνση απαντά *«πού
        είναι;»*, ο δεσμός *«ποιο **πράγμα** είναι;»*. Είναι διαφορετικές ερωτήσεις που
        ο άνθρωπος απαντά στην **ίδια** στιγμή, και μόνο η δεύτερη μπορεί να ταιριάξει
        με μια ζήτηση Ζ3/Ζ5.
      */}
      <BuildingPlaceLinkCard
        buildingId={String(buildingId)}
        placeRef={(buildingData.placeRef as PlaceRef | undefined) ?? null}
      />
    </div>
  );
}
