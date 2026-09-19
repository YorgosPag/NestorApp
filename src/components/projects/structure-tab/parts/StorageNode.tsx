'use client';

/**
 * 🏢 ENTERPRISE: Storage Node Component
 *
 * Displays a storage unit in the project structure. Το κέλυφος (εικονίδιο · τίτλος · σήματα
 * κατάστασης) είναι το κοινό `SpaceNode` (ADR-777 §8.60.20)· εδώ μένει ό,τι είναι της αποθήκης.
 *
 * @module components/projects/structure-tab/parts/StorageNode
 */

import React from 'react';
import type { StorageModel } from '../types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SpaceNode } from './SpaceNode';

interface StorageNodeProps {
  storage: StorageModel;
}

export const StorageNode = ({ storage }: StorageNodeProps) => {
  const { t } = useTranslation('storage');

  return (
    <SpaceNode
      entity="storage"
      space={storage}
      title={storage.name}
      details={
        <>
          {storage.type && <span className="capitalize">{storage.type}</span>}
          {storage.floor && <span> • {t('general.fields.floor')}: {storage.floor}</span>}
          {storage.area && <span> • {storage.area} m²</span>}
        </>
      }
    />
  );
};
