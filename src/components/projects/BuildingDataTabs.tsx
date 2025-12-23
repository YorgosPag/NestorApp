'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers } from "@/components/ui/navigation/TabsComponents";
import { Home, CheckCircle, Target, MoreHorizontal } from 'lucide-react';
import { GeneralPlotDataTab, type PlotData } from './GeneralPlotDataTab';
import { AllowedBuildingDataTab, type AllowedDataInput, type AllowedDataCalculated } from './AllowedBuildingDataTab';
import { ActualBuildingDataTab, type ActualData, type CalculatedActualData } from './ActualBuildingDataTab';
import { OtherDataTab } from './OtherDataTab';

interface BuildingDataTabsProps {
  isEditing: boolean;
  plotData: PlotData & { sdFinal?: number };
  allowedDataInput: AllowedDataInput;
  actualData: ActualData;
  calculatedAllowedData: AllowedDataCalculated;
  calculatedActualData: CalculatedActualData;
  onPlotDataChange: (data: Partial<PlotData>) => void;
  onAllowedDataChange: (data: Partial<AllowedDataInput>) => void;
  onActualDataChange: (data: Partial<ActualData>) => void;
}

export function BuildingDataTabs({
  isEditing,
  plotData,
  allowedDataInput,
  actualData,
  calculatedAllowedData,
  calculatedActualData,
  onPlotDataChange,
  onAllowedDataChange,
  onActualDataChange,
}: BuildingDataTabsProps) {
  const buildingTabs = [
    {
      id: 'general-plot-data',
      label: 'Όροι Δόμησης Οικοπέδου',
      icon: Home,
      content: (
        <GeneralPlotDataTab
          plotData={plotData}
          onPlotDataChange={onPlotDataChange}
          isEditing={isEditing}
        />
      ),
    },
    {
      id: 'allowed-data',
      label: 'Επιτρεπόμενα',
      icon: CheckCircle,
      content: (
        <AllowedBuildingDataTab
          allowedDataInput={allowedDataInput}
          calculatedData={calculatedAllowedData}
          onInputChange={onAllowedDataChange}
          isEditing={isEditing}
        />
      ),
    },
    {
      id: 'actual-data',
      label: 'Πραγματοποιούμενα',
      icon: Target,
      content: (
        <ActualBuildingDataTab
          actualData={actualData}
          calculatedData={calculatedActualData}
          onActualDataChange={onActualDataChange}
          isEditing={isEditing}
        />
      ),
    },
    {
      id: 'other-data',
      label: 'Λοιπά Στοιχεία',
      icon: MoreHorizontal,
      content: <OtherDataTab />,
    }
  ];

  return (
    <TabsOnlyTriggers
      tabs={buildingTabs}
      defaultTab="general-plot-data"
      theme="default"
    >
      {buildingTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-8 overflow-x-auto">
          {tab.content}
        </TabsContent>
      ))}
    </TabsOnlyTriggers>
  );
}
