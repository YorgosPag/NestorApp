'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  return (
    <Tabs defaultValue="general-plot-data" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="general-plot-data">Όροι Δόμησης Οικοπέδου</TabsTrigger>
        <TabsTrigger value="allowed-data">Επιτρεπόμενα</TabsTrigger>
        <TabsTrigger value="actual-data">Πραγματοποιούμενα</TabsTrigger>
        <TabsTrigger value="other-data">Λοιπά Στοιχεία</TabsTrigger>
      </TabsList>
      <TabsContent value="general-plot-data" className="pt-4">
        <GeneralPlotDataTab 
            plotData={plotData}
            onPlotDataChange={onPlotDataChange}
            isEditing={isEditing}
        />
      </TabsContent>
      <TabsContent value="allowed-data" className="pt-4">
          <AllowedBuildingDataTab 
            allowedDataInput={allowedDataInput}
            calculatedData={calculatedAllowedData}
            onInputChange={onAllowedDataChange}
            isEditing={isEditing}
        />
      </TabsContent>
      <TabsContent value="actual-data" className="pt-4">
        <ActualBuildingDataTab 
            actualData={actualData}
            calculatedData={calculatedActualData}
            onActualDataChange={onActualDataChange}
            isEditing={isEditing}
        />
      </TabsContent>
      <TabsContent value="other-data" className="pt-4">
        <OtherDataTab />
      </TabsContent>
    </Tabs>
  );
}
