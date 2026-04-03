import type { CanvasCreationConfig, CanvasProviderConfig } from '../../../core/canvas/interfaces/ICanvasProvider';

export interface GeographicPoint {
  lat: number;
  lng: number;
  alt?: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeographicTransform {
  center: GeographicPoint;
  zoom: number;
  bounds: MapBounds;
  projection: string;
}

export interface GeoCanvasConfig extends CanvasCreationConfig {
  initialCenter?: GeographicPoint;
  initialZoom?: number;
  initialBounds?: MapBounds;
  projection?: string;
  enablePanning?: boolean;
  enableZooming?: boolean;
  enableRotation?: boolean;
  maxZoom?: number;
  minZoom?: number;
}

export interface GeoCanvasProviderConfig extends CanvasProviderConfig {
  autoInitialize?: boolean;
}
