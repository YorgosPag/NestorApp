/**
 * CURSOR SYSTEM CONFIGURATION
 * Centralized cursor settings and AutoCAD-style behavior management
 */

import { BaseConfigurationManager } from '../../utils/renderers/shared/geometry-rendering-utils';

// ===== TYPES =====
export interface CursorSettings {
  // Crosshair appearance
  crosshair: {
    enabled: boolean;
    size_percent: number;      // % του viewport (0 = μόνο κέντρο)
    color: string;
    line_width: number;        // πάχος γραμμής σε px
    line_style: 'solid' | 'dashed' | 'dotted' | 'dash-dot'; // τύπος γραμμής
    opacity: number;           // διαφάνεια (0.1 - 1.0)
    use_cursor_gap: boolean;   // χρήση cursor size για center gap
    center_gap_px: number;
    lock_to_dpr: boolean;
    ui_scale: number;
  };
  
  // Cursor appearance (pickbox/aperture)
  cursor: {
    enabled: boolean;
    shape: 'circle' | 'square';     // σχήμα κέρσορα
    size: number;                   // μέγεθος σε pixels
    color: string;                  // χρώμα περιγράμματος
    line_style: 'solid' | 'dashed'; // στυλ γραμμής περιγράμματος
    opacity: number;                // διαφάνεια (0.1 - 1.0)
  };
  
  // Selection colors
  selection: {
    // Window Selection (μπλε κουτί - αριστερά προς δεξιά)
    window: {
      fillColor: string;
      fillOpacity: number;      // διαφάνεια γεμίσματος
      borderColor: string;
      borderOpacity: number;    // διαφάνεια περιγράμματος
      borderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
      borderWidth: number;      // πάχος γραμμής σε pixels
    };
    // Crossing Selection (πράσινο κουτί - δεξιά προς αριστερά)
    crossing: {
      fillColor: string;
      fillOpacity: number;      // διαφάνεια γεμίσματος
      borderColor: string;
      borderOpacity: number;    // διαφάνεια περιγράμματος
      borderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
      borderWidth: number;      // πάχος γραμμής σε pixels
    };
  };
  
  // AutoCAD-style cursor behavior
  behavior: {
    snap_indicator: boolean;
    coordinate_display: boolean;
    dynamic_input: boolean;
    cursor_tooltip: boolean;
  };
  
  // Performance settings
  performance: {
    use_raf: boolean;          // RAF-based updates
    throttle_ms: number;       // Throttling για mouse events
    precision_mode: boolean;   // High-precision για CAD work
  };
}

export interface CursorState {
  position: { x: number; y: number } | null;
  viewport: { width: number; height: number };
  isActive: boolean;
  tool: string;
  snapPoint: { x: number; y: number } | null;
  worldPosition: { x: number; y: number } | null;
}

// ===== DEFAULT AUTOCAD-STYLE CONFIGURATION =====
export const DEFAULT_CURSOR_SETTINGS: CursorSettings = {
  crosshair: {
    enabled: true,
    size_percent: 8,           // AutoCAD default crosshair size (0=μόνο κέντρο)
    color: '#ffffff',
    line_width: 1,             // πάχος γραμμής
    line_style: 'solid',       // τύπος γραμμής
    opacity: 0.9,              // 90% διαφάνεια
    use_cursor_gap: false,     // προεπιλογή: χρήση pickbox size
    center_gap_px: 3,
    lock_to_dpr: true,
    ui_scale: 1
  },
  
  cursor: {
    enabled: true,
    shape: 'circle',           // AutoCAD default shape
    size: 10,                  // μέγεθος σε pixels
    color: '#ffffff',          // λευκό χρώμα
    line_style: 'solid',       // συνεχόμενη γραμμή
    opacity: 0.9               // 90% διαφάνεια
  },
  
  selection: {
    window: {
      fillColor: '#0080ff',    // AutoCAD μπλε
      fillOpacity: 0.2,        // διαφάνεια γεμίσματος
      borderColor: '#0080ff',
      borderOpacity: 1.0,      // συμπαγές περίγραμμα
      borderStyle: 'solid',
      borderWidth: 2           // πάχος γραμμής 2px
    },
    crossing: {
      fillColor: '#00ff80',    // AutoCAD πράσινο
      fillOpacity: 0.2,        // διαφάνεια γεμίσματος
      borderColor: '#00ff80',
      borderOpacity: 1.0,      // συμπαγές περίγραμμα
      borderStyle: 'dashed',
      borderWidth: 2           // πάχος γραμμής 2px
    }
  },
  
  behavior: {
    snap_indicator: true,      // AutoCAD-style snap indicators
    coordinate_display: true,  // Real-time coordinate display
    dynamic_input: true,       // Dynamic input near cursor
    cursor_tooltip: true       // Tool tips following cursor
  },
  
  performance: {
    use_raf: true,            // Smooth 60fps updates
    throttle_ms: 16,          // ~60fps throttling
    precision_mode: true      // High precision για CAD
  }
};

// ===== STORAGE MANAGEMENT =====
const STORAGE_KEY = "autocad_cursor_settings";

export class CursorConfiguration extends BaseConfigurationManager<CursorSettings> {
  private static instance: CursorConfiguration;
  private settings: CursorSettings;

  private constructor() {
    super();
    this.settings = this.loadSettings();
  }

  static getInstance(): CursorConfiguration {
    if (!CursorConfiguration.instance) {
      CursorConfiguration.instance = new CursorConfiguration();
    }
    return CursorConfiguration.instance;
  }

  // Settings management
  getSettings(): CursorSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<CursorSettings>): void {
    this.settings = {
      ...this.settings,
      ...updates,
      crosshair: { ...this.settings.crosshair, ...updates.crosshair },
      cursor: { ...this.settings.cursor, ...updates.cursor },
      selection: { 
        ...this.settings.selection,
        ...updates.selection,
        window: { ...this.settings.selection.window, ...updates.selection?.window },
        crossing: { ...this.settings.selection.crossing, ...updates.selection?.crossing }
      },
      behavior: { ...this.settings.behavior, ...updates.behavior },
      performance: { ...this.settings.performance, ...updates.performance }
    };
    
    this.saveSettings();
    this.notifyListeners(this.settings);
  }

  resetToDefaults(): void {
    this.settings = { ...DEFAULT_CURSOR_SETTINGS };
    this.saveSettings();
    this.notifyListeners(this.settings);
  }

  // Override notifyListeners to include legacy compatibility
  protected notifyListeners(settings: CursorSettings): void {
    super.notifyListeners(settings);
    
    // Legacy compatibility - dispatch global event
    window.dispatchEvent(new CustomEvent('autocad-cursor-change', {
      detail: settings
    }));
  }

  // Storage operations
  private loadSettings(): CursorSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // 🔧 MIGRATION: Force enable crosshair if it was disabled in old settings
        // This ensures crosshair is visible after refactoring changes
        const shouldMigrateCrosshair = parsed.crosshair && parsed.crosshair.enabled === false;

        const migratedSettings = {
          ...DEFAULT_CURSOR_SETTINGS,
          ...parsed,
          crosshair: {
            ...DEFAULT_CURSOR_SETTINGS.crosshair,
            ...parsed.crosshair,
            // 🎯 MIGRATION: Force enable crosshair to fix "ΧΑΘΗΚΕ ΤΟ ΣΤΑΥΡΟΝΗΜΑ" issue
            enabled: shouldMigrateCrosshair ? true : (parsed.crosshair?.enabled ?? DEFAULT_CURSOR_SETTINGS.crosshair.enabled),
            line_style: parsed.crosshair?.line_style || DEFAULT_CURSOR_SETTINGS.crosshair.line_style
          },
          cursor: { ...DEFAULT_CURSOR_SETTINGS.cursor, ...parsed.cursor },
          selection: {
            window: {
              ...DEFAULT_CURSOR_SETTINGS.selection.window,
              ...parsed.selection?.window,
              // Migration για νέα fields
              fillOpacity: parsed.selection?.window?.fillOpacity ?? parsed.selection?.window?.opacity ?? DEFAULT_CURSOR_SETTINGS.selection.window.fillOpacity,
              borderOpacity: parsed.selection?.window?.borderOpacity ?? DEFAULT_CURSOR_SETTINGS.selection.window.borderOpacity,
              borderStyle: parsed.selection?.window?.borderStyle || DEFAULT_CURSOR_SETTINGS.selection.window.borderStyle,
              borderWidth: parsed.selection?.window?.borderWidth ?? DEFAULT_CURSOR_SETTINGS.selection.window.borderWidth
            },
            crossing: {
              ...DEFAULT_CURSOR_SETTINGS.selection.crossing,
              ...parsed.selection?.crossing,
              // Migration για νέα fields
              fillOpacity: parsed.selection?.crossing?.fillOpacity ?? parsed.selection?.crossing?.opacity ?? DEFAULT_CURSOR_SETTINGS.selection.crossing.fillOpacity,
              borderOpacity: parsed.selection?.crossing?.borderOpacity ?? DEFAULT_CURSOR_SETTINGS.selection.crossing.borderOpacity,
              borderStyle: parsed.selection?.crossing?.borderStyle || DEFAULT_CURSOR_SETTINGS.selection.crossing.borderStyle,
              borderWidth: parsed.selection?.crossing?.borderWidth ?? DEFAULT_CURSOR_SETTINGS.selection.crossing.borderWidth
            }
          },
          behavior: { ...DEFAULT_CURSOR_SETTINGS.behavior, ...parsed.behavior },
          performance: { ...DEFAULT_CURSOR_SETTINGS.performance, ...parsed.performance }
        };

        // 🔧 AUTO-SAVE: If migration occurred, save the updated settings immediately
        if (shouldMigrateCrosshair) {
          console.log('🎯 [CursorConfig] Migrating crosshair settings: enabled=true');
          // Save the migrated settings to localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedSettings));
          } catch (error) {
            console.warn('Failed to save migrated cursor settings:', error);
          }
        }

        return migratedSettings;
      }
    } catch (error) {
      console.warn('Failed to load cursor settings:', error);
    }
    return { ...DEFAULT_CURSOR_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save cursor settings:', error);
    }
  }
}

// ===== SINGLETON INSTANCE =====
export const cursorConfig = CursorConfiguration.getInstance();

// ===== UTILITY FUNCTIONS =====
export function getCursorSettings(): CursorSettings {
  return cursorConfig.getSettings();
}

export function updateCursorSettings(updates: Partial<CursorSettings>): void {
  cursorConfig.updateSettings(updates);
}

export function subscribeToCursorSettings(
  listener: (settings: CursorSettings) => void
): () => void {
  return cursorConfig.subscribe(listener);
}

export function resetCursorSettings(): void {
  cursorConfig.resetToDefaults();
}

// Legacy compatibility exports
export { CursorConfiguration as CAD_UI_CURSOR };