'use client';

import { FloorPlanCanvas as RefactoredFloorPlanCanvas } from '@/features/floorplan-canvas/FloorPlanCanvas';
import type { FloorPlanCanvasProps } from '@/features/floorplan-canvas/types';

export function FloorPlanCanvas(props: FloorPlanCanvasProps) {
  return <RefactoredFloorPlanCanvas {...props} />;
}
