/**
 * 🎯 CURSOR-SNAP ALIGNMENT DEBUG OVERLAY
 * Visual debugging tool για να επαληθεύσουμε την ταύτιση:
 * - Cursor Position (mouse coordinates)
 * - Crosshair Center
 * - Snap Marker Position
 *
 * Enterprise-grade alignment verification με visual feedback
 */

import type { Point2D } from '../rendering/types/Types';
import type { CanvasConfig } from '../rendering/types/Types';
import { CanvasUtils } from '../rendering/canvas/utils/CanvasUtils';
import { UI_COLORS, CANVAS_THEME } from '../config/color-config';
// 🏢 ADR-094: Centralized Device Pixel Ratio
import { getDevicePixelRatio } from '../systems/cursor/utils';
// 🏢 ADR-044: Centralized Line Widths
// 🏢 ADR-090: Centralized UI Fonts
import { RENDER_LINE_WIDTHS, UI_FONTS } from '../config/text-rendering-config';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../rendering/primitives/canvasPaths';

interface AlignmentDebugState {
  enabled: boolean;
  cursorPos: Point2D | null;
  crosshairPos: Point2D | null;
  snapPos: Point2D | null;
  canvasEl: HTMLCanvasElement | null;
  overlayEl: HTMLCanvasElement | null;
  // 🎯 TYPE-SAFE: Document click handler for cleanup
  documentClickHandler?: ((event: MouseEvent) => void) | null;
}

class CursorSnapAlignmentDebugger {
  private state: AlignmentDebugState = {
    enabled: false,
    cursorPos: null,
    crosshairPos: null,
    snapPos: null,
    canvasEl: null,
    overlayEl: null,
  };

  /**
   * Toggle debug overlay
   */
  toggle(): boolean {
    this.state.enabled = !this.state.enabled;

    if (this.state.enabled) {
      this.createOverlay();
      this.startTracking();
      console.log('🎯 Cursor-Snap Alignment Debug: ENABLED');
    } else {
      this.cleanup();
      console.log('🎯 Cursor-Snap Alignment Debug: DISABLED');
    }

    return this.state.enabled;
  }

  /**
   * Create debug canvas overlay
   * ✅ ENTERPRISE FIX: Use same HiDPI scaling as DxfCanvas/LayerCanvas
   */
  private createOverlay(): void {
    // Find main canvas
    const mainCanvas = document.querySelector('canvas[data-canvas-type="layer"]') as HTMLCanvasElement;
    if (!mainCanvas) {
      console.error('❌ Main canvas not found');
      return;
    }

    this.state.canvasEl = mainCanvas;

    // Create debug overlay canvas
    const overlay = document.createElement('canvas');
    overlay.id = 'cursor-snap-alignment-debug';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.pointerEvents = 'none'; // PASSTHROUGH: Let mouse events pass through
    overlay.style.zIndex = '9999';

    const rect = mainCanvas.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    // Insert overlay FIRST (so getBoundingClientRect works in setupCanvasContext)
    const parent = mainCanvas.parentElement;
    if (!parent) {
      console.error('❌ Main canvas has no parent element');
      return;
    }
    parent.appendChild(overlay);
    this.state.overlayEl = overlay;

    // ✅ ENTERPRISE FIX: Apply same HiDPI setup as DxfCanvas/LayerCanvas
    // This ensures cursor/crosshair markers align with rendered UI elements
    // ✅ ADR-002: Using centralized CANVAS_THEME for overlay background
    const canvasConfig: CanvasConfig = {
      devicePixelRatio: getDevicePixelRatio(), // 🏢 ADR-094
      enableHiDPI: true,
      backgroundColor: CANVAS_THEME.OVERLAY
    };

    // Setup canvas with same HiDPI scaling (AFTER inserting to DOM)
    CanvasUtils.setupCanvasContext(overlay, canvasConfig);
  }

  /**
   * Start tracking cursor/crosshair/snap positions
   */
  private startTracking(): void {
    if (!this.state.overlayEl) return;

    // Track mouse position (cursor)
    const handleMouseMove = (e: MouseEvent) => {
      if (!this.state.canvasEl) return;

      const rect = this.state.canvasEl.getBoundingClientRect();
      this.state.cursorPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      this.render();
    };

    // Track crosshair position (should equal cursor position)
    const trackCrosshair = () => {
      // Crosshair should always follow cursor - they render at the same position
      this.state.crosshairPos = this.state.cursorPos ? { ...this.state.cursorPos } : null;
    };

    // Track snap position (from LayerCanvas snap results)
    let logCounter = 0;
    const trackSnap = () => {
      // Get snap results from window (set by LayerCanvas)
      const snapResults = (window as any).__debugSnapResults || [];
      if (snapResults.length > 0) {
        const primarySnap = snapResults[0];

        // Debug logging (every 60 frames ≈ 1 second)
        if (logCounter++ % 60 === 0) {
          console.log('🎯 Snap Debug:', {
            snapPoint: primarySnap.point,
            snapType: primarySnap.type
          });
        }

        // ✅ CORRECTION: snapResults.point is ALREADY in screen coordinates!
        // SnapRenderer uses it directly without any transformation (see SnapRenderer.ts:141)
        // NO transformation needed - use as-is
        this.state.snapPos = primarySnap.point;
      } else {
        this.state.snapPos = null;
      }
    };

    // Handle click to show measurements in toast
    const handleClick = (e: MouseEvent) => {
      console.log('🎯🎯🎯 CLICK DETECTED ON OVERLAY!!!', e);

      if (!this.state.canvasEl) {
        console.error('❌ No canvas element');
        return;
      }

      // Update cursor position from click event
      const rect = this.state.canvasEl.getBoundingClientRect();
      this.state.cursorPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // Force update crosshair and snap positions
      trackCrosshair();
      trackSnap();

      console.log('🎯 CLICK CAPTURE:', {
        cursor: this.state.cursorPos,
        crosshair: this.state.crosshairPos,
        snap: this.state.snapPos
      });

      // Generate measurement report with current state (NO DELAY)
      const report = this.generateMeasurementReport();

      // Show in copyable toast
      const showCopyableNotification = (window as any).showCopyableNotification;
      if (showCopyableNotification) {
        console.log('✅ Showing toast with report');
        showCopyableNotification(report, 'info');
      } else {
        console.error('❌ showCopyableNotification not found');
        console.log(report);
      }
    };

    // Set up event listeners
    document.addEventListener('mousemove', handleMouseMove);

    // Add click listener to DOCUMENT instead of overlay (to ensure it catches clicks)
    const documentClickHandler = (e: MouseEvent) => {
      // Only handle clicks if overlay is active and click is on/near canvas
      if (!this.state.enabled || !this.state.canvasEl) return;

      const rect = this.state.canvasEl.getBoundingClientRect();
      const clickX = e.clientX;
      const clickY = e.clientY;

      // Check if click is within canvas bounds
      if (clickX >= rect.left && clickX <= rect.right &&
          clickY >= rect.top && clickY <= rect.bottom) {
        console.log('🎯🎯🎯 CLICK DETECTED ON CANVAS AREA!!!');
        handleClick(e);
      }
    };

    document.addEventListener('click', documentClickHandler);

    // Store handler for cleanup
    this.state.documentClickHandler = documentClickHandler;

    // RAF loop for crosshair and snap tracking
    const rafLoop = () => {
      if (!this.state.enabled) return;

      trackCrosshair();
      trackSnap();
      this.render();

      requestAnimationFrame(rafLoop);
    };

    requestAnimationFrame(rafLoop);
  }

  /**
   * Render debug markers (NO PANEL - only visual markers)
   */
  private render(): void {
    if (!this.state.overlayEl) return;

    const ctx = this.state.overlayEl.getContext('2d');
    if (!ctx) return;

    // ✅ CORRECT: Use logical dimensions matching setupCanvasContext
    // setupCanvasContext did: canvas.width = rect.width * dpr, ctx.setTransform(dpr, ...)
    // So we need: rect.width = canvas.width / dpr (reverse calculation)
    const dpr = getDevicePixelRatio(); // 🏢 ADR-094
    const logicalWidth = this.state.overlayEl.width / dpr;
    const logicalHeight = this.state.overlayEl.height / dpr;

    // DEBUG: Log rendering attempt
    if (this.state.cursorPos || this.state.crosshairPos) {
      console.log('🎨 DEBUG OVERLAY RENDER:', {
        dpr,
        canvasWidth: this.state.overlayEl.width,
        canvasHeight: this.state.overlayEl.height,
        logicalWidth,
        logicalHeight,
        cursorPos: this.state.cursorPos,
        crosshairPos: this.state.crosshairPos
      });
    }

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // Draw cursor marker (BLUE)
    if (this.state.cursorPos) {
      this.drawMarker(ctx, this.state.cursorPos, UI_COLORS.DEBUG_CURSOR, 'Cursor');
    }

    // Draw crosshair center marker (GREEN)
    if (this.state.crosshairPos) {
      this.drawMarker(ctx, this.state.crosshairPos, UI_COLORS.DEBUG_CROSSHAIR, 'Crosshair', 8);
    }

    // Draw snap marker (RED)
    if (this.state.snapPos) {
      this.drawMarker(ctx, this.state.snapPos, UI_COLORS.DEBUG_SNAP, 'Snap', 12);

      // Draw distance lines
      if (this.state.cursorPos) {
        this.drawDistanceLine(ctx, this.state.cursorPos, this.state.snapPos, UI_COLORS.DEBUG_DISTANCE);
      }
    }

    // NO PANEL - measurements shown via toast on click
  }

  /**
   * Draw circular marker with label
   */
  private drawMarker(
    ctx: CanvasRenderingContext2D,
    pos: Point2D,
    color: string,
    label: string,
    size: number = 10
  ): void {
    ctx.save();

    // Draw circle
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '33'; // 20% opacity
    ctx.lineWidth = RENDER_LINE_WIDTHS.DEBUG; // 🏢 ADR-044

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(pos.x - size - 5, pos.y);
    ctx.lineTo(pos.x + size + 5, pos.y);
    ctx.moveTo(pos.x, pos.y - size - 5);
    ctx.lineTo(pos.x, pos.y + size + 5);
    ctx.stroke();

    // Draw label
    ctx.fillStyle = color;
    ctx.font = UI_FONTS.ARIAL.BOLD; // 🏢 ADR-090: Centralized font
    ctx.fillText(label, pos.x + size + 8, pos.y - size - 5);

    ctx.restore();
  }

  /**
   * Draw distance line between two points
   */
  private drawDistanceLine(
    ctx: CanvasRenderingContext2D,
    from: Point2D,
    to: Point2D,
    color: string
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = RENDER_LINE_WIDTHS.THIN; // 🏢 ADR-044
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Generate measurement report for toast (copyable)
   */
  private generateMeasurementReport(): string {
    const lines: string[] = [];

    // DEBUG: Log state values
    console.log('📊 REPORT STATE:', {
      cursorPos: this.state.cursorPos,
      crosshairPos: this.state.crosshairPos,
      snapPos: this.state.snapPos,
      hasCursor: !!this.state.cursorPos,
      hasCrosshair: !!this.state.crosshairPos,
      hasSnap: !!this.state.snapPos
    });

    lines.push('🎯 CURSOR-SNAP ALIGNMENT REPORT');
    lines.push('================================');
    lines.push('');

    // Cursor position
    if (this.state.cursorPos) {
      lines.push(`🔵 Cursor Position:`);
      lines.push(`   x: ${this.state.cursorPos.x.toFixed(2)}px`);
      lines.push(`   y: ${this.state.cursorPos.y.toFixed(2)}px`);
    } else {
      lines.push(`🔵 Cursor Position: N/A (ERROR!)`);
    }
    lines.push('');

    // Crosshair position
    if (this.state.crosshairPos) {
      lines.push(`🟢 Crosshair Position:`);
      lines.push(`   x: ${this.state.crosshairPos.x.toFixed(2)}px`);
      lines.push(`   y: ${this.state.crosshairPos.y.toFixed(2)}px`);
    } else {
      lines.push(`🟢 Crosshair Position: N/A (ERROR!)`);
      lines.push(`   (Should equal cursor position)`);
    }
    lines.push('');

    // Snap position
    if (this.state.snapPos) {
      lines.push(`🔴 Snap Position:`);
      lines.push(`   x: ${this.state.snapPos.x.toFixed(2)}px`);
      lines.push(`   y: ${this.state.snapPos.y.toFixed(2)}px`);
    } else {
      lines.push(`🔴 Snap Position: N/A (no active snap)`);
    }
    lines.push('');

    // Distances
    lines.push('📏 DISTANCES:');
    lines.push('-------------');

    if (this.state.cursorPos && this.state.crosshairPos) {
      const dist = calculateDistance(this.state.cursorPos, this.state.crosshairPos);
      lines.push(`Cursor ↔ Crosshair: ${dist.toFixed(2)}px`);
      if (dist < 0.5) {
        lines.push(`   ✅ ALIGNED (perfect)`);
      } else if (dist < 2.0) {
        lines.push(`   ⚠️ SLIGHT MISALIGNMENT`);
      } else {
        lines.push(`   ❌ MISALIGNED (${dist.toFixed(2)}px gap)`);
      }
    } else {
      lines.push(`Cursor ↔ Crosshair: ERROR - Missing data!`);
      lines.push(`   Cursor: ${this.state.cursorPos ? 'OK' : 'NULL'}`);
      lines.push(`   Crosshair: ${this.state.crosshairPos ? 'OK' : 'NULL'}`);
    }
    lines.push('');

    if (this.state.cursorPos && this.state.snapPos) {
      const dist = calculateDistance(this.state.cursorPos, this.state.snapPos);
      lines.push(`Cursor ↔ Snap: ${dist.toFixed(2)}px`);
    } else {
      lines.push(`Cursor ↔ Snap: ${this.state.snapPos ? 'No cursor data' : 'No snap active'}`);
    }
    lines.push('');

    if (this.state.crosshairPos && this.state.snapPos) {
      const dist = calculateDistance(this.state.crosshairPos, this.state.snapPos);
      lines.push(`Crosshair ↔ Snap: ${dist.toFixed(2)}px`);
    } else {
      lines.push(`Crosshair ↔ Snap: ${this.state.snapPos ? 'No crosshair data' : 'No snap active'}`);
    }

    return lines.join('\n');
  }

  /**
   * Cleanup debug overlay
   */
  private cleanup(): void {
    if (this.state.overlayEl) {
      this.state.overlayEl.remove();
      this.state.overlayEl = null;
    }

    // Remove document click listener if exists
    if (this.state.documentClickHandler) {
      document.removeEventListener('click', this.state.documentClickHandler);
      this.state.documentClickHandler = null;
    }

    this.state.cursorPos = null;
    this.state.crosshairPos = null;
    this.state.snapPos = null;
  }

  /**
   * Get current state (for external inspection)
   */
  getDiagnostics() {
    return {
      enabled: this.state.enabled,
      cursor: this.state.cursorPos,
      crosshair: this.state.crosshairPos,
      snap: this.state.snapPos,
      distances: {
        cursorToSnap: this.state.cursorPos && this.state.snapPos
          ? calculateDistance(this.state.cursorPos, this.state.snapPos)
          : null,
        cursorToCrosshair: this.state.cursorPos && this.state.crosshairPos
          ? calculateDistance(this.state.cursorPos, this.state.crosshairPos)
          : null,
        crosshairToSnap: this.state.crosshairPos && this.state.snapPos
          ? calculateDistance(this.state.crosshairPos, this.state.snapPos)
          : null,
      },
    };
  }
}

// Singleton instance
export const cursorSnapAlignmentDebug = new CursorSnapAlignmentDebugger();

// Global window access (for console debugging)
if (typeof window !== 'undefined') {
  (window as any).__cursorSnapAlignmentDebug = cursorSnapAlignmentDebug;
}
