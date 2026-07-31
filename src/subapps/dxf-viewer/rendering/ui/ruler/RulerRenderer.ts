/**
 * CENTRALIZED RULER RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Κεντρικοποιημένο ruler rendering χωρίς διπλότυπα
 */

import type { Viewport } from '../../types/Types';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  RulerSettings,
  RulerRenderMode,
  RulerOrientation
} from './RulerTypes';
// 🔑 SSoT — οι ζώνες των χαράκων είναι το συμπλήρωμα της περιοχής σχεδίασης (πρότυπο Krita).
import { getBottomRulerBand, getLeftRulerBand } from '../../core/drawing-area';

/**
 * Κενό (CSS px) στην **πάνω** ακμή του καμβά όπου ο κατακόρυφος χάρακας δεν τυπώνει ετικέτες.
 * Καθαρά αισθητικό — **καμία** σχέση με τη γεωμετρία της περιοχής σχεδίασης.
 */
const VERTICAL_RULER_LABEL_TOP_GAP = 30;
// 🏢 ADR-044: Centralized line widths
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
import { RENDER_LINE_WIDTHS, buildUIFont } from '../../../config/text-rendering-config';
// Corner-box draw helper extracted for file-size compliance (<500).
import { drawRulerCornerBox } from './ruler-corner-box';
// 🏢 ADR-XXX: Centralized Angular Constants
import { RIGHT_ANGLE } from '../../entities/shared/geometry-utils';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { WORLD_ORIGIN } from '../../../config/geometry-constants';
// 🏢 ADR-462: display-measurement SSoT — the VISIBLE canvas ruler (this renderer,
// instantiated by DxfCanvas → drawn by dxf-canvas-renderer) follows the status-bar
// unit selector. Tick numbers are world COORDINATES (signed); the unit suffix is the
// live display-unit label. The legacy per-ruler `settings.unit` no longer wins —
// Revit-style ONE project unit, shared with the status-bar X/Y readout.
import { formatCoordinateForDisplay, currentDisplayUnitLabel } from '../../../config/display-length-format';

/** Η ζώνη που καταλαμβάνει ένας χάρακας — ό,τι επιστρέφει το SSoT της περιοχής σχεδίασης. */
type RulerBandRect = { x: number; y: number; width: number; height: number };

/** Μία ένδειξη: ίδιο στυλ πάντα, διαφορετική διαδρομή ανά άξονα. */
function strokeTick(
  ctx: CanvasRenderingContext2D,
  color: string,
  path: () => void
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK;
  ctx.beginPath();
  path();
  ctx.stroke();
}

/**
 * Αριθμός + (προαιρετικά) μονάδα, στο ίδιο σημείο.
 *
 * Δέχεται συντεταγμένες αντί να τις υπολογίζει, γιατί ο κατακόρυφος χάρακας το καλεί **μέσα
 * σε περιστραμμένο σύστημα** με αρχή στην ένδειξη, δηλαδή με `(0, 0)`.
 */
function drawTickLabel(
  ctx: CanvasRenderingContext2D,
  settings: RulerSettings,
  numberText: string,
  x: number,
  y: number
): void {
  ctx.fillStyle = settings.textColor;
  ctx.font = buildUIFont(settings.fontSize, 'arial');
  ctx.fillText(numberText, x, y);

  if (!settings.showUnits) return;
  const numberWidth = ctx.measureText(numberText).width;
  ctx.fillStyle = settings.unitsColor;
  ctx.font = buildUIFont(settings.unitsFontSize, 'arial');
  ctx.fillText(currentDisplayUnitLabel(), x + numberWidth / 2 + 5, y);
}

/**
 * Οι **μόνες** διαφορές ανάμεσα στον οριζόντιο και τον κατακόρυφο χάρακα — ονοματισμένες, σε
 * ένα σημείο. Ό,τι δεν βρίσκεται εδώ είναι κοινό εξ ορισμού και δεν μπορεί να αποκλίνει.
 */
interface RulerAxisOps {
  /** Μέχρι πού τρέχει το πέρασμα ενδείξεων: πλάτος ή ύψος του καμβά. */
  readonly limit: number;
  /** Η πρώτη θέση όπου επιτρέπεται ετικέτα. */
  readonly minLabelPos: number;
  /** Κοσμική συντεταγμένη της ένδειξης — ο κατακόρυφος έχει **ανεστραμμένο** άξονα. */
  world(pos: number): number;
  /** Η διαδρομή μιας ένδειξης μήκους `length`: πάντα από το εσωτερικό χείλος προς τα έξω. */
  tickPath(ctx: CanvasRenderingContext2D, pos: number, length: number): void;
  /** Η ετικέτα στη θέση `pos` — ο κατακόρυφος τη γράφει περιστραμμένη. */
  drawLabel(
    ctx: CanvasRenderingContext2D,
    settings: RulerSettings,
    numberText: string,
    pos: number
  ): void;
}

function rulerAxisOps(
  orientation: RulerOrientation,
  viewport: Viewport,
  rect: RulerBandRect,
  originScreen: number,
  scale: number
): RulerAxisOps {
  if (orientation === 'horizontal') {
    const inner = rect.y + rect.height;
    return {
      limit: viewport.width,
      // Η πρώτη ετικέτα ξεκινά μετά τον κατακόρυφο χάρακα — από το SSoT, ΟΧΙ σταθερά «30».
      minLabelPos: getLeftRulerBand(viewport).width,
      world: (x) => (x - originScreen) / scale,
      tickPath: (ctx, x, length) => {
        ctx.moveTo(x, inner - length);
        ctx.lineTo(x, inner);
      },
      drawLabel: (ctx, settings, numberText, x) =>
        drawTickLabel(ctx, settings, numberText, x, rect.y + rect.height / 2),
    };
  }

  const inner = rect.x + rect.width;
  return {
    limit: viewport.height,
    // ⚠️ ΟΧΙ γεωμετρία χάρακα — καθαρά αισθητικό κενό στην ΠΑΝΩ ακμή, ώστε η πρώτη ετικέτα να
    // μην κολλά στο χείλος. Δανειζόταν το `MARGINS.top` (30) και έμοιαζε με γεωμετρία· ήταν η
    // ΤΡΙΤΗ σημασία που φορτωνόταν στο ίδιο πεδίο. Δικό του όνομα ⇒ δεν παρασύρει τον επόμενο.
    minLabelPos: VERTICAL_RULER_LABEL_TOP_GAP,
    world: (y) => (originScreen - y) / scale,
    tickPath: (ctx, y, length) => {
      ctx.moveTo(inner - length, y);
      ctx.lineTo(inner, y);
    },
    drawLabel: (ctx, settings, numberText, y) => {
      // Το σύστημα περιστρέφεται ΓΥΡΩ ΑΠΟ την ένδειξη, οπότε η ετικέτα γράφεται στο (0, 0).
      ctx.save();
      ctx.translate(rect.x + rect.width / 2, y);
      ctx.rotate(-RIGHT_ANGLE);
      drawTickLabel(ctx, settings, numberText, 0, 0);
      ctx.restore();
    },
  };
}

/**
 * 🔺 CENTRALIZED RULER RENDERER
 * Single Source of Truth για ruler rendering
 * Αντικαθιστά όλα τα duplicate Ruler rendering code
 *
 * ✅ ADR-186: Adaptive Tick Spacing (AutoCAD/Bentley industry standard)
 * Uses 1-2-5 sequence for "nice" tick intervals that adapt to zoom level
 */
export class RulerRenderer implements UIRenderer {
  readonly type = 'ruler';

  private renderCount = 0;
  private lastRenderTime = 0;

  // ─── ADR-186: Adaptive Ruler Constants ───────────────────────────────
  /**
   * 1-2-5 sequence — Industry standard tick intervals (AutoCAD, Bentley, Figma)
   * Each step is ×2, ×2.5, or ×2 of the previous, producing visually "nice" numbers.
   */
  private static readonly ADAPTIVE_INTERVALS: readonly number[] = [
    0.01, 0.02, 0.05,
    0.1,  0.2,  0.5,
    1,    2,    5,
    10,   20,   50,
    100,  200,  500,
    1000, 2000, 5000,
    10_000, 20_000, 50_000,
  ] as const;

  /** Minimum pixel distance between major ticks to keep labels readable */
  private static readonly MIN_TICK_PIXELS = 60;

  /** Maximum pixel distance before we should subdivide further */
  private static readonly MAX_TICK_PIXELS = 200;

  /** Minimum pixel distance between minor ticks to render them */
  private static readonly MIN_MINOR_TICK_PIXELS = 8;

  // ─── Adaptive helpers ────────────────────────────────────────────────

  /**
   * Pick the best major-tick interval for the current zoom.
   * Walks the 1-2-5 table until the resulting pixel step ≥ MIN_TICK_PIXELS.
   */
  private calculateAdaptiveInterval(scale: number): number {
    const intervals = RulerRenderer.ADAPTIVE_INTERVALS;
    for (const interval of intervals) {
      if (interval * scale >= RulerRenderer.MIN_TICK_PIXELS) {
        return interval;
      }
    }
    // Fallback: largest interval
    return intervals[intervals.length - 1];
  }

  /**
   * Main render method - Implements UIRenderer interface
   */
  render(
    context: UIRenderContext,
    viewport: Viewport,
    settings: UIElementSettings
  ): void {
    const rulerSettings = settings as RulerSettings;

    // Get transform data από context
    const transformData = this.getTransformData(context);
    if (!transformData) return;

    // Render both horizontal and vertical rulers.
    // Οι ΘΕΣΕΙΣ δεν δίνονται πια ως παράμετρος: οι ζώνες παράγονται από το SSoT της περιοχής
    // σχεδίασης (κάτω + αριστερά), ώστε ο χάρακας να μη μπορεί να ζωγραφίσει ζώνη διαφορετική
    // από αυτήν που κόβει το clip.
    this.renderRuler(context.ctx, viewport, rulerSettings, transformData, 'horizontal');
    this.renderRuler(context.ctx, viewport, rulerSettings, transformData, 'vertical');

    // ✅ CAD-GRADE: Render corner box where rulers meet (AutoCAD/Revit/Blender standard)
    drawRulerCornerBox(context.ctx, viewport, rulerSettings);
  }

  /**
   * 🔺 LEGACY COMPATIBILITY
   * Direct render method για backward compatibility
   */
  renderDirect(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    mode: RulerRenderMode = 'normal'
  ): void {
    // Render both rulers for legacy compatibility
    this.renderRuler(ctx, viewport, settings, transform, 'horizontal');
    this.renderRuler(ctx, viewport, settings, transform, 'vertical');

    // ✅ CAD-GRADE: Render corner box where rulers meet
    drawRulerCornerBox(ctx, viewport, settings);
  }

  /**
   * 🔺 CORE RULER RENDERING
   * Unified rendering logic για όλους τους modes
   */
  private renderRuler(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    orientation: RulerOrientation
  ): void {
    const startTime = performance.now();

    if (!settings.enabled || !settings.visible) return;

    ctx.save();

    // 🔑 SSoT — η ζώνη του χάρακα είναι το **συμπλήρωμα** της περιοχής σχεδίασης, όχι δικός του
    // υπολογισμός από `settings.width/height`. Πρότυπο Krita (`KisZoomManager` κρατά τους
    // `KoRuler` συγχρονισμένους ΑΠΟ τον `KisCoordinatesConverter`): ο χάρακας είναι καταναλωτής.
    const rulerRect =
      orientation === 'horizontal' ? getBottomRulerBand(viewport) : getLeftRulerBand(viewport);

    // Render background
    if (settings.showBackground) {
      this.renderRulerBackground(ctx, rulerRect, settings);
    }

    // Render ticks and labels — μία υλοποίηση, ο άξονας είναι παράμετρος.
    this.renderRulerTicks(ctx, viewport, settings, transform, rulerRect, orientation);

    ctx.restore();

    // Update metrics
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Render ruler background
   */
  private renderRulerBackground(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    settings: RulerSettings
  ): void {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Border
    if (settings.borderWidth > 0) {
      ctx.strokeStyle = settings.borderColor;
      ctx.lineWidth = settings.borderWidth;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  /**
   * Ό,τι μοιράζονται **και οι δύο** χάρακες πριν αρχίσει το πέρασμα ενδείξεων: το βήμα
   * (ADR-186), η οθονική αρχή του κόσμου **στον δικό τους άξονα**, η πρώτη ένδειξη, και το
   * στυλ κειμένου.
   *
   * `null` ⇒ εκφυλισμένο βήμα, ο καλών δεν ζωγραφίζει τίποτα.
   */
  private beginTickPass(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    orientation: RulerOrientation
  ): { step: number; originScreen: number; start: number } | null {
    // ─── ADR-186: Adaptive interval calculation ──────────────────────
    const step = this.calculateAdaptiveInterval(transform.scale) * transform.scale;
    if (step < 1) return null;

    // ✅ CORRECT: Use world (0,0) as reference — 🏢 ADR-118 centralized WORLD_ORIGIN.
    const screenOrigin = CoordinateTransforms.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const originScreen = orientation === 'horizontal' ? screenOrigin.x : screenOrigin.y;

    // Text styling
    ctx.fillStyle = settings.textColor;
    ctx.font = buildUIFont(settings.fontSize, 'arial');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    return { step, originScreen, start: originScreen % step };
  }

  /**
   * Render ruler ticks + labels — **μία** υλοποίηση για τους δύο χάρακες.
   *
   * 🔴 Ήταν δύο συναρτήσεις (`renderHorizontalRuler` / `renderVerticalRuler`) που έτρεχαν τον
   * ΙΔΙΟ αλγόριθμο με αναποδογυρισμένο άξονα. Το CHECK 3.28 τις σήμανε ως δίδυμα σε **τρεις
   * διαδοχικούς γύρους**: κάθε φορά που εξαγόταν ένα κομμάτι, το επόμενο έβγαινε στην
   * επιφάνεια — η ένδειξη ότι η διπλή γραφή δεν ήταν σε κάποιο κομμάτι, ήταν στη **δομή**.
   * Οι διαφορές τους ζουν πλέον ονοματισμένες στο {@link rulerAxisOps}· ό,τι δεν είναι εκεί,
   * είναι κοινό εξ ορισμού και δεν μπορεί να αποκλίνει.
   *
   * ✅ ADR-186: Adaptive tick spacing — ticks & labels adapt to zoom level
   * 🎯 (0,0) στην κάτω αριστερή γωνία του lime πλαισίου
   */
  private renderRulerTicks(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    rect: RulerBandRect,
    orientation: RulerOrientation
  ): void {
    const pass = this.beginTickPass(ctx, viewport, settings, transform, orientation);
    if (!pass) return;

    const { step, originScreen, start } = pass;
    const ops = rulerAxisOps(orientation, viewport, rect, originScreen, transform.scale);
    const minorStep = step / 5;
    const drawMinor = settings.showMinorTicks && minorStep >= RulerRenderer.MIN_MINOR_TICK_PIXELS;

    for (let pos = start; pos <= ops.limit; pos += step) {
      if (settings.showMajorTicks) {
        strokeTick(ctx, settings.majorTickColor, () => ops.tickPath(ctx, pos, settings.majorTickLength));
      }

      if (settings.showLabels && pos >= ops.minLabelPos) {
        // 🏢 ADR-462: number + unit follow the status-bar display-unit selector.
        ops.drawLabel(ctx, settings, formatCoordinateForDisplay(ops.world(pos), { withUnit: false }), pos);
      }

      if (!drawMinor) continue;
      for (let i = 1; i < 5; i++) {
        const minorPos = pos + i * minorStep;
        if (minorPos > ops.limit) continue;
        strokeTick(ctx, settings.minorTickColor, () => ops.tickPath(ctx, minorPos, settings.minorTickLength));
      }
    }
  }

  /**
   * Extract transform data από UI context (if available)
   */
  private getTransformData(context: UIRenderContext): { scale: number; offsetX: number; offsetY: number } | null {
    // 🎯 TYPE-SAFE: Check for worldTransform using extended context type
    const extendedContext = context as import('../core/UIRenderer').ExtendedUIRenderContext;

    // ✅ FIX: Check for worldTransform first (passed by UIRendererComposite)
    if (extendedContext.worldTransform) {
      return extendedContext.worldTransform;
    }

    // Fallback to transform (always available in base UIRenderContext)
    if (context.transform) {
      return context.transform;
    }

    return null;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): UIRenderMetrics {
    return {
      renderTime: this.lastRenderTime,
      drawCalls: this.renderCount,
      primitiveCount: 2, // Horizontal + vertical ruler
      memoryUsage: 0
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.renderCount = 0;
    this.lastRenderTime = 0;
  }

}