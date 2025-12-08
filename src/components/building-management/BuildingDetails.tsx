
'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import type { Building } from './BuildingsPageContent';
import { BuildingDetailsHeader } from './BuildingDetails/BuildingDetailsHeader';
import { BuildingTabs } from './BuildingDetails/BuildingTabs';
import { DetailsContainer } from '@/core/containers';


interface BuildingDetailsProps {
  building: Building | null;
}

export function BuildingDetails({ building }: BuildingDetailsProps) {
  return (
    <DetailsContainer
      selectedItem={building}
      header={<BuildingDetailsHeader building={building!} />}
      emptyStateProps={{
        icon: Building2,
        title: "Επιλέξτε ένα κτίριο",
        description: "Επιλέξτε ένα κτίριο από τη λίστα για να δείτε τις λεπτομέρειές του."
      }}
    >
      <BuildingTabs building={building!} />
    </DetailsContainer>
  );
}
