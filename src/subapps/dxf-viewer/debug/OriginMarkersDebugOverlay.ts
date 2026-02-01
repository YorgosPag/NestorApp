/**
 * 🛠️ DEBUG ORIGIN MARKERS OVERLAY
 * Debug-only overlay που εμφανίζει σταυρουδάκια στο (0,0) για debugging coordinate systems
 * Μπορεί να toggle on/off μέσω debug controls
 */

import type { Point2D, Viewport, ViewTransform } from '../rendering/types/Types';
// 🏢 ADR-119: Centralized Opacity Constants
import { UI_COLORS, OPACITY } from '../config/color-config';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../rendering/primitives/canvasPaths';
// 🏢 ADR-091: Centralized UI Fonts
import { UI_FONTS } from '../config/text-rendering-config';
// 🏢 ADR-092: Centralized localStorage Service
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage-utils';

export interface OriginMarkerDebugSettings {
  enabled: boolean;
  color: string;
  size: number;           // Pixel size του crosshair
  lineWidth: number;      // Πάχος γραμμών
  showCenter: boolean;    // Δείχνει μικρό κύκλο στο κέντρο
  centerRadius: number;   // Radius του center circle
  showLabel: boolean;     // Δείχνει "(0,0)" label
  opacity: number;        // Transparency για non-intrusive debugging
  showAxisLines: boolean; // 🎯 Δείχνει πλήρεις γραμμές αξόνων X και Y
  axisColor: string;      // Χρώμα για τις γραμμές αξόνων
  axisLineWidth: number;  // Πάχος γραμμών αξόνων
  axisOpacity: number;    // Transparency αξόνων
}

export const DEFAULT_DEBUG_ORIGIN_SETTINGS: OriginMarkerDebugSettings = {
  enabled: false,         // 🚫 OFF by default - debug only
  color: UI_COLORS.DEBUG_ORIGIN,       // Κόκκινο για καλύτερη ορατότητα
  size: 15,               // Μεγαλύτερο για debugging
  lineWidth: 2,           // Έντονες γραμμές
  showCenter: true,       // Center dot για ακρίβεια
  centerRadius: 3,        // Larger center dot
  showLabel: true,        // Debug label
  opacity: 0.8,          // Slightly transparent για μη παρεμβολή
  showAxisLines: true,    // 🎯 Δείχνει πλήρεις άξονες X,Y
  axisColor: UI_COLORS.DEBUG_ORIGIN,   // 🎯 MAGENTA για μέγιστη ορατότητα!
  axisLineWidth: 4,       // 🎯 ΠΑΧΥΤΕΡΕΣ γραμμές!
  axisOpacity: 1.0       // 🎯 100% OPACITY - μη διαφανείς!
};

/**
 * 🛠️ DEBUG ORIGIN MARKERS OVERLAY
 * Standalone debug overlay που μπορεί να τοποθετηθεί πάνω από οποιοδήποτε canvas
 */
export class OriginMarkersDebugOverlay {
  private settings: OriginMarkerDebugSettings;
  private canvases: HTMLCanvasElement[] = [];

  constructor(settings: OriginMarkerDebugSettings = DEFAULT_DEBUG_ORIGIN_SETTINGS) {
    // Load persisted state from localStorage
    const persistedEnabled = this.loadPersistedState();
    this.settings = {
      ...settings,
      enabled: persistedEnabled ?? settings.enabled
    };
  }

  /**
   * 🎯 LOAD PERSISTED STATE
   * 🏢 ADR-092: Uses centralized storage service
   */
  private loadPersistedState(): boolean | null {
    return storageGet<boolean | null>(STORAGE_KEYS.DEBUG_ORIGIN_MARKERS, null);
  }

  /**
   * 🎯 SAVE PERSISTED STATE
   * 🏢 ADR-092: Uses centralized storage service
   */
  private savePersistedState(enabled: boolean): void {
    storageSet(STORAGE_KEYS.DEBUG_ORIGIN_MARKERS, enabled);
  }

  /**
   * 🎯 TOGGLE DEBUG MARKERS
   * Enable/disable τα origin markers με persistence
   */
  toggle(): boolean {
    this.settings.enabled = !this.settings.enabled;
    this.savePersistedState(this.settings.enabled);
    console.log(`🛠️ Origin Markers Debug: ${this.settings.enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.settings.enabled;
  }

  /**
   * 🎯 SET ENABLED STATE
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.savePersistedState(enabled);
  }

  /**
   * 🎯 UPDATE SETTINGS
   */
  updateSettings(newSettings: Partial<OriginMarkerDebugSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * 🎯 REGISTER CANVAS για debug overlay
   * Προσθέτει canvas στη λίστα για automatic overlay rendering
   */
  registerCanvas(canvas: HTMLCanvasElement): void {
    if (!this.canvases.includes(canvas)) {
      this.canvases.push(canvas);
      console.log(`🛠️ Registered canvas for origin markers debug: ${canvas.dataset.canvasType || 'unknown'}`);
    }
  }

  /**
   * 🎯 UNREGISTER CANVAS
   */
  unregisterCanvas(canvas: HTMLCanvasElement): void {
    const index = this.canvases.indexOf(canvas);
    if (index !== -1) {
      this.canvases.splice(index, 1);
    }
  }

  /**
   * 🎯 RENDER DEBUG OVERLAY
   * Renders origin markers πάνω από τον specified canvas
   */
  renderOverlay(
    canvas: HTMLCanvasElement,
    transform: ViewTransform,
    viewport?: Viewport
  ): void {
    if (!this.settings.enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use canvas dimensions αν δεν έχουμε viewport
    const vp = viewport || {
      width: canvas.width,
      height: canvas.height
    };

    this.renderOriginMarker(ctx, vp, transform, this.settings);
  }

  /**
   * 🎯 RENDER ALL REGISTERED CANVASES
   * Convenience method για rendering σε όλα τα registered canvases
   */
  renderAllOverlays(transform: ViewTransform): void {
    if (!this.settings.enabled) return;

    for (const canvas of this.canvases) {
      const rect = canvas.getBoundingClientRect();
      const viewport: Viewport = {
        width: rect.width,
        height: rect.height
      };
      this.renderOverlay(canvas, transform, viewport);
    }
  }

  /**
   * 🎯 PRIVATE: RENDER ORIGIN MARKER
   * Core rendering logic για origin marker
   */
  private renderOriginMarker(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    transform: ViewTransform,
    settings: OriginMarkerDebugSettings
  ): void {
    // Calculate screen position of world origin (0,0)
    const originScreenX = transform.offsetX;
    const originScreenY = transform.offsetY;

    ctx.save();

    // 🎯 ALWAYS RENDER AXIS LINES (even if origin is off-screen)
    if (settings.showAxisLines) {
      console.log('🎯 RENDERING AXIS LINES!', {
        originScreenX,
        originScreenY,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        axisColor: settings.axisColor,
        axisLineWidth: settings.axisLineWidth,
        axisOpacity: settings.axisOpacity
      });

      ctx.globalAlpha = settings.axisOpacity;
      ctx.strokeStyle = settings.axisColor;
      ctx.lineWidth = settings.axisLineWidth;
      // 🎯 SOLID LINES για μέγιστη ορατότητα!

      ctx.beginPath();

      // X-Axis: Horizontal line across entire viewport (only if Y coord is visible)
      if (originScreenY >= 0 && originScreenY <= viewport.height) {
        console.log('🎯 Drawing X-axis at Y:', originScreenY);
        ctx.moveTo(0, originScreenY);
        ctx.lineTo(viewport.width, originScreenY);
      }

      // Y-Axis: Vertical line across entire viewport (only if X coord is visible)
      if (originScreenX >= 0 && originScreenX <= viewport.width) {
        console.log('🎯 Drawing Y-axis at X:', originScreenX);
        ctx.moveTo(originScreenX, 0);
        ctx.lineTo(originScreenX, viewport.height);
      }

      ctx.stroke();
      console.log('🎯 AXIS LINES STROKE CALLED!');

      // 🎯 DEBUG TEST: Σχεδιάζω ένα φωτεινό κόκκινο τετράγωνο στη γωνία
      ctx.fillStyle = UI_COLORS.DEBUG_ORIGIN;
      ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
      ctx.fillRect(10, 10, 50, 50);
      console.log('🎯 TEST RECTANGLE DRAWN!');

      // 🎯 AXIS LABELS (only if lines are visible)
      if (settings.showLabel) {
        ctx.fillStyle = settings.axisColor;
        ctx.font = UI_FONTS.MONOSPACE.LARGE;

        // X-Axis label (only if horizontal line is visible)
        if (originScreenY >= 0 && originScreenY <= viewport.height) {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText('X', viewport.width - 10, originScreenY - 5);
        }

        // Y-Axis label (only if vertical line is visible)
        if (originScreenX >= 0 && originScreenX <= viewport.width) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('Y', originScreenX + 5, 10);
        }
      }
    }

    // Check if origin crosshair should be visible
    const margin = settings.size + 50; // Extra margin για label
    if (originScreenX < -margin || originScreenX > viewport.width + margin ||
        originScreenY < -margin || originScreenY > viewport.height + margin) {
      ctx.restore();
      return; // Origin crosshair is not visible, but axis lines were already drawn
    }


    // 🎯 RENDER ORIGIN CROSSHAIR (on top of axis lines)
    ctx.globalAlpha = settings.opacity;
    ctx.strokeStyle = settings.color;
    ctx.lineWidth = settings.lineWidth;

    ctx.beginPath();

    // Draw crosshair at origin
    const markerSize = settings.size;

    // Horizontal line
    ctx.moveTo(originScreenX - markerSize, originScreenY);
    ctx.lineTo(originScreenX + markerSize, originScreenY);

    // Vertical line
    ctx.moveTo(originScreenX, originScreenY - markerSize);
    ctx.lineTo(originScreenX, originScreenY + markerSize);

    ctx.stroke();

    // Center dot για ακρίβεια
    if (settings.showCenter) {
      ctx.beginPath();
      ctx.arc(originScreenX, originScreenY, settings.centerRadius, 0, TAU);
      ctx.fillStyle = settings.color;
      ctx.fill();
    }

    // Debug label
    if (settings.showLabel) {
      ctx.fillStyle = settings.color;
      ctx.font = UI_FONTS.MONOSPACE.NORMAL;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Position label below and to the right
      const labelX = originScreenX + markerSize + 5;
      const labelY = originScreenY + 5;

      ctx.fillText('(0,0)', labelX, labelY);

      // Additional debug info
      ctx.font = UI_FONTS.MONOSPACE.SMALL;
      ctx.fillText(`Screen: (${originScreenX.toFixed(1)}, ${originScreenY.toFixed(1)})`, labelX, labelY + 15);
    }

    // 🎯 ORIGIN LABEL ENHANCEMENT
    if (settings.showAxisLines && settings.showLabel) {
      ctx.fillStyle = settings.axisColor;
      ctx.font = UI_FONTS.MONOSPACE.LARGE;
      ctx.globalAlpha = settings.axisOpacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('O', originScreenX - markerSize - 15, originScreenY);
    }

    ctx.restore();
  }

  /**
   * 🎯 AUTO-DETECT CANVASES
   * Automatically finds και registers DXF canvases (prioritizes Layer Canvas for z-index)
   */
  autoDetectCanvases(): number {
    // 🎯 PRIORITY: Use Layer Canvas (top-most z-index) for debug overlays
    const layerCanvas = document.querySelector<HTMLCanvasElement>('canvas[data-canvas-type="layer"]');
    const dxfCanvases = document.querySelectorAll<HTMLCanvasElement>('canvas[data-canvas-type]');

    // Clear existing canvases first
    this.canvases = [];
    let registered = 0;

    // Priority 1: Layer canvas (top-most)
    if (layerCanvas) {
      this.registerCanvas(layerCanvas);
      registered++;
      console.log('🎯 Registered LAYER canvas (z-index: high) for debug overlays');
    }

    // Priority 2: Other canvases only if no layer canvas
    if (!layerCanvas) {
      dxfCanvases.forEach(canvas => {
        this.registerCanvas(canvas);
        registered++;
      });
    }

    console.log(`🛠️ Auto-detected and registered ${registered} canvases for origin markers debug`);
    console.log('🎯 Target canvas z-indexes:', Array.from(this.canvases).map(c => {
      const computedStyle = window.getComputedStyle(c);
      return {
        type: c.getAttribute('data-canvas-type'),
        zIndex: computedStyle.zIndex,
        position: computedStyle.position
      };
    }));

    return registered;
  }

  /**
   * 🎯 CLEAR ALL OVERLAYS
   * Clears debug overlays από όλα τα registered canvases
   */
  clearAllOverlays(): void {
    for (const canvas of this.canvases) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Note: Αυτό θα κάνει full clear - στην πραγματικότητα θα πρέπει
        // να έχουμε πιο sophisticated overlay management
        // ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  /**
   * 🎯 GET DEBUG STATUS
   */
  getStatus(): {
    enabled: boolean;
    registeredCanvases: number;
    settings: OriginMarkerDebugSettings;
  } {
    return {
      enabled: this.settings.enabled,
      registeredCanvases: this.canvases.length,
      settings: { ...this.settings }
    };
  }
}

// 🛠️ GLOBAL SINGLETON για easy access
export const originMarkersDebug = new OriginMarkersDebugOverlay();

// Expose στο window για console debugging
if (typeof window !== 'undefined') {
  (window as any).originMarkersDebug = originMarkersDebug;
}