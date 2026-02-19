'use client';

import React from 'react';
import type { Building } from '../BuildingsPageContent';

import { BuildingCardTitle } from './BuildingCardContent/BuildingCardTitle';
import { BuildingCardLocation } from './BuildingCardContent/BuildingCardLocation';
import { BuildingCardProgress } from './BuildingCardContent/BuildingCardProgress';
import { BuildingCardMetrics } from './BuildingCardContent/BuildingCardMetrics';
import { BuildingCardFeatures } from './BuildingCardContent/BuildingCardFeatures';

interface BuildingCardContentProps {
  building: Building;
}

export function BuildingCardContent({ building }: BuildingCardContentProps) {
  return (
    <div className="p-2 space-y-2">
      <BuildingCardTitle name={building.name} description={building.description} />
      <BuildingCardLocation address={building.address} city={building.city} />
      <BuildingCardProgress progress={building.progress} />
      <BuildingCardMetrics building={building} />
      <BuildingCardFeatures features={building.features} />
    </div>
  );
}
