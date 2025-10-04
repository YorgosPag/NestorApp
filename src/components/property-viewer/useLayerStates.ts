'use client';

import { useState } from 'react';

export interface LayerState {
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export function useLayerStates() {
  const [layerStates, setLayerStates] = useState<Record<string, LayerState>>({
    properties: {
      visible: true,
      locked: false,
      opacity: 1
    },
    grid: {
      visible: true,
      locked: false,
      opacity: 0.5
    },
    measurements: {
      visible: true,
      locked: false,
      opacity: 1
    },
    connections: {
      visible: true,
      locked: false,
      opacity: 0.8
    }
  });

  const toggleLayerVisibility = (layerId: string) => {
    setLayerStates(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        visible: !prev[layerId]?.visible
      }
    }));
  };

  const setLayerOpacity = (layerId: string, opacity: number) => {
    setLayerStates(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        opacity: Math.max(0, Math.min(1, opacity))
      }
    }));
  };

  const lockLayer = (layerId: string, locked: boolean) => {
    setLayerStates(prev => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        locked
      }
    }));
  };

  return {
    layerStates,
    setLayerStates,
    toggleLayerVisibility,
    setLayerOpacity,
    lockLayer
  };
}