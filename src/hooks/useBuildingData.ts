'use client';

import { useState, useMemo, useCallback } from 'react';
import type { PlotData } from '@/components/projects/GeneralPlotDataTab';
import type { AllowedDataInput, AllowedDataCalculated } from '@/components/projects/AllowedBuildingDataTab';
import type { ActualData, CalculatedActualData } from '@/components/projects/ActualBuildingDataTab';

const initialPlotData: PlotData = {
  sdNoSocial: 1.8,
  socialFactor: 1.0,
  plotArea: 2178.90,
  areaCompleteness: 0,
  areaCompletenessDerogation: 0,
  faceCompleteness: 0,
  faceCompletenessDerogation: 0,
  insideLimits: 'yes',
  insideZone: 'yes',
  pilotis: 'yes',
  hasRoof: 'no',
  maxRoofHeight: 0,
  maxRoofSlope: 0,
};

const initialAllowedDataInput: AllowedDataInput = {
  maxCoveragePercentage: 70,
  maxSemiOutdoorPercentage: 15,
  maxBalconyPercentage: 40,
  maxCombinedPercentage: 40,
  maxVolumeCoefficient: 5.5,
  maxAllowedHeight: 17.5,
};

const initialActualData: ActualData = {
  construction: 3922.02,
  plotCoverage: 1478.9,
  semiOutdoorArea: 245.89,
  balconyArea: 456.89,
  height: 17.5,
};

export function useBuildingData() {
  const [isEditing, setIsEditing] = useState(false);
  const [plotData, setPlotData] = useState<PlotData>(initialPlotData);
  const [allowedDataInput, setAllowedDataInput] = useState<AllowedDataInput>(initialAllowedDataInput);
  const [actualData, setActualData] = useState<ActualData>(initialActualData);

  const handlePlotDataChange = useCallback((newData: Partial<PlotData>) => {
    setPlotData(prev => ({ ...prev, ...newData }));
  }, []);

  const handleAllowedDataChange = useCallback((newData: Partial<AllowedDataInput>) => {
    setAllowedDataInput(prev => ({ ...prev, ...newData }));
  }, []);
  
  const handleActualDataChange = useCallback((newData: Partial<ActualData>) => {
    setActualData(prev => ({...prev, ...newData}));
  }, []);

  const sdFinal = useMemo(() => {
    return plotData.sdNoSocial * plotData.socialFactor;
  }, [plotData.sdNoSocial, plotData.socialFactor]);

  const calculatedAllowedData = useMemo<AllowedDataCalculated>(() => {
    const maxAllowedConstruction = sdFinal * plotData.plotArea;
    const maxPlotCoverage = (allowedDataInput.maxCoveragePercentage / 100) * plotData.plotArea;
    const maxAllowedSemiOutdoorArea = (allowedDataInput.maxSemiOutdoorPercentage / 100) * maxAllowedConstruction;
    const maxBalconyArea = (allowedDataInput.maxBalconyPercentage / 100) * maxAllowedConstruction;
    const maxCombinedArea = (allowedDataInput.maxCombinedPercentage / 100) * maxAllowedConstruction;
    const maxVolumeExploitation = plotData.plotArea * allowedDataInput.maxVolumeCoefficient;
    return {
      maxAllowedConstruction,
      maxPlotCoverage,
      maxAllowedSemiOutdoorArea,
      maxBalconyArea,
      maxCombinedArea,
      maxVolumeExploitation,
    };
  }, [sdFinal, plotData.plotArea, allowedDataInput]);

  const calculatedActualData = useMemo<CalculatedActualData>(() => {
    const coveragePercentage = plotData.plotArea > 0 ? actualData.plotCoverage / plotData.plotArea : 0;
    const semiOutdoorPercentage = actualData.construction > 0 ? actualData.semiOutdoorArea / actualData.construction : 0;
    const balconyPercentage = actualData.construction > 0 ? actualData.balconyArea / actualData.construction : 0;
    const combinedArea = actualData.semiOutdoorArea + actualData.balconyArea;
    const combinedPercentage = actualData.construction > 0 ? combinedArea / actualData.construction : 0;
    const volumeExploitation = 0; // Placeholder for now
    const volumeCoefficient = plotData.plotArea > 0 ? volumeExploitation / plotData.plotArea : 0;
    return {
      coveragePercentage,
      semiOutdoorPercentage,
      balconyPercentage,
      combinedArea,
      combinedPercentage,
      volumeExploitation,
      volumeCoefficient,
    };
  }, [actualData, plotData.plotArea]);

  return {
    isEditing,
    setIsEditing,
    plotData,
    handlePlotDataChange,
    allowedDataInput,
    handleAllowedDataChange,
    actualData,
    handleActualDataChange,
    sdFinal,
    calculatedAllowedData,
    calculatedActualData,
  };
}
