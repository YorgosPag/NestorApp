/**
 * USER PREFERENCES — Types & Default Configuration
 *
 * All interfaces and the fallback defaults factory for user preferences.
 * Extracted from EnterpriseUserPreferencesService.ts for SRP compliance (ADR-065 Phase 4).
 *
 * EXEMPT from 500-line limit: types + config/data file.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PropertyViewerFilters {
  searchTerm: string;
  project: string[];
  building: string[];
  floor: string[];
  propertyType: string[];
  status: string[];
  priceRange: { min: number | null; max: number | null };
  areaRange: { min: number | null; max: number | null };
  features: string[];
}

export interface PropertyViewerStats {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  totalValue: number;
  totalArea: number;
  averagePrice: number;
  propertiesByStatus: Record<string, number>;
  propertiesByType: Record<string, number>;
  propertiesByFloor: Record<string, number>;
  totalStorageUnits: number;
  availableStorageUnits: number;
  soldStorageUnits: number;
  uniqueBuildings: number;
  reserved: number;
}

export interface PropertyViewerPreferences {
  defaultFilters: PropertyViewerFilters;
  defaultStats: PropertyViewerStats;
  fallbackFloorId: string;
  viewMode: 'grid' | 'list' | 'map';
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showMeasurements: boolean;
  scale: number;
  showDashboard: boolean;
  autoSaveFilters: boolean;
  rememberLastView: boolean;
}

export interface EditorToolPreferences {
  defaultTool: string;
  showToolTips: boolean;
  keyboardShortcuts: Record<string, string>;
  toolbarLayout: 'horizontal' | 'vertical' | 'compact';
  showAdvancedTools: boolean;
}

export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'auto';
  colorScheme: string;
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  animations: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  notificationTypes: {
    propertyUpdates: boolean;
    systemMessages: boolean;
    taskReminders: boolean;
    collaborationUpdates: boolean;
  };
}

export interface UserPreferences {
  propertyViewer: PropertyViewerPreferences;
  editorTools: EditorToolPreferences;
  display: DisplayPreferences;
  notifications: NotificationPreferences;
  customSettings: Record<string, unknown>;
}

export interface EnterpriseUserPreferencesConfig {
  id: string;
  userId: string;
  tenantId?: string;
  preferences: UserPreferences;
  isEnabled: boolean;
  version: string;
  metadata: {
    displayName?: string;
    description?: string;
    lastSyncedAt?: Date;
    deviceInfo?: {
      deviceType: string;
      browserInfo: string;
      screenResolution: string;
    };
    migrationInfo?: {
      migratedFrom?: string;
      migrationDate?: Date;
    };
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface CompanyDefaultPreferencesConfig {
  id: string;
  tenantId: string;
  category: 'propertyViewer' | 'editorTools' | 'display' | 'notifications';
  defaults: Record<string, unknown>;
  isEnabled: boolean;
  priority: number;
  environment?: string;
  metadata: {
    displayName?: string;
    description?: string;
    version?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

// ============================================================================
// FALLBACK PREFERENCES FACTORY
// ============================================================================

/**
 * Get default/fallback user preferences for offline/error scenarios.
 * Used as the base layer before company defaults and user overrides.
 */
export function getDefaultUserPreferences(): UserPreferences {
  return {
    propertyViewer: {
      defaultFilters: {
        searchTerm: '',
        project: [],
        building: [],
        floor: [],
        propertyType: [],
        status: [],
        priceRange: { min: null, max: null },
        areaRange: { min: null, max: null },
        features: []
      },
      defaultStats: {
        totalProperties: 0,
        availableProperties: 0,
        soldProperties: 0,
        totalValue: 0,
        totalArea: 0,
        averagePrice: 0,
        propertiesByStatus: {},
        propertiesByType: {},
        propertiesByFloor: {},
        totalStorageUnits: 0,
        availableStorageUnits: 0,
        soldStorageUnits: 0,
        uniqueBuildings: 0,
        reserved: 0
      },
      fallbackFloorId: process.env.NEXT_PUBLIC_DEFAULT_FLOOR_ID || 'floor-1',
      viewMode: 'grid',
      showGrid: true,
      snapToGrid: false,
      gridSize: 20,
      showMeasurements: true,
      scale: 1,
      showDashboard: true,
      autoSaveFilters: true,
      rememberLastView: true
    },
    editorTools: {
      defaultTool: 'select',
      showToolTips: true,
      keyboardShortcuts: {
        'ctrl+z': 'undo',
        'ctrl+y': 'redo',
        'delete': 'delete',
        'escape': 'deselect'
      },
      toolbarLayout: 'horizontal',
      showAdvancedTools: false
    },
    display: {
      theme: 'light',
      colorScheme: 'blue',
      fontSize: 'medium',
      density: 'comfortable',
      animations: true,
      highContrast: false,
      reduceMotion: false
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      soundEnabled: true,
      notificationTypes: {
        propertyUpdates: true,
        systemMessages: true,
        taskReminders: true,
        collaborationUpdates: false
      }
    },
    customSettings: {}
  };
}
