// src/subapps/dxf-viewer/pipeline/types.ts
'use client';

export interface DxfDestination {
  id: string;
  type: 'project' | 'building' | 'floor' | 'unit' | 'storage' | 'parking';
  label: string;
  parentId?: string;
  metadata?: {
    floorNumber?: number;
    category?: 'parking' | 'storage' | 'general';
    projectName?: string;
    buildingName?: string;
  };
}

export interface DxfProcessingOptions {
  destination: DxfDestination;
  processLayers: boolean;
  preserveGrid: boolean;
  preserveRulers: boolean;
  autoScale: boolean;
}

import type { SceneModel } from '../types/scene';

export interface ProcessedDxfResult {
  success: boolean;
  scene: SceneModel;
  destination: DxfDestination;
  processedLayers?: LayerInfo[];
  error?: string;
  stats?: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
    distributionTimeMs: number;
  };
}

export interface LayerInfo {
  id: string;
  name: string;
  entityCount: number;
  visible: boolean;
  color: string;
}

export interface DestinationStorage {
  saveToProject: (projectId: string, scene: SceneModel, category: 'general' | 'parking') => Promise<boolean>;
  saveToBuilding: (buildingId: string, scene: SceneModel, category: 'general' | 'floors') => Promise<boolean>;
  saveToFloor: (floorId: string, scene: SceneModel, layerOverlays: LayerInfo[]) => Promise<boolean>;
  saveToUnit: (unitId: string, scene: SceneModel) => Promise<boolean>;
  saveToStorage: (storageId: string, scene: SceneModel) => Promise<boolean>;
}