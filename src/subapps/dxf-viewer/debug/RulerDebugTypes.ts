/**
 * 🛠️ ENTERPRISE RULER DEBUG TYPES
 * Professional ruler calibration, alignment verification, and testing system
 * Follows AutoCAD/Rhino/SolidWorks testing standards
 */

import type { Point2D, Viewport, ViewTransform } from '../rendering/types/Types';
import { UI_COLORS } from '../config/color-config';

/**
 * 🎯 RULER DEBUG MODE
 * Different testing/verification modes
 */
export type RulerDebugMode =
  | 'calibration'    // Show calibration grid + tick markers
  | 'alignment'      // Show alignment verification only
  | 'performance'    // Show performance metrics
  | 'full';          // All features enabled

/**
 * 🎯 TICK MARKER STYLE
 * Visual style for ruler tick overlays
 */
export interface TickMarkerStyle {
  enabled: boolean;
  majorTickColor: string;      // Color for major ticks (e.g. red)
  minorTickColor: string;      // Color for minor ticks (e.g. green)
  majorTickSize: number;       // Pixel radius of major tick dots
  minorTickSize: number;       // Pixel radius of minor tick dots
  opacity: number;             // Transparency
  showLabels: boolean;         // Show world coordinate labels on ticks
  labelColor: string;
  labelFontSize: number;
}

/**
 * 🎯 CALIBRATION GRID SETTINGS
 * Reference grid for visual verification
 */
export interface CalibrationGridSettings {
  enabled: boolean;
  gridSpacing: number;         // Grid spacing in world units (e.g. 100mm)
  lineColor: string;
  lineWidth: number;
  opacity: number;
  showLabels: boolean;         // Show coordinates at intersections
  labelColor: string;
  labelFontSize: number;
  showOriginMarker: boolean;   // Special marker at (0,0)
  originMarkerColor: string;
  originMarkerSize: number;
}

/**
 * 🎯 ALIGNMENT VERIFICATION SETTINGS
 * Auto-verification panel configuration
 */
export interface AlignmentVerificationSettings {
  enabled: boolean;
  showPanel: boolean;          // Show floating verification panel
  panelPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  panelOpacity: number;
  autoVerify: boolean;         // Run verification automatically
  verificationInterval: number; // ms between auto-verifications
  tolerancePixels: number;     // Pixel tolerance for "aligned" status
}

/**
 * 🎯 VERIFICATION RESULT
 * Result από alignment verification
 */
export interface VerificationResult {
  timestamp: number;
  passed: boolean;
  errors: VerificationError[];
  metrics: VerificationMetrics;
}

/**
 * 🎯 VERIFICATION ERROR
 * Specific alignment error detected
 */
export interface VerificationError {
  type: 'tick-spacing' | 'grid-alignment' | 'coordinate-mismatch' | 'ruler-sync';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  location?: Point2D;          // World coordinates where error detected
  expectedValue?: number;
  actualValue?: number;
  deviation?: number;          // Pixel/unit deviation
}

/**
 * 🎯 VERIFICATION METRICS
 * Quantitative measurements
 */
export interface VerificationMetrics {
  // Tick spacing metrics
  horizontalTickSpacing: {
    expected: number;          // Expected spacing in pixels
    actual: number;            // Measured spacing
    deviation: number;         // Pixel deviation
    aligned: boolean;          // Within tolerance?
  };
  verticalTickSpacing: {
    expected: number;
    actual: number;
    deviation: number;
    aligned: boolean;
  };

  // Grid alignment metrics
  gridAlignment: {
    horizontalOffset: number;  // Pixel offset from expected
    verticalOffset: number;
    aligned: boolean;
  };

  // Coordinate accuracy metrics
  coordinateAccuracy: {
    maxError: number;          // Max coordinate error in world units
    avgError: number;          // Average error
    accurate: boolean;         // Within tolerance?
  };

  // Performance metrics
  performance: {
    renderTime: number;        // ms
    tickCount: number;
    gridLineCount: number;
  };
}

/**
 * 🎯 COMPREHENSIVE RULER DEBUG SETTINGS
 * Master settings interface για enterprise ruler debugging
 */
/**
 * ✅ ENTERPRISE FIX: Mutable version of UIElementSettings for debug system
 * RulerDebugOverlay needs to modify enabled property at runtime
 */
export interface MutableUIElementSettings {
  enabled: boolean;        // ✅ NOT readonly - can be modified by debug system
  readonly visible: boolean;
  readonly opacity: number;
  // 🗑️ ΔΙΑΓΡΑΦΗΚΕ `zIndex?: number` (ADR-780 Φάση Γ): **κανείς** δεν το διάβαζε ποτέ
  // (μετρημένο — μηδέν `settings.zIndex` στον υποφάκελο). Ένα πεδίο στρώσης που κανένας
  // ζωγράφος δεν συμβουλεύεται δηλώνει στρώση **που δεν συμβαίνει**: μετριόταν από την
  // πύλη ως ωμή δήλωση 2000, ενώ ο ρόλος του overlay εντοπισμού σφαλμάτων είναι άλλος.
}

export interface RulerDebugSettings extends MutableUIElementSettings {
  mode: RulerDebugMode;

  // Sub-feature settings
  tickMarkers: TickMarkerStyle;
  calibrationGrid: CalibrationGridSettings;
  alignmentVerification: AlignmentVerificationSettings;

  // Global debug settings
  showCoordinates: boolean;    // Show mouse world coordinates
  showZoomLevel: boolean;      // Show current zoom level
  showTickInfo: boolean;       // Show tick spacing info
  highlightOrigin: boolean;    // Highlight (0,0) origin
}

/**
 * 🎯 DEFAULT TICK MARKER STYLE
 */
export const DEFAULT_TICK_MARKER_STYLE: TickMarkerStyle = {
  enabled: true,
  majorTickColor: UI_COLORS.RULER_MAJOR_TICK,   // Red dots for major ticks
  minorTickColor: UI_COLORS.RULER_MINOR_TICK,   // Green dots for minor ticks
  majorTickSize: 4,            // 4px radius
  minorTickSize: 2,            // 2px radius
  opacity: 0.8,
  showLabels: true,
  labelColor: UI_COLORS.WHITE,
  labelFontSize: 10
};

/**
 * 🎯 DEFAULT CALIBRATION GRID SETTINGS
 */
export const DEFAULT_CALIBRATION_GRID_SETTINGS: CalibrationGridSettings = {
  enabled: true,
  gridSpacing: 100,            // 100mm grid
  lineColor: UI_COLORS.RULER_CALIBRATION,        // Cyan for high visibility
  lineWidth: 1,
  opacity: 0.5,                // Semi-transparent
  showLabels: true,
  labelColor: UI_COLORS.RULER_CALIBRATION,
  labelFontSize: 12,
  showOriginMarker: true,
  originMarkerColor: UI_COLORS.RULER_ORIGIN_MARKER, // Magenta
  originMarkerSize: 10
};

/**
 * 🎯 DEFAULT ALIGNMENT VERIFICATION SETTINGS
 */
export const DEFAULT_ALIGNMENT_VERIFICATION_SETTINGS: AlignmentVerificationSettings = {
  enabled: true,
  showPanel: true,
  panelPosition: 'top-right',
  panelOpacity: 0.9,
  autoVerify: true,
  verificationInterval: 1000,  // Verify every 1 second
  tolerancePixels: 2           // 2px tolerance
};

/**
 * 🎯 DEFAULT ENTERPRISE RULER DEBUG SETTINGS
 */
export const DEFAULT_RULER_DEBUG_SETTINGS: RulerDebugSettings = {
  enabled: false,              // OFF by default
  visible: true,
  opacity: 1.0,

  mode: 'full',                // Full enterprise mode by default

  tickMarkers: DEFAULT_TICK_MARKER_STYLE,
  calibrationGrid: DEFAULT_CALIBRATION_GRID_SETTINGS,
  alignmentVerification: DEFAULT_ALIGNMENT_VERIFICATION_SETTINGS,

  showCoordinates: true,
  showZoomLevel: true,
  showTickInfo: true,
  highlightOrigin: true
};

/**
 * 🎯 RULER DEBUG RENDER DATA
 * Data required for rendering debug overlays
 */
export interface RulerDebugRenderData {
  settings: RulerDebugSettings;
  transform: ViewTransform;
  viewport: Viewport;

  // Ruler-specific data
  rulerSettings?: {
    horizontal: {
      height: number;
      tickInterval: number;
      majorTickLength: number;
      minorTickLength: number;
    };
    vertical: {
      width: number;
      tickInterval: number;
      majorTickLength: number;
      minorTickLength: number;
    };
  };

  // Verification results (if available)
  verificationResult?: VerificationResult;
}
