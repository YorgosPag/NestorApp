import type { Property } from '@/types/property-viewer';

/**
 * 🚨 ENTERPRISE MIGRATION NOTICE
 *
 * This file contains hardcoded layer styles που have been replaced by:
 * EnterpriseLayerStyleService για database-driven configuration.
 *
 * Legacy exports are maintained για backward compatibility.
 * For new code, use:
 *
 * ```typescript
 * import { layerStyleService } from '@/services/layer/EnterpriseLayerStyleService';
 * const styles = await layerStyleService.loadLayerStyles('default', 'tenant-id');
 * ```
 *
 * @see src/services/layer/EnterpriseLayerStyleService.ts
 */

/**
 * Layer Types για το Floor Plan System
 * 
 * Ορίζει τη δομή των layers που μπορούν να περιέχουν:
 * - Properties (polygons)
 * - Annotations (κείμενα, σημειώσεις)
 * - Measurements (γραμμές μέτρησης)
 * - Background elements
 */

export interface LayerColor {
  primary: string;
  secondary?: string;
  opacity: number;
}

export interface LayerStyle {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  dashArray?: string;
}

export interface LayerElement {
  id: string;
  type: 'property' | 'annotation' | 'measurement' | 'line' | 'circle' | 'rectangle';
  data: any; // Flexible data structure based on type
  style?: Partial<LayerStyle>;
  isVisible: boolean;
  isLocked: boolean;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyLayerElement extends LayerElement {
  type: 'property';
  data: Property;
}

export interface AnnotationLayerElement extends LayerElement {
  type: 'annotation';
  data: {
    text: string;
    position: { x: number; y: number };
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    color: string;
    rotation?: number;
  };
}

export interface MeasurementLayerElement extends LayerElement {
  type: 'measurement';
  data: {
    points: Array<{ x: number; y: number }>;
    measurement: number;
    unit: 'px' | 'm' | 'cm' | 'mm';
    label?: string;
    showLabel: boolean;
  };
}

export interface LineLayerElement extends LayerElement {
  type: 'line';
  data: {
    points: Array<{ x: number; y: number }>;
    isPolyline: boolean;
    isClosed: boolean;
  };
}

export interface CircleLayerElement extends LayerElement {
  type: 'circle';
  data: {
    center: { x: number; y: number };
    radius: number;
  };
}

export interface RectangleLayerElement extends LayerElement {
  type: 'rectangle';
  data: {
    topLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
}

export type AnyLayerElement = 
  | PropertyLayerElement 
  | AnnotationLayerElement 
  | MeasurementLayerElement 
  | LineLayerElement 
  | CircleLayerElement 
  | RectangleLayerElement;

export interface Layer {
  id: string;
  name: string;
  description?: string;
  isVisible: boolean;
  isLocked: boolean;
  isSystem: boolean; // System layers cannot be deleted
  opacity: number;
  zIndex: number;
  color: LayerColor;
  defaultStyle: LayerStyle;
  elements: AnyLayerElement[];
  floorId: string;
  buildingId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    category?: 'structural' | 'electrical' | 'plumbing' | 'hvac' | 'furniture' | 'annotations' | 'measurements';
    tags?: string[];
    version?: number;
    parentLayerId?: string;
  };
}

export interface LayerGroup {
  id: string;
  name: string;
  description?: string;
  isVisible: boolean;
  isExpanded: boolean;
  layers: string[]; // Layer IDs
  color: string;
  icon?: string;
  order: number;
}

export interface LayerState {
  layers: Layer[];
  groups: LayerGroup[];
  activeLayerId: string | null;
  selectedElementIds: string[];
  clipboard: AnyLayerElement[];
  history: LayerHistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;
}

export interface LayerHistoryEntry {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'move' | 'copy' | 'paste';
  layerId: string;
  elementId?: string;
  beforeState?: any;
  afterState?: any;
  description: string;
}

export interface LayerFilter {
  showVisible: boolean;
  showHidden: boolean;
  showLocked: boolean;
  showUnlocked: boolean;
  categories: string[];
  searchTerm: string;
}

export interface LayerExportOptions {
  includeHiddenLayers: boolean;
  includeLockedLayers: boolean;
  format: 'pdf' | 'svg' | 'png' | 'json';
  quality: 'low' | 'medium' | 'high';
  includeMetadata: boolean;
  layerIds?: string[]; // Export specific layers only
}

export interface LayerPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canShare: boolean;
  canCreateElements: boolean;
  canEditElements: boolean;
  canDeleteElements: boolean;
}

export interface LayerTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  layers: Omit<Layer, 'id' | 'floorId' | 'buildingId' | 'createdBy' | 'createdAt' | 'updatedAt'>[];
  groups?: Omit<LayerGroup, 'id'>[];
  isPublic: boolean;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

// Utility Types
export type LayerElementType = AnyLayerElement['type'];
export type LayerCategory = NonNullable<Layer['metadata']>['category'];

// ============================================================================
// 🏢 ENTERPRISE LAYER STYLES
// ============================================================================

/**
 * ✅ Layer styles are now loaded from Firebase/Database!
 *
 * Configuration υπάρχει στο: COLLECTIONS.CONFIG
 * Management μέσω: EnterpriseLayerStyleService
 * Fallback: Built-in theme support (default/dark/high-contrast)
 *
 * Features:
 * - Multi-tenant styling support
 * - Theme-specific styles (default, dark, high-contrast)
 * - Accessibility compliance (WCAG AA/AAA)
 * - Environment-specific styles
 * - Real-time style updates
 * - Performance-optimized caching
 *
 * Usage:
 * ```typescript
 * import { layerStyleService } from '@/services/layer/EnterpriseLayerStyleService';
 *
 * // Load styles για specific theme/tenant
 * const styles = await layerStyleService.loadLayerStyles('dark', 'company-a');
 * const propertyStyle = await layerStyleService.getLayerStyle('property', 'default');
 * ```
 */

/**
 * ⚠️ LEGACY FALLBACK: Default styles για backward compatibility
 *
 * Αυτές οι τιμές χρησιμοποιούνται μόνο ως fallback όταν:
 * - Η Firebase δεν είναι διαθέσιμη
 * - Δεν υπάρχει configuration στη database
 * - Offline mode
 *
 * WCAG AA compliant colors για accessibility
 */
export const DEFAULT_LAYER_STYLES: Record<LayerElementType, LayerStyle> = {
  property: {
    strokeColor: '#3b82f6',    // Enhanced blue (WCAG AA)
    fillColor: '#3b82f6',
    strokeWidth: 2,
    opacity: 0.3
  },
  annotation: {
    strokeColor: '#10b981',    // Enhanced green (WCAG AA)
    fillColor: '#10b981',
    strokeWidth: 1,
    opacity: 1
  },
  measurement: {
    strokeColor: '#f59e0b',    // Enhanced amber (WCAG AA)
    fillColor: '#f59e0b',
    strokeWidth: 2,
    opacity: 1,
    dashArray: '5,5'
  },
  line: {
    strokeColor: '#6b7280',    // Enhanced gray (WCAG AA)
    fillColor: 'transparent',
    strokeWidth: 2,
    opacity: 1
  },
  circle: {
    strokeColor: '#8b5cf6',    // Enhanced purple (WCAG AA)
    fillColor: '#8b5cf6',
    strokeWidth: 2,
    opacity: 0.2
  },
  rectangle: {
    strokeColor: '#ef4444',    // Enhanced red (WCAG AA)
    fillColor: '#ef4444',
    strokeWidth: 2,
    opacity: 0.2
  }
};

/**
 * 🚀 ENTERPRISE LAYER CATEGORIES
 *
 * For new code, use the async category service:
 *
 * ```typescript
 * // Modern async approach (recommended)
 * const categories = await layerStyleService.loadLayerCategories('default', 'tenant-id');
 *
 * // Or get all categories με theme support
 * const categories = await layerStyleService.loadLayerCategories('dark', 'tenant-id');
 * ```
 *
 * Enterprise service path:
 * @see @/services/layer/EnterpriseLayerStyleService
 */

/**
 * ⚠️ LEGACY FALLBACK: Default categories για backward compatibility
 *
 * Αυτές οι τιμές χρησιμοποιούνται μόνο ως fallback όταν:
 * - Η Firebase δεν είναι διαθέσιμη
 * - Δεν υπάρχει configuration στη database
 * - Offline mode
 *
 * WCAG AA compliant colors για accessibility
 */
export const LAYER_CATEGORIES: Record<LayerCategory, { name: string; icon: string; color: string }> = {
  structural: {
    name: 'Δομικά Στοιχεία',
    icon: 'Building',
    color: '#64748b'    // Enhanced slate (WCAG AA)
  },
  electrical: {
    name: 'Ηλεκτρολογικά',
    icon: 'Zap',
    color: '#eab308'    // Enhanced yellow (WCAG AA)
  },
  plumbing: {
    name: 'Υδραυλικά',
    icon: 'Droplets',
    color: '#3b82f6'    // Enhanced blue (WCAG AA)
  },
  hvac: {
    name: 'Κλιματισμός',
    icon: 'Wind',
    color: '#10b981'    // Enhanced green (WCAG AA)
  },
  furniture: {
    name: 'Έπιπλα',
    icon: 'Armchair',
    color: '#8b5cf6'    // Enhanced purple (WCAG AA)
  },
  annotations: {
    name: 'Σημειώσεις',
    icon: 'MessageSquare',
    color: '#f59e0b'    // Enhanced amber (WCAG AA)
  },
  measurements: {
    name: 'Μετρήσεις',
    icon: 'Ruler',
    color: '#ef4444'    // Enhanced red (WCAG AA)
  }
};

/**
 * 🏢 ENTERPRISE SYSTEM LAYERS
 *
 * System layer identifiers που μπορούν να customized ανά tenant.
 * For enterprise deployments, these IDs can be overridden μέσω environment variables.
 */
export const SYSTEM_LAYERS = {
  PROPERTIES: process.env.NEXT_PUBLIC_SYSTEM_LAYER_PROPERTIES || 'system-properties',
  GRID: process.env.NEXT_PUBLIC_SYSTEM_LAYER_GRID || 'system-grid',
  BACKGROUND: process.env.NEXT_PUBLIC_SYSTEM_LAYER_BACKGROUND || 'system-background',
  MEASUREMENTS: process.env.NEXT_PUBLIC_SYSTEM_LAYER_MEASUREMENTS || 'system-measurements'
} as const;

/**
 * 🚀 ENTERPRISE LAYER STYLE LOADER
 *
 * For new code, use the async style service:
 *
 * ```typescript
 * // Modern async approach (recommended)
 * import { layerStyleService } from '@/services/layer/EnterpriseLayerStyleService';
 *
 * const styles = await layerStyleService.loadLayerStyles('default', 'tenant-id');
 * const categories = await layerStyleService.loadLayerCategories('default', 'tenant-id');
 * const propertyStyle = await layerStyleService.getLayerStyle('property', 'dark', 'tenant-id');
 * ```
 *
 * Enterprise service path:
 * @see @/services/layer/EnterpriseLayerStyleService
 */

// Layer Events
export interface LayerEvent {
  type: 'layer:created' | 'layer:updated' | 'layer:deleted' | 'layer:visibility:changed' | 
        'element:created' | 'element:updated' | 'element:deleted' | 'element:selected';
  layerId: string;
  elementId?: string;
  data?: any;
  timestamp: string;
  userId?: string;
}

// Layer Validation
export interface LayerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Layer Import/Export Formats
export interface LayerExportData {
  version: string;
  exportedAt: string;
  floorId: string;
  buildingId: string;
  layers: Layer[];
  groups: LayerGroup[];
  metadata: {
    exportedBy: string;
    exportOptions: LayerExportOptions;
    totalElements: number;
  };
}