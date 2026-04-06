/**
 * HitTester Types — ADR-065 SRP split
 * Interfaces and types for the hit testing system.
 */

import type { Point2D } from '../types/Types';
import type { SpatialQueryOptions, SpatialQueryResult } from '../../core/spatial';
import type { Entity } from '../../types/entities';

export interface HitTestOptions extends SpatialQueryOptions {
  snapToVertices?: boolean;
  snapToEdges?: boolean;
  snapToCenters?: boolean;
  snapToGrid?: boolean;
  useSpatialIndex?: boolean;
  maxCandidates?: number;
  highlightCandidates?: boolean;
  debugMode?: boolean;
}

export interface HitTestResult extends SpatialQueryResult<Entity> {
  hitType: 'entity' | 'vertex' | 'edge' | 'center' | 'grid';
  hitPoint: Point2D;
  snapPoint?: Point2D;
  vertexIndex?: number;
  edgeIndex?: number;
  layer: string;
  selectable: boolean;
  priority: number;
}

export interface SnapResult {
  point: Point2D;
  type: 'vertex' | 'edge' | 'center' | 'grid' | 'intersection';
  entityId?: string;
  distance: number;
  visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}
