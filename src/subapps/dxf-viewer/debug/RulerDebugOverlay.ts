/**
 * 🛠️ RULER DEBUG OVERLAY - ENTERPRISE TESTING SYSTEM
 * Professional ruler calibration, alignment verification, and testing
 * Follows AutoCAD/Rhino/SolidWorks enterprise testing standards
 */

import type { RulerDebugSettings, RulerDebugMode } from './RulerDebugTypes';
import { DEFAULT_RULER_DEBUG_SETTINGS } from './RulerDebugTypes';

/**
 * 🛠️ RULER DEBUG OVERLAY
 * Global singleton για ruler debugging and verification
 */
export class RulerDebugOverlay {
  private settings: RulerDebugSettings;

  constructor(settings: RulerDebugSettings = DEFAULT_RULER_DEBUG_SETTINGS) {
    // Load persisted state from localStorage
    const persistedEnabled = this.loadPersistedState();
    this.settings = {
      ...settings,
      enabled: persistedEnabled ?? settings.enabled
    };
  }

  /**
   * 🎯 LOAD PERSISTED STATE
   */
  private loadPersistedState(): boolean | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('debug.rulerDebug.enabled');
      return stored !== null ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * 🎯 SAVE PERSISTED STATE
   */
  private savePersistedState(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('debug.rulerDebug.enabled', JSON.stringify(enabled));
    } catch (error) {
      console.warn('Failed to persist ruler debug state:', error);
    }
  }

  /**
   * 🎯 TOGGLE RULER DEBUG
   */
  toggle(): boolean {
    this.settings.enabled = !this.settings.enabled;
    this.savePersistedState(this.settings.enabled);
    console.log(`🛠️ Ruler Debug: ${this.settings.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    return this.settings.enabled;
  }

  /**
   * 🎯 SET ENABLED STATE
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.savePersistedState(enabled);
    console.log(`🛠️ Ruler Debug: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
  }

  /**
   * 🎯 SET DEBUG MODE
   */
  setMode(mode: RulerDebugMode): void {
    this.settings.mode = mode;
    console.log(`🛠️ Ruler Debug Mode: ${mode}`);
  }

  /**
   * 🎯 ENABLE SPECIFIC FEATURE
   */
  enableFeature(feature: 'tickMarkers' | 'calibrationGrid' | 'alignmentVerification'): void {
    this.settings[feature].enabled = true;
    console.log(`🛠️ Ruler Debug: ${feature} ENABLED ✅`);
  }

  /**
   * 🎯 DISABLE SPECIFIC FEATURE
   */
  disableFeature(feature: 'tickMarkers' | 'calibrationGrid' | 'alignmentVerification'): void {
    this.settings[feature].enabled = false;
    console.log(`🛠️ Ruler Debug: ${feature} DISABLED ❌`);
  }

  /**
   * 🎯 GET STATUS
   */
  getStatus(): {
    enabled: boolean;
    mode: RulerDebugMode;
    settings: RulerDebugSettings;
    features: {
      tickMarkers: boolean;
      calibrationGrid: boolean;
      alignmentVerification: boolean;
    };
  } {
    return {
      enabled: this.settings.enabled,
      mode: this.settings.mode,
      settings: this.settings,
      features: {
        tickMarkers: this.settings.tickMarkers.enabled,
        calibrationGrid: this.settings.calibrationGrid.enabled,
        alignmentVerification: this.settings.alignmentVerification.enabled
      }
    };
  }

  /**
   * 🎯 GET SETTINGS
   */
  getSettings(): RulerDebugSettings {
    return this.settings;
  }

  /**
   * 🎯 UPDATE SETTINGS
   */
  updateSettings(updates: Partial<RulerDebugSettings>): void {
    this.settings = {
      ...this.settings,
      ...updates
    };
  }

  /**
   * 🎯 RESET TO DEFAULTS
   */
  reset(): void {
    this.settings = { ...DEFAULT_RULER_DEBUG_SETTINGS };
    this.savePersistedState(false);
    console.log('🛠️ Ruler Debug: Reset to defaults');
  }

  /**
   * 🎯 GET DIAGNOSTIC INFO
   */
  getDiagnostics(): string {
    const status = this.getStatus();
    return `
🛠️ RULER DEBUG OVERLAY - ENTERPRISE TESTING SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: ${status.enabled ? '✅ ENABLED' : '❌ DISABLED'}
Mode: ${status.mode.toUpperCase()}

Features:
  🎯 Tick Markers: ${status.features.tickMarkers ? '✅' : '❌'}
  📐 Calibration Grid: ${status.features.calibrationGrid ? '✅' : '❌'}
  🔍 Alignment Verification: ${status.features.alignmentVerification ? '✅' : '❌'}

Configuration:
  Show Coordinates: ${this.settings.showCoordinates ? '✅' : '❌'}
  Show Zoom Level: ${this.settings.showZoomLevel ? '✅' : '❌'}
  Show Tick Info: ${this.settings.showTickInfo ? '✅' : '❌'}
  Highlight Origin: ${this.settings.highlightOrigin ? '✅' : '❌'}

Tick Markers:
  Major: ${this.settings.tickMarkers.majorTickColor} (${this.settings.tickMarkers.majorTickSize}px)
  Minor: ${this.settings.tickMarkers.minorTickColor} (${this.settings.tickMarkers.minorTickSize}px)
  Opacity: ${this.settings.tickMarkers.opacity}

Calibration Grid:
  Spacing: ${this.settings.calibrationGrid.gridSpacing}mm
  Color: ${this.settings.calibrationGrid.lineColor}
  Opacity: ${this.settings.calibrationGrid.opacity}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}

/**
 * 🎯 GLOBAL SINGLETON INSTANCE
 * Accessible from anywhere in the application
 */
export const rulerDebugOverlay = new RulerDebugOverlay();

/**
 * 🎯 ATTACH TO WINDOW (for debugging from console)
 */
if (typeof window !== 'undefined') {
  (window as any).rulerDebugOverlay = rulerDebugOverlay;
  console.log('🛠️ Ruler Debug Overlay attached to window.rulerDebugOverlay');
}
