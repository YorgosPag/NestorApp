import type {
  CanvasCreationConfig,
  CanvasProviderConfig,
} from '../../../core/canvas/interfaces/ICanvasProvider';
import type { CanvasInstance } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasManager';
import type { CanvasRenderSettings } from '../../../subapps/dxf-viewer/rendering/canvas/core/CanvasSettings';
import type { CanvasConfig as DxfCanvasConfig } from '../../../subapps/dxf-viewer/rendering/types/Types';
import { UI_COLORS } from '../../../subapps/dxf-viewer/config/color-config';
import type { GeoCanvasConfig, GeographicTransform } from './geo-canvas-types';

const DEFAULT_MAP_BOUNDS = {
  north: 85,
  south: -85,
  east: 180,
  west: -180,
} as const;

const DEFAULT_CENTER = { lat: 0, lng: 0 } as const;
const DEFAULT_PROJECTION = 'mercator';
const DEFAULT_Z_INDEX = 1;

export const createGeoSettings = (
  config: CanvasProviderConfig,
): Partial<CanvasRenderSettings> => ({
  enableHiDPI: true,
  devicePixelRatio: window.devicePixelRatio || 1,
  imageSmoothingEnabled: true,
  backgroundColor: UI_COLORS.TRANSPARENT,
  enableBatching: true,
  enableCaching: true,
  enableMetrics: config.enablePerformanceMonitoring !== false,
  useUnifiedRendering: true,
  enableCoordination: config.enableGlobalEventBus !== false,
  debugMode: process.env.NODE_ENV === 'development',
  ...config.defaultSettings,
});

export const setupGeoCanvasContext = (
  canvas: HTMLCanvasElement,
  settings: Partial<CanvasRenderSettings>,
): CanvasRenderingContext2D => {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas 2D context for geo canvas');
  }

  const devicePixelRatio = settings.devicePixelRatio || window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.round(rect.width * devicePixelRatio);
  canvas.height = Math.round(rect.height * devicePixelRatio);

  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.imageSmoothingEnabled = settings.imageSmoothingEnabled !== false;

  return context;
};

export const createDxfCanvasConfig = (config: CanvasCreationConfig): DxfCanvasConfig => {
  const rawConfig = config.config as Record<string, unknown>;

  return {
    devicePixelRatio: (rawConfig.devicePixelRatio as number | undefined) ?? window.devicePixelRatio,
    enableHiDPI: (rawConfig.enableHiDPI as boolean | undefined) ?? true,
    backgroundColor: (rawConfig.backgroundColor as string | undefined) ?? UI_COLORS.CANVAS_BACKGROUND_AUTOCAD_DARK,
    antialias: rawConfig.antialias as boolean | undefined,
    imageSmoothingEnabled: rawConfig.imageSmoothingEnabled as boolean | undefined,
  };
};

export const createGeoCanvasInstance = (
  config: CanvasCreationConfig,
  context: CanvasRenderingContext2D,
): CanvasInstance => {
  const canvasInstance: CanvasInstance = {
    id: config.canvasId,
    type: config.canvasType,
    element: config.element,
    context,
    config: createDxfCanvasConfig(config),
    zIndex: config.zIndex || DEFAULT_Z_INDEX,
    isActive: config.isActive !== false,
    lastRenderTime: 0,
  };

  if (config.metadata) {
    (canvasInstance as CanvasInstance & { metadata?: Record<string, unknown> }).metadata = config.metadata;
  }

  return canvasInstance;
};

export const createInitialGeoTransform = (config: GeoCanvasConfig): GeographicTransform => ({
  center: config.initialCenter || DEFAULT_CENTER,
  zoom: config.initialZoom || 1,
  bounds: config.initialBounds || DEFAULT_MAP_BOUNDS,
  projection: config.projection || DEFAULT_PROJECTION,
});
