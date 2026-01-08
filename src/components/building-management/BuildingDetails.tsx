
'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { Building } from './BuildingsPageContent';
import { BuildingDetailsHeader } from './BuildingDetails/BuildingDetailsHeader';
import { BuildingTabs } from './BuildingDetails/BuildingTabs';
import { DetailsContainer } from '@/core/containers';


interface BuildingDetailsProps {
  building: Building | null;
}

export function BuildingDetails({ building }: BuildingDetailsProps) {
  // 🗨️ ENTERPRISE: Centralized messages system
  const emptyStateMessages = useEmptyStateMessages();

  return (
    <DetailsContainer
      selectedItem={building}
      header={<BuildingDetailsHeader building={building!} />}
      tabsRenderer={<BuildingTabs building={building!} />}
      emptyStateProps={{
        icon: NAVIGATION_ENTITIES.building.icon,
        ...emptyStateMessages.building
      }}
    />
  );
}
