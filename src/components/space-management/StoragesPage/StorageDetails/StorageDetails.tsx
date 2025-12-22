'use client';

import React from 'react';
import { Warehouse } from 'lucide-react';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import type { Storage } from '@/types/storage/contracts';
import { StorageDetailsHeader } from './StorageDetailsHeader';
import { StorageTabs } from './StorageTabs';
import { DetailsContainer } from '@/core/containers';

interface StorageDetailsProps {
  storage: Storage | null;
}

export function StorageDetails({ storage }: StorageDetailsProps) {
  // 🗨️ ENTERPRISE: Centralized messages system
  const emptyStateMessages = useEmptyStateMessages();

  return (
    <DetailsContainer
      selectedItem={storage}
      header={storage ? <StorageDetailsHeader storage={storage} /> : null}
      tabsRenderer={storage ? <StorageTabs storage={storage} /> : null}
      emptyStateProps={{
        icon: Warehouse,
        ...emptyStateMessages.storage
      }}
    />
  );
}