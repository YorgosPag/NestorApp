'use client';

/**
 * 🏢 ENTERPRISE: Parking Node Component
 *
 * Displays a parking spot in the project structure. Το κέλυφος (εικονίδιο · τίτλος · σήματα
 * κατάστασης) είναι το κοινό `SpaceNode` (ADR-777 §8.60.20)· εδώ μένει ό,τι είναι της θέσης.
 *
 * @module components/projects/structure-tab/parts/ParkingNode
 */

import React from 'react';
import type { ParkingModel } from '../types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { hostedFloorRef } from '@/lib/floor/hosted-floor';
import { SpaceNode } from './SpaceNode';

interface ParkingNodeProps {
  parking: ParkingModel;
}

export const ParkingNode = ({ parking }: ParkingNodeProps) => {
  const { t } = useTranslation('parking');
  const floor = useFloorLabel()(hostedFloorRef(parking));

  return (
    <SpaceNode
      entity="parking"
      space={parking}
      title={<>{t('structure.parkingSpot')} {parking.number}</>}
      details={
        <>
          {parking.type && <span>{t(`types.${parking.type}`, { defaultValue: parking.type })}</span>}
          {floor && <span> • {t('structure.level')}: {floor}</span>}
          {parking.area && <span> • {parking.area} m²</span>}
        </>
      }
    />
  );
};
