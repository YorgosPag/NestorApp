/**
 * CURSOR SYSTEM CONFIGURATION
 * Centralized cursor settings and AutoCAD-style behavior management
 */

import { BaseConfigurationManager } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { Point2D, Viewport } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-092: Centralized localStorage Service
import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage-utils';
// 🏢 ADR-030: UnifiedFrameScheduler — flag every canvas overlay dirty when
// cursor/crosshair/selection settings change so they repaint on the next RAF
// tick instead of waiting for a mouse move.
import { markAllCanvasDirty } from '../../rendering/core/frame-scheduler-api';
// 🏢 ADR-XXX UserSettings SSoT — Firestore-backed industry pattern.
// Cursor settings persist to user_preferences/{userId}_{companyId}, sync
// across devices, schema-validated. localStorage is used only as boot-time
// cache (instant first paint) and for one-shot legacy migration.
import { userSettingsRepository } from '../../../../services/user-settings';
import type { CursorSettingsSlice } from '../../../../services/user-settings';

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
    color: UI_COLORS.WHITE,
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
    color: UI_COLORS.SUCCESS_BRIGHT,          // 🔺 ΔΙΑΦΟΡΕΤΙΚΟ ΧΡΩΜΑ ΑΠΟ CROSSHAIR - πράσινο για αυτονομία
    line_style: 'solid',       // συνεχόμενη γραμμή
    line_width: 1,             // 🔺 ΑΥΤΟΝΟΜΗ ΡΥΘΜΙΣΗ - πάχος γραμμής κέρσορα
    opacity: 0.9               // 90% διαφάνεια
  },
  
  selection: {
    window: {
      fillColor: UI_COLORS.BLUE_DEFAULT,    // AutoCAD μπλε
      fillOpacity: 0.2,        // διαφάνεια γεμίσματος
      borderColor: UI_COLORS.BLUE_DEFAULT,
      borderOpacity: 1.0,      // συμπαγές περίγραμμα
      borderStyle: 'solid',
      borderWidth: 2           // πάχος γραμμής 2px
    },
    crossing: {
      fillColor: UI_COLORS.SUCCESS_BRIGHT,    // AutoCAD πράσινο
      fillOpacity: 0.2,        // διαφάνεια γεμίσματος
      borderColor: UI_COLORS.SUCCESS_BRIGHT,
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
// 🏢 ADR-092: Using centralized STORAGE_KEYS registry

export class CursorConfiguration extends BaseConfigurationManager<CursorSettings> {
  private static instance: CursorConfiguration;
  private settings: CursorSettings;
  private isSyncingFromProvider: boolean = false; // 🔄 Flag για αποφυγή loops
  // ─── UserSettings repository binding state ───────────────────────────────
  // The repository becomes the SSoT once auth is ready and `bindToRepository`
  // is called. Until then, `loadSettings()` (localStorage) provides the boot
  // value. Once bound, every subsequent local change writes to the repository
  // and remote changes hydrate this.settings + notifyListeners().
  private repositoryBound: boolean = false;
  private repositoryUnsubscribe: (() => void) | null = null;
  private isHydratingFromRepository: boolean = false;

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

  // ─── Repository binding (UserSettings SSoT) ────────────────────────────
  /**
   * Bind to `userSettingsRepository` for the active user/tenant. Called from
   * `CursorSystem` provider once `useAuth().user` resolves. On the first
   * Firestore snapshot we hydrate `this.settings` (overwriting the localStorage
   * boot value); if no document exists yet, the current local value is written
   * back so the user's first session creates the doc with their migrated prefs.
   */
  bindToRepository(userId: string, companyId: string): void {
    if (this.repositoryBound) return;
    this.repositoryBound = true;

    userSettingsRepository.bind(userId, companyId);

    let firstSnapshot = true;
    this.repositoryUnsubscribe = userSettingsRepository.subscribeSlice(
      'dxfViewer.cursor',
      (remoteSettings) => {
        if (remoteSettings) {
          // Remote (or own debounced write) → hydrate local state without
          // re-firing saveSettings (avoid feedback loop).
          this.isHydratingFromRepository = true;
          this.settings = remoteSettings as CursorSettings;
          this.notifyListeners(this.settings);
          this.isHydratingFromRepository = false;
        } else if (firstSnapshot) {
          // Doc empty / first session for this (user, tenant) — push the
          // current localStorage-derived settings up to Firestore so the
          // doc materializes with the user's existing preferences.
          userSettingsRepository.updateSlice('dxfViewer.cursor', this.settings);
        }
        firstSnapshot = false;
      },
    );
  }

  /** Tear down the repository subscription. Called on auth change / logout. */
  unbindFromRepository(): void {
    if (this.repositoryUnsubscribe) {
      this.repositoryUnsubscribe();
      this.repositoryUnsubscribe = null;
    }
    this.repositoryBound = false;
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

    // 🏢 ADR-030 SSoT: settings change → all canvas overlays must repaint.
    // Single source covering every entry point (panel updateSettings, reset,
    // provider sync). Without this, overlays only redraw on mouse move.
    markAllCanvasDirty();

    // Legacy compatibility - dispatch global event
    window.dispatchEvent(new CustomEvent('autocad-cursor-change', {
      detail: settings
    }));
  }

  // Storage operations
  // 🏢 ADR-092: Using centralized storage-utils (SSR-safe)
  private loadSettings(): CursorSettings {
    // storageGet handles SSR check internally
    const stored = storageGet<CursorSettings | null>(STORAGE_KEYS.CURSOR_SETTINGS, null);

    if (stored) {
      const parsed = stored;

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
              // Migration για νέα fields (cast to access legacy 'opacity' property)
              fillOpacity: parsed.selection?.window?.fillOpacity ?? (parsed.selection?.window as { opacity?: number } | undefined)?.opacity ?? DEFAULT_CURSOR_SETTINGS.selection.window.fillOpacity,
              borderOpacity: parsed.selection?.window?.borderOpacity ?? DEFAULT_CURSOR_SETTINGS.selection.window.borderOpacity,
              borderStyle: parsed.selection?.window?.borderStyle || DEFAULT_CURSOR_SETTINGS.selection.window.borderStyle,
              borderWidth: parsed.selection?.window?.borderWidth ?? DEFAULT_CURSOR_SETTINGS.selection.window.borderWidth
            },
            crossing: {
              ...DEFAULT_CURSOR_SETTINGS.selection.crossing,
              ...parsed.selection?.crossing,
              // Migration για νέα fields (cast to access legacy 'opacity' property)
              fillOpacity: parsed.selection?.crossing?.fillOpacity ?? (parsed.selection?.crossing as { opacity?: number } | undefined)?.opacity ?? DEFAULT_CURSOR_SETTINGS.selection.crossing.fillOpacity,
              borderOpacity: parsed.selection?.crossing?.borderOpacity ?? DEFAULT_CURSOR_SETTINGS.selection.crossing.borderOpacity,
              borderStyle: parsed.selection?.crossing?.borderStyle || DEFAULT_CURSOR_SETTINGS.selection.crossing.borderStyle,
              borderWidth: parsed.selection?.crossing?.borderWidth ?? DEFAULT_CURSOR_SETTINGS.selection.crossing.borderWidth
            }
          },
          behavior: { ...DEFAULT_CURSOR_SETTINGS.behavior, ...parsed.behavior },
          performance: { ...DEFAULT_CURSOR_SETTINGS.performance, ...parsed.performance }
        };

        // 🔧 AUTO-SAVE: If migration occurred, save the updated settings immediately
        // 🏢 ADR-092: Using centralized storageSet
        if (shouldMigrateCrosshair) {
          storageSet(STORAGE_KEYS.CURSOR_SETTINGS, migratedSettings);
        }

        return migratedSettings;
      }

    return { ...DEFAULT_CURSOR_SETTINGS };
  }

  private saveSettings(): void {
    // 🔄 SKIP SAVE: Αν συγχρονίζουμε από provider, δεν κάνουμε save
    if (this.isSyncingFromProvider || this.isHydratingFromRepository) {
      return;
    }

    // 🏢 PRIMARY PATH (UserSettings SSoT): once the repository is bound,
    // it owns persistence (debounced 500ms autosave to Firestore + IndexedDB
    // cache + cross-device sync + schema validation + audit trail).
    if (this.repositoryBound) {
      userSettingsRepository.updateSlice('dxfViewer.cursor', this.settings);
    }

    // 🔄 BOOT-CACHE: also mirror to localStorage so the next page reload has
    // an instant warm value before auth resolves. The repository takes over
    // on first snapshot and overrides this value if newer.
    storageSet(STORAGE_KEYS.CURSOR_SETTINGS, this.settings);
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