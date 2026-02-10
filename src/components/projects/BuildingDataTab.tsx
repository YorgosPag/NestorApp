'use client';

import React from 'react';
import { useBuildingData } from '@/hooks/useBuildingData';
import { BuildingEditToolbar } from './BuildingEditToolbar';
import { BuildingDataTabs } from './BuildingDataTabs';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingDataTab');

export function BuildingDataTab() {
  const {
    isEditing,
    setIsEditing,
    plotData,
    handlePlotDataChange,
    allowedDataInput,
    handleAllowedDataChange,
    actualData,
    handleActualDataChange,
    calculatedAllowedData,
    calculatedActualData,
    sdFinal,
  } = useBuildingData();

  const handleSave = () => {
    // Here you would typically call an API to save the data
    logger.info('Saving data', { plotData, allowedDataInput, actualData });
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <BuildingEditToolbar
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)} // Add a reset logic if needed
      />
      <BuildingDataTabs
        isEditing={isEditing}
        plotData={{ ...plotData, sdFinal }}
        allowedDataInput={allowedDataInput}
        actualData={actualData}
        calculatedAllowedData={calculatedAllowedData}
        calculatedActualData={calculatedActualData}
        onPlotDataChange={handlePlotDataChange}
        onAllowedDataChange={handleAllowedDataChange}
        onActualDataChange={handleActualDataChange}
      />
    </div>
  );
}
