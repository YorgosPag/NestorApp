'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';

interface BuildingCardFeaturesProps {
  features?: string[];
}

export function BuildingCardFeatures({ features }: BuildingCardFeaturesProps) {
  if (!features || features.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pt-2">
      {features.slice(0, 3).map((feature, index) => (
        <CommonBadge
          key={index}
          status="building"
          customLabel={feature}
          variant="outline"
          className="text-xs px-2 py-0.5"
        />
      ))}
      {features.length > 3 && (
        <CommonBadge
          status="building"
          customLabel={`+${features.length - 3}`}
          variant="outline"
          className="text-xs px-2 py-0.5"
        />
      )}
    </div>
  );
}
