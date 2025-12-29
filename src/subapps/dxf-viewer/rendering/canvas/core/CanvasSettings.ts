/**
 * CANVAS SETTINGS - Unified settings management
 * ✅ ΦΑΣΗ 7: Centralized settings για όλα τα canvas instances
 */

import { UI_COLORS } from '../../../config/color-config';

import type { CrosshairSettings } from '../../ui/crosshair/CrosshairTypes';
import type { UICursorSettings } from '../../ui/cursor/CursorTypes';
import type { SnapSettings } from '../../ui/snap/SnapTypes';
import type { GridSettings } from '../../ui/grid/GridTypes';
import type { RulerSettings } from '../../ui/ruler/RulerTypes';
import type { SelectionSettings } from '../../../canvas-v2/layer-canvas/layer-types';

export interface CanvasRenderSettings {
  // UI Element settings
  crosshair: CrosshairSettings;
  cursor: UICursorSettings;
  snap: SnapSettings;
  grid: GridSettings;
  rulers: RulerSettings;
  selection: SelectionSettings;

  // Canvas-specific settings
  enableHiDPI: boolean;
  devicePixelRatio: number;
  imageSmoothingEnabled: boolean;
  backgroundColor: string;

  // Performance settings
  enableBatching: boolean;
  enableCaching: boolean;
  enableMetrics: boolean;
  maxCacheSize: number;

  // Feature flags
  useUnifiedRendering: boolean;
  enableCoordination: boolean;
  debugMode: boolean;
}

export interface CanvasDisplayOptions {
  showCrosshair: boolean;
  showCursor: boolean;
  showSnapIndicators: boolean;
  showGrid: boolean;
  showRulers: boolean;
  showSelectionBox: boolean;
}

export interface CanvasValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 🔺 UNIFIED CANVAS SETTINGS MANAGER
 * Central coordinator για όλες τις canvas settings
 * Αντικαθιστά scattered settings management
 */
export class CanvasSettings {
  private settings: CanvasRenderSettings;
  private displayOptions: CanvasDisplayOptions;
  private validators: Map<string, (value: unknown) => boolean> = new Map();
  private changeListeners: Set<(settings: CanvasRenderSettings) => void> = new Set();

  constructor(initialSettings?: Partial<CanvasRenderSettings>) {
    this.settings = {
      // Default UI settings
      crosshair: {
        enabled: true,
        visible: true,
        color: UI_COLORS.BRIGHT_GREEN,
        lineWidth: 1,
        length: 20,
        gap: 5,
        opacity: 1.0,
        zIndex: 1000
      },
      cursor: {
        enabled: true,
        visible: true,
        shape: 'cross', // ✅ ENTERPRISE: Use valid CursorShape type ('cross' instead of 'crosshair')
        size: 16,
        color: UI_COLORS.WHITE,
        strokeColor: UI_COLORS.BLACK,
        strokeWidth: 1,
        opacity: 1.0,
        zIndex: 1001
      },
      snap: {
        enabled: true,
        tolerance: 10,
        types: ['endpoint', 'midpoint', 'intersection'],
        color: UI_COLORS.BRIGHT_YELLOW,
        size: 8,
        opacity: 1.0,
        zIndex: 900
      },
      grid: {
        enabled: true,
        visible: true,
        spacing: 20,
        color: UI_COLORS.LIGHT_GRAY,
        opacity: 0.5,
        pattern: 'lines',
        zIndex: 1
      },
      rulers: {
        enabled: true,
        visible: true,
        color: UI_COLORS.MEDIUM_GRAY,
        backgroundColor: UI_COLORS.LIGHT_GRAY_ALT,
        textColor: UI_COLORS.DARK_BACKGROUND,
        fontSize: 12,
        height: 30,
        width: 30,
        zIndex: 100
      },
      selection: {
        window: {
          fillColor: UI_COLORS.BUTTON_PRIMARY,
          fillOpacity: 0.1,
          borderColor: UI_COLORS.BUTTON_PRIMARY,
          borderOpacity: 0.8,
          borderStyle: 'solid',
          borderWidth: 1
        },
        crossing: {
          fillColor: UI_COLORS.SUCCESS,
          fillOpacity: 0.1,
          borderColor: UI_COLORS.SUCCESS,
          borderOpacity: 0.8,
          borderStyle: 'dashed',
          borderWidth: 1
        }
      },

      // Canvas settings
      enableHiDPI: true,
      devicePixelRatio: window.devicePixelRatio || 1,
      imageSmoothingEnabled: true,
      backgroundColor: 'transparent',

      // Performance settings
      enableBatching: true,
      enableCaching: true,
      enableMetrics: false,
      maxCacheSize: 100,

      // Feature flags
      useUnifiedRendering: true, // ✅ ENABLED: Use unified rendering path (fixes ruler tick alignment)
      enableCoordination: true,
      debugMode: false,

      ...initialSettings
    };

    this.displayOptions = {
      showCrosshair: true,
      showCursor: true,
      showSnapIndicators: true,
      showGrid: true,
      showRulers: true,
      showSelectionBox: false
    };

    this.setupValidators();
  }

  /**
   * Get current settings
   */
  getSettings(): CanvasRenderSettings {
    return { ...this.settings };
  }

  /**
   * Get display options
   */
  getDisplayOptions(): CanvasDisplayOptions {
    return { ...this.displayOptions };
  }

  /**
   * Update settings με validation
   */
  updateSettings(updates: Partial<CanvasRenderSettings>): CanvasValidationResult {
    const validation = this.validateSettings(updates);

    if (validation.isValid) {
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...updates };

      // Notify change listeners
      this.changeListeners.forEach(listener => {
        try {
          listener(this.settings);
        } catch (error) {
          console.error('Settings change listener error:', error);
        }
      });

      return validation;
    }

    return validation;
  }

  /**
   * Update display options
   */
  updateDisplayOptions(updates: Partial<CanvasDisplayOptions>): void {
    this.displayOptions = { ...this.displayOptions, ...updates };
  }

  /**
   * Get specific setting by path
   */
  getSetting<T = unknown>(path: string): T | undefined {
    const keys = path.split('.');
    let current: unknown = this.settings;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Update specific setting by path
   */
  updateSetting(path: string, value: unknown): CanvasValidationResult {
    const keys = path.split('.');
    const updates: Record<string, unknown> = {};
    let current = updates;

    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    return this.updateSettings(updates);
  }

  /**
   * Subscribe to settings changes
   */
  subscribeToChanges(listener: (settings: CanvasRenderSettings) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Enable/disable unified rendering
   */
  enableUnifiedRendering(enabled: boolean = true): void {
    this.updateSettings({ useUnifiedRendering: enabled });
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.updateSettings({ debugMode: enabled });
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    const defaultSettings = new CanvasSettings();
    this.settings = defaultSettings.getSettings();
  }

  /**
   * Validate settings updates
   */
  private validateSettings(updates: Partial<CanvasRenderSettings>): CanvasValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each updated property
    Object.entries(updates).forEach(([key, value]) => {
      const validator = this.validators.get(key);
      if (validator && !validator(value)) {
        errors.push(`Invalid value for ${key}: ${value}`);
      }
    });

    // Custom validation rules
    if (updates.devicePixelRatio !== undefined && updates.devicePixelRatio <= 0) {
      errors.push('devicePixelRatio must be positive');
    }

    if (updates.maxCacheSize !== undefined && updates.maxCacheSize < 0) {
      errors.push('maxCacheSize cannot be negative');
    }

    // Performance warnings
    if (updates.enableHiDPI && updates.devicePixelRatio && updates.devicePixelRatio > 2) {
      warnings.push('High DPI ratio may impact performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Setup validation functions
   */
  private setupValidators(): void {
    this.validators.set('enableHiDPI', (value) => typeof value === 'boolean');
    this.validators.set('devicePixelRatio', (value) => typeof value === 'number' && value > 0);
    this.validators.set('imageSmoothingEnabled', (value) => typeof value === 'boolean');
    this.validators.set('backgroundColor', (value) => typeof value === 'string');
    this.validators.set('enableBatching', (value) => typeof value === 'boolean');
    this.validators.set('enableCaching', (value) => typeof value === 'boolean');
    this.validators.set('enableMetrics', (value) => typeof value === 'boolean');
    this.validators.set('maxCacheSize', (value) => typeof value === 'number' && value >= 0);
    this.validators.set('useUnifiedRendering', (value) => typeof value === 'boolean');
    this.validators.set('enableCoordination', (value) => typeof value === 'boolean');
    this.validators.set('debugMode', (value) => typeof value === 'boolean');
  }

  /**
   * Get settings as configuration object for specific canvas type
   */
  getCanvasConfig(canvasType: 'dxf' | 'layer' | 'overlay'): Record<string, unknown> {
    return {
      enableHiDPI: this.settings.enableHiDPI,
      devicePixelRatio: this.settings.devicePixelRatio,
      imageSmoothingEnabled: this.settings.imageSmoothingEnabled,
      backgroundColor: this.settings.backgroundColor
    };
  }

  /**
   * Export settings για persistence
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings από persistence
   */
  importSettings(settingsJson: string): CanvasValidationResult {
    try {
      const importedSettings = JSON.parse(settingsJson);
      return this.updateSettings(importedSettings);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Invalid JSON: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.changeListeners.clear();
    this.validators.clear();
  }
}