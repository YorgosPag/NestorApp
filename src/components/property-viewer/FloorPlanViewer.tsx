"use client";

import { FloorPlanViewer as RefactoredFloorPlanViewer } from '@/features/floorplan-viewer';
import type { FloorPlanViewerLayoutProps } from '@/features/floorplan-viewer/types';

export function FloorPlanViewer(props: FloorPlanViewerLayoutProps) {
  // Pass-through to the new refactored component
  return <RefactoredFloorPlanViewer {...props} />;
}
