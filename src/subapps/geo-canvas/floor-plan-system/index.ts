/**
 * 🏗️ FLOOR PLAN SYSTEM - PUBLIC API
 *
 * Enterprise Floor Plan Integration για Geo-Canvas
 *
 * @module floor-plan-system
 * @version 1.0.0
 * @description Multi-format floor plan upload, georeferencing, και layer rendering
 *
 * Supported Formats:
 * - DXF (AutoCAD Drawing Exchange Format)
 * - PDF (Portable Document Format)
 * - DWG (AutoCAD Drawing)
 * - Images (PNG, JPG, TIFF)
 */

// ============================================================================
// 📱 COMPONENTS
// ============================================================================

// ✅ Control Point Components
export { FloorPlanControlPointPicker } from './components/FloorPlanControlPointPicker';
export type { FloorPlanControlPointPickerProps } from './components/FloorPlanControlPointPicker';

// Floor Plan Upload & Management
// export { FloorPlanUploader } from './components/FloorPlanUploader';
// export { FloorPlanPreview } from './components/FloorPlanPreview';
// export { FloorPlanControls } from './components/FloorPlanControls';

// Georeferencing Workflow
// export { GeoreferencingWorkflow } from './components/GeoreferencingWorkflow';
// export { ControlPointSelector } from './components/ControlPointSelector';

// Property Management
// export { PropertyPolygonEditor } from './components/PropertyPolygonEditor';
// export { PropertyMetadataForm } from './components/PropertyMetadataForm';

// ============================================================================
// 🎨 RENDERING LAYERS
// ============================================================================

// Map Layers
// export { FloorPlanImageLayer } from './rendering/FloorPlanImageLayer';
// export { FloorPlanVectorLayer } from './rendering/FloorPlanVectorLayer';
// export { PropertyOverlay } from './rendering/PropertyOverlay';

// ============================================================================
// 🔄 SERVICES
// ============================================================================

// Core Services
// export { FloorPlanManager } from './services/FloorPlanManager';
// export { GeoreferencingService } from './services/GeoreferencingService';
// export { LayerManager } from './services/LayerManager';
// export { PropertyManager } from './services/PropertyManager';

// ============================================================================
// 📦 PARSERS
// ============================================================================

// ✅ Vector Parsers (DXF, DWG)
export { DxfParser, parseDxf } from './parsers/vector/DxfParser';
export { DwgParser, parseDwg } from './parsers/vector/DwgParser';

// ✅ Raster Parsers (Images, PDF)
export {
  ImageParser,
  parseImage,
  SUPPORTED_IMAGE_FORMATS
} from './parsers/raster/ImageParser';
export type { ImageMetadata, ImageParserResult } from './parsers/raster/ImageParser';

// PDF Parser (future)
// export { PdfParser, parsePdf } from './parsers/raster/PdfParser';

// ✅ Parser Utilities
export {
  detectFormat,
  isVectorFormat,
  isRasterFormat,
  getParser
} from './parsers';

// ============================================================================
// 🔧 HOOKS
// ============================================================================

// ✅ React Hooks
export { useFloorPlanUpload } from './hooks/useFloorPlanUpload';
export type {
  UseFloorPlanUploadState,
  UseFloorPlanUploadActions,
  UseFloorPlanUploadReturn
} from './hooks/useFloorPlanUpload';

export { useFloorPlanControlPoints } from './hooks/useFloorPlanControlPoints';
export type {
  UseFloorPlanControlPointsState,
  UseFloorPlanControlPointsActions,
  UseFloorPlanControlPointsReturn
} from './hooks/useFloorPlanControlPoints';

export { useGeoTransformation } from './hooks/useGeoTransformation';
export type {
  UseGeoTransformationState,
  UseGeoTransformationActions,
  UseGeoTransformationReturn,
  UseGeoTransformationOptions
} from './hooks/useGeoTransformation';

// Future Hooks
// export { useFloorPlanGeoreference } from './hooks/useFloorPlanGeoreference';
// export { useFloorPlanLayer } from './hooks/useFloorPlanLayer';
// export { usePropertyPolygon } from './hooks/usePropertyPolygon';

// ============================================================================
// 📊 TYPES
// ============================================================================

// TypeScript Types
export type * from './types';

// ============================================================================
// 🧪 UTILITIES
// ============================================================================

// Utility Functions
// export { calculateBounds } from './utils/bounds-calculator';
// export { convertCoordinates } from './utils/coordinate-converter';
// export { optimizeLayer } from './utils/layer-optimizer';

// ============================================================================
// 📚 CONSTANTS & CONFIG
// ============================================================================

/**
 * Supported floor plan formats
 */
export const SUPPORTED_FORMATS = {
  DXF: {
    extension: '.dxf',
    mimeType: 'application/dxf',
    description: 'AutoCAD Drawing Exchange Format',
    supportsVector: true
  },
  PDF: {
    extension: '.pdf',
    mimeType: 'application/pdf',
    description: 'Portable Document Format',
    supportsVector: false
  },
  DWG: {
    extension: '.dwg',
    mimeType: 'application/dwg',
    description: 'AutoCAD Drawing',
    supportsVector: true
  },
  PNG: {
    extension: '.png',
    mimeType: 'image/png',
    description: 'Portable Network Graphics',
    supportsVector: false
  },
  JPG: {
    extension: '.jpg',
    mimeType: 'image/jpeg',
    description: 'JPEG Image',
    supportsVector: false
  },
  TIFF: {
    extension: '.tiff',
    mimeType: 'image/tiff',
    description: 'Tagged Image File Format',
    supportsVector: false
  }
} as const;

/**
 * Default floor plan configuration
 */
export const DEFAULT_FLOOR_PLAN_CONFIG = {
  layer: {
    opacity: 0.8,
    zIndex: 100,
    visible: true
  },
  georeferencing: {
    minControlPoints: 3,
    maxControlPoints: 10,
    transformationMethod: 'affine' as const,
    accuracyThreshold: 1.0 // meters
  },
  rendering: {
    imageQuality: 'high' as const,
    vectorSimplification: true,
    cacheEnabled: true
  }
} as const;

// ============================================================================
// 🔍 VERSION INFO
// ============================================================================

export const FLOOR_PLAN_SYSTEM_VERSION = '1.0.0';
export const FLOOR_PLAN_SYSTEM_BUILD_DATE = '2025-10-10';
