'use client';

import React from 'react';
import { Warehouse } from 'lucide-react';
import type { Storage } from '@/types/storage/contracts';
import { StorageDetailsHeader } from './StorageDetailsHeader';
import { StorageTabs } from './StorageTabs';
import { DetailsContainer } from '@/core/containers';

interface StorageDetailsProps {
  storage: Storage | null;
}

export function StorageDetails({ storage }: StorageDetailsProps) {
  return (
    <DetailsContainer
      selectedItem={storage}
      header={storage ? <StorageDetailsHeader storage={storage} /> : null}
      emptyStateProps={{
        icon: Warehouse,
        title: "Επιλέξτε μια αποθήκη",
        description: "Επιλέξτε μια αποθήκη από τη λίστα για να δείτε τις λεπτομέρειές της."
      }}
    >
      {storage && <StorageTabs storage={storage} />}
    </DetailsContainer>
  );
}