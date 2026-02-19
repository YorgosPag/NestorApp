
'use client';

import React from 'react';
import { BuildingCard } from '../BuildingCard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '../BuildingsPageContent';

interface BuildingsGroupedViewProps {
  viewMode: 'grid' | 'byType' | 'byStatus';
  filteredBuildings: Building[];
  selectedBuilding: Building | null;
  setSelectedBuilding: (building: Building | null) => void;
}

export function BuildingsGroupedView({
  viewMode,
  filteredBuildings,
  selectedBuilding,
  setSelectedBuilding,
}: BuildingsGroupedViewProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');

  const groupedByType = filteredBuildings.reduce((acc, building) => {
    const type = building.category || 'mixed';
    if (!acc[type]) acc[type] = [];
    acc[type].push(building);
    return acc;
  }, {} as Record<string, Building[]>);

  const groupedByStatus = filteredBuildings.reduce((acc, building) => {
    const status = building.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(building);
    return acc;
  }, {} as Record<string, Building[]>);

  if (viewMode === 'grid') {
    return (
      <div className="flex-1 p-2 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredBuildings.map((building) => (
            <BuildingCard
              key={building.id}
              building={building}
              isSelected={selectedBuilding?.id === building.id}
              onClick={() => setSelectedBuilding(building)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'byType') {
    return (
      <div className="flex-1 p-2 overflow-auto">
        {Object.entries(groupedByType).map(([type, buildingsOfType]) => (
          <div key={type} className="mb-2">
            <h2 className="text-xl font-bold mb-2 capitalize border-b pb-2">{t(`category.${type}`, { defaultValue: type })} ({buildingsOfType.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {buildingsOfType.map((building) => (
                <BuildingCard
                  key={building.id}
                  building={building}
                  isSelected={selectedBuilding?.id === building.id}
                  onClick={() => setSelectedBuilding(building)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === 'byStatus') {
    return (
      <div className="flex-1 p-2 overflow-auto">
        {Object.entries(groupedByStatus).map(([status, buildingsOfStatus]) => (
          <div key={status} className="mb-2">
            <h2 className="text-xl font-bold mb-2 capitalize border-b pb-2">{t(`status.${status}`, { defaultValue: status })} ({buildingsOfStatus.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {buildingsOfStatus.map((building) => (
                <BuildingCard
                  key={building.id}
                  building={building}
                  isSelected={selectedBuilding?.id === building.id}
                  onClick={() => setSelectedBuilding(building)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
