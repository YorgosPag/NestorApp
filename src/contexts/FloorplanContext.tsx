'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

/** 🏢 ENTERPRISE: File type discriminator */
type FloorplanFileType = 'dxf' | 'pdf';

/**
 * 🏢 ENTERPRISE: Floorplan data structure for context
 * Supports both DXF and PDF floorplans
 */
interface FloorplanData {
  projectId: string;
  buildingId?: string;
  type: 'project' | 'parking';
  /** 🏢 ENTERPRISE: File type indicator */
  fileType?: FloorplanFileType;
  /** DXF scene data - typed as unknown for flexibility with SceneModel */
  scene?: unknown | null;
  /** PDF rendered image as data URL (only for fileType: 'pdf') */
  pdfImageUrl?: string | null;
  /** PDF page dimensions (only for fileType: 'pdf') */
  pdfDimensions?: { width: number; height: number } | null;
  fileName: string;
  timestamp: number;
}

interface FloorplanContextType {
  projectFloorplans: Record<string, FloorplanData>;
  parkingFloorplans: Record<string, FloorplanData>;
  setProjectFloorplan: (projectId: string, data: FloorplanData) => void;
  setParkingFloorplan: (projectId: string, data: FloorplanData) => void;
  getProjectFloorplan: (projectId: string) => FloorplanData | null;
  getParkingFloorplan: (projectId: string) => FloorplanData | null;
}

const FloorplanContext = createContext<FloorplanContextType | null>(null);

export function FloorplanProvider({ children }: { children: React.ReactNode }) {
  const [projectFloorplans, setProjectFloorplans] = useState<Record<string, FloorplanData>>({});
  const [parkingFloorplans, setParkingFloorplans] = useState<Record<string, FloorplanData>>({});

  const setProjectFloorplan = useCallback((projectId: string, data: FloorplanData) => {
    console.log('🏗️ Setting project floorplan for project:', projectId, data);
    setProjectFloorplans(prev => ({ ...prev, [projectId]: data }));
  }, []);

  const setParkingFloorplan = useCallback((projectId: string, data: FloorplanData) => {
    console.log('🏗️ Setting parking floorplan for project:', projectId, data);
    setParkingFloorplans(prev => ({ ...prev, [projectId]: data }));
  }, []);

  const getProjectFloorplan = useCallback((projectId: string) => {
    return projectFloorplans[projectId] || null;
  }, [projectFloorplans]);

  const getParkingFloorplan = useCallback((projectId: string) => {
    return parkingFloorplans[projectId] || null;
  }, [parkingFloorplans]);

  const value = {
    projectFloorplans,
    parkingFloorplans,
    setProjectFloorplan,
    setParkingFloorplan,
    getProjectFloorplan,
    getParkingFloorplan
  };

  return (
    <FloorplanContext.Provider value={value}>
      {children}
    </FloorplanContext.Provider>
  );
}

export function useFloorplan() {
  const context = useContext(FloorplanContext);
  if (!context) {
    throw new Error('useFloorplan must be used within FloorplanProvider');
  }
  return context;
}