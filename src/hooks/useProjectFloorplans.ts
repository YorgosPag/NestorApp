'use client';

import { useState, useEffect } from 'react';
import { FloorplanService, type FloorplanData } from '@/services/floorplans/FloorplanService';
import { useFloorplan } from '@/contexts/FloorplanContext';

interface UseProjectFloorplansReturn {
  projectFloorplan: FloorplanData | null;
  parkingFloorplan: FloorplanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjectFloorplans(projectId: string | number): UseProjectFloorplansReturn {
  const [projectFloorplan, setProjectFloorplan] = useState<FloorplanData | null>(null);
  const [parkingFloorplan, setParkingFloorplan] = useState<FloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectIdStr = projectId.toString();
  
  // Get context floorplans for real-time updates
  const { getProjectFloorplan, getParkingFloorplan } = useFloorplan();

  const fetchFloorplans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🏗️ Fetching floorplans from Firestore for project:', projectIdStr);
      
      // Load both floorplan types in parallel
      const [projectData, parkingData] = await Promise.all([
        FloorplanService.loadFloorplan(projectIdStr, 'project'),
        FloorplanService.loadFloorplan(projectIdStr, 'parking')
      ]);

      setProjectFloorplan(projectData);
      setParkingFloorplan(parkingData);
      
      console.log('✅ Floorplans loaded:', {
        hasProjectFloorplan: !!projectData,
        hasParkingFloorplan: !!parkingData
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching floorplans:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectIdStr) {
      fetchFloorplans();
    }
  }, [projectIdStr]);

  // Listen for context updates (real-time updates from pipeline)
  // Use separate effect to avoid dependency issues
  useEffect(() => {
    const contextProjectFloorplan = getProjectFloorplan(projectIdStr);
    if (contextProjectFloorplan && 
        (!projectFloorplan || contextProjectFloorplan.timestamp > projectFloorplan.timestamp)) {
      console.log('🔄 Updating project floorplan from context:', projectIdStr, {
        contextTimestamp: contextProjectFloorplan.timestamp,
        currentTimestamp: projectFloorplan?.timestamp
      });
      setProjectFloorplan(contextProjectFloorplan);
    }
  }, [getProjectFloorplan, projectIdStr, projectFloorplan]);

  useEffect(() => {
    const contextParkingFloorplan = getParkingFloorplan(projectIdStr);
    if (contextParkingFloorplan && 
        (!parkingFloorplan || contextParkingFloorplan.timestamp > parkingFloorplan.timestamp)) {
      console.log('🔄 Updating parking floorplan from context:', projectIdStr, {
        contextTimestamp: contextParkingFloorplan.timestamp,
        currentTimestamp: parkingFloorplan?.timestamp
      });
      setParkingFloorplan(contextParkingFloorplan);
    }
  }, [getParkingFloorplan, projectIdStr, parkingFloorplan]);

  return {
    projectFloorplan,
    parkingFloorplan,
    loading,
    error,
    refetch: fetchFloorplans
  };
}