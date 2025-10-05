/**
 * CURSOR SYSTEM CONFIGURATION
 * Centralized cursor settings and AutoCAD-style behavior management
 */

import { BaseConfigurationManager } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { Point2D, Viewport } from '../../rendering/types/Types';

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
  
  // Cursor appearance (pickbox/aperture) - 🔺 ΑΥΤΟΝΟΜΕΣ ΡΥΘΜΙΣΕΙΣ
  cursor: {
    enabled: boolean;
    shape: 'circle' | 'square';     // σχήμα κέρσορα
    size: number;                   // μέγεθος σε pixels
    color: string;                  // χρώμα περιγράμματος (ΔΙΑΦΟΡΕΤΙΚΟ ΑΠΟ CROSSHAIR)
    line_style: 'solid' | 'dashed' | 'dotted' | 'dash-dot'; // στυλ γραμμής περιγράμματος
    line_width: number;             // πάχος γραμμής σε pixels (ΑΥΤΟΝΟΜΗ ΡΥΘΜΙΣΗ)
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
  // ✅ MOUSE POSITION TRACKING (κεντρικό για όλα τα UI elements)
  position: Point2D | null;          // Screen coordinates (for crosshair, cursor, etc.)
  worldPosition: Point2D | null;     // World coordinates (for CAD operations)
  viewport: Viewport;                // Current viewport

  // ✅ MOUSE BUTTON STATE (for professional CAD interactions)
  isDown: boolean;                   // Any mouse button down
  button: number;                    // Which button (0=left, 1=middle, 2=right)

  // ✅ CAD-SPECIFIC STATE
  isActive: boolean;                 // Mouse is in canvas area
  tool: string;                      // Current CAD tool
  snapPoint: Point2D | null;         // Current snap target

  // ✅ SELECTION STATE (for CAD selection operations)
  isSelecting: boolean;              // Selection operation in progress
  selectionStart: Point2D | null;    // Selection box start
  selectionCurrent: Point2D | null;  // Current selection position
}

// ===== DEFAULT AUTOCAD-STYLE CONFIGURATION =====
export const DEFAULT_CURSOR_SETTINGS: CursorSettings = {
  crosshair: {
    enabled: true,             // 🔺 ALWAYS TRUE - το crosshair πάντα ενεργοποιημένο
    size_percent: 25,          // 🔺 BIGGER: Αυξημένο μέγεθος για καλύτερη ορατότητα
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
    color: '#00FF80',          // 🔺 ΔΙΑΦΟΡΕΤΙΚΟ ΧΡΩΜΑ ΑΠΟ CROSSHAIR - πράσινο για αυτονομία
    line_style: 'solid',       // συνεχόμενη γραμμή
    line_width: 1,             // 🔺 ΑΥΤΟΝΟΜΗ ΡΥΘΜΙΣΗ - πάχος γραμμής κέρσορα
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
  private isSyncingFromProvider: boolean = false; // 🔄 Flag για αποφυγή loops

  private constructor() {
    super();
    this.settings = this.loadSettings();
    this.setupUnifiedSyncListener();
  }

  /**
   * 🔄 BIDIRECTIONAL SYNC: Event listener για sync από DxfSettingsProvider
   */
  private setupUnifiedSyncListener(): void {
    if (typeof window !== 'undefined') {
      const handleProviderSync = (event: CustomEvent) => {
        const { cursorSettings, source, timestamp } = event.detail;

        // Ενημέρωση local settings χωρίς trigger save (για αποφυγή loop)
        this.isSyncingFromProvider = true;
        this.settings = { ...cursorSettings };
        this.notifyListeners(this.settings);

        // Reset flag μετά από σύντομο διάστημα
        setTimeout(() => {
          this.isSyncingFromProvider = false;
        }, 100);
      };

      window.addEventListener('dxf-provider-cursor-sync', handleProviderSync as EventListener);

    }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('autocad-cursor-change', {
        detail: settings
      }));
    }
  }

  // Storage operations
  private loadSettings(): CursorSettings {
    try {
      // 🔒 SSR PROTECTION: localStorage is only available in browser
      if (typeof window === 'undefined') {
        return { ...DEFAULT_CURSOR_SETTINGS };
      }

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
            // 🔺 FIXED: Crosshair ΠΑΝΤΑ ενεργοποιημένο - αγνοεί την παλιά τιμή enabled
            enabled: true, // FORCED TO TRUE - το crosshair πάντα on
            line_style: parsed.crosshair?.line_style || DEFAULT_CURSOR_SETTINGS.crosshair.line_style
          },
          cursor: {
            ...DEFAULT_CURSOR_SETTINGS.cursor,
            ...parsed.cursor,
            // 🔺 MIGRATION: Αυτόνομες ρυθμίσεις κέρσορα
            line_width: parsed.cursor?.line_width ?? DEFAULT_CURSOR_SETTINGS.cursor.line_width
          },
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

          // Save the migrated settings to localStorage
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedSettings));
            }
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
    // 🔄 SKIP SAVE: Αν συγχρονίζουμε από provider, δεν κάνουμε save
    if (this.isSyncingFromProvider) {

      return;
    }

    try {
      // 🆕 UNIFIED AUTOSAVE: Χρήση του κεντρικοποιημένου autosave system
      // Αντί για direct localStorage, χρησιμοποιούμε το DxfSettingsProvider
      this.delegateToUnifiedAutosave();
    } catch (error) {
      console.warn('Failed to save cursor settings:', error);
      // 🔄 FALLBACK: Αν αποτύχει το unified system, χρησιμοποιούμε το παλιό
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        }
      } catch (fallbackError) {
        console.error('❌ [CursorSystem] Both unified and fallback saves failed:', fallbackError);
      }
    }
  }

  /**
   * 🔄 UNIFIED INTEGRATION: Ενσωμάτωση με το DxfSettingsProvider
   * Χρησιμοποιεί το unified autosave system με debounced saves
   */
  private delegateToUnifiedAutosave(): void {
    // Βρίσκουμε το DxfSettingsProvider context μέσω του DOM/React
    const dxfSettingsEvent = new CustomEvent('dxf-cursor-settings-update', {
      detail: {
        cursorSettings: this.settings,
        source: 'CursorConfiguration',
        timestamp: Date.now()
      }
    });

    // Dispatch το event για το DxfSettingsProvider να το πιάσει
    if (typeof window !== 'undefined') {
      window.dispatchEvent(dxfSettingsEvent);

    }
  }
}

// ===== SINGLETON INSTANCE =====
// 🔒 SSR PROTECTION: Only initialize in browser environment
export const cursorConfig = typeof window !== 'undefined'
  ? CursorConfiguration.getInstance()
  : null as unknown as CursorConfiguration; // Type assertion for SSR compatibility

// ===== UTILITY FUNCTIONS =====
export function getCursorSettings(): CursorSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_CURSOR_SETTINGS };
  }
  return cursorConfig.getSettings();
}

export function updateCursorSettings(updates: Partial<CursorSettings>): void {
  if (typeof window === 'undefined') return;
  cursorConfig.updateSettings(updates);
}

export function subscribeToCursorSettings(
  listener: (settings: CursorSettings) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op unsubscribe for SSR
  }
  return cursorConfig.subscribe(listener);
}

export function resetCursorSettings(): void {
  if (typeof window === 'undefined') return;
  cursorConfig.resetToDefaults();
}

// Legacy compatibility exports
export { CursorConfiguration as CAD_UI_CURSOR };