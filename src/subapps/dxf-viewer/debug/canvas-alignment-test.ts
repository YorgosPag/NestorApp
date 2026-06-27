// 🎯 ENTERPRISE CANVAS ALIGNMENT TEST
// Συνδυασμός CSS z-index, DOM order και Visual stacking με elementFromPoint

import { UI_COLORS } from '../config/color-config';

function getZIndexSafe(el: HTMLElement): number | "auto" {
  const z = getComputedStyle(el).zIndex;
  if (z === "auto") return "auto";
  const parsed = parseInt(z, 10);
  return Number.isNaN(parsed) ? "auto" : parsed;
}

/**
 * Visual stacking test: ελέγχει αν τα canvases είναι visible και accessible.
 *
 * ⚠️ ENTERPRISE NOTE: Δεν ελέγχουμε αν το canvas είναι "top element" γιατί
 * τα overlays (CrosshairOverlay, SnapIndicatorOverlay) ΠΡΕΠΕΙ να είναι πάνω
 * από τα canvases για σωστή λειτουργία. Ελέγχουμε μόνο z-index hierarchy.
 */
function verifyCanvasStacking(
  dxfCanvas: HTMLCanvasElement,
  layerCanvas: HTMLCanvasElement
) {
  const rect = dxfCanvas.getBoundingClientRect();
  const cx = Math.floor(rect.left + rect.width / 2);
  const cy = Math.floor(rect.top + rect.height / 2);

  const topElement = document.elementFromPoint(cx, cy);

  // ✅ ENTERPRISE: Ελέγχουμε αν τα canvases είναι ΟΡΑΤΑ (όχι αν είναι TOP)
  // Τα overlays (crosshair, snap) ΠΡΕΠΕΙ να είναι πάνω - αυτό είναι σωστό!
  const dxfVisible = dxfCanvas.offsetParent !== null &&
                     getComputedStyle(dxfCanvas).display !== 'none' &&
                     getComputedStyle(dxfCanvas).visibility !== 'hidden';

  const layerVisible = layerCanvas.offsetParent !== null &&
                       getComputedStyle(layerCanvas).display !== 'none' &&
                       getComputedStyle(layerCanvas).visibility !== 'hidden';

  // Ελέγχουμε αν το top element είναι canvas ή αναμενόμενο overlay
  const topElementTag = topElement?.tagName || 'UNKNOWN';
  const isOverlayOnTop = topElementTag === 'DIV' || topElementTag === 'SVG';
  const isCanvasOnTop = topElementTag === 'CANVAS';

  return {
    visuallyOnTop: layerVisible && dxfVisible, // Και τα δύο canvases είναι ορατά
    topElement: topElementTag,
    topElementIsOverlay: isOverlayOnTop,
    topElementIsCanvas: isCanvasOnTop,
    dxfVisible,
    layerVisible,
    coordsTested: { x: cx, y: cy },
  };
}

/**
 * Ολοκληρωμένος έλεγχος canvas stacking
 */
function checkCanvasStacking() {
  const dxfCanvas = document.querySelector<HTMLCanvasElement>(
    'canvas[data-canvas-type="dxf"]'
  );
  const layerCanvas = document.querySelector<HTMLCanvasElement>(
    'canvas[data-canvas-type="layer"]'
  );

  if (!dxfCanvas || !layerCanvas) {
    return {
      status: "ERROR",
      reason: "Canvas elements not found",
      dxfFound: !!dxfCanvas,
      layerFound: !!layerCanvas,
    };
  }

  // CSS values
  const dxfZ = getZIndexSafe(dxfCanvas);
  const layerZ = getZIndexSafe(layerCanvas);

  // DOM order
  const layerAfterDxf =
    (layerCanvas.compareDocumentPosition(dxfCanvas) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0;

  // Visual stacking
  const visualCheck = verifyCanvasStacking(dxfCanvas, layerCanvas);

  // ✅ ENTERPRISE: z-index hierarchy + visibility check.
  // ⚠️ ADR-040 Φ12 / canvas-ui.ts: ο DxfCanvas (zIndex.docked = 10, pointerEvents:'auto',
  // SOLE authoritative pointer handler) ΠΡΕΠΕΙ να στοιβάζεται ΠΑΝΩ από τον LayerCanvas
  // (zIndex.base = 0, read-only render layer, pointerEvents:'none'). Δηλαδή το ΣΩΣΤΟ
  // είναι dxf > layer — ΟΧΙ layer > dxf (αυτή ήταν παλιά, ανάποδη υπόθεση που έβγαζε
  // ψεύτικο WRONG). Τα overlays (crosshair/snap) είναι ξεχωριστά portals πάνω από τα δύο.
  let isCorrectOrder = false;
  let reason = "";

  // Ελέγχουμε αν τα canvases είναι ορατά
  const canvasesVisible = visualCheck.dxfVisible && visualCheck.layerVisible;

  // `layerAfterDxf === true` σημαίνει (compareDocumentPosition) ότι ο dxf ΑΚΟΛΟΥΘΕΙ τον
  // layer στο DOM → ο dxf στοιβάζεται πάνω όταν τα z-index είναι ίσα/auto.
  const dxfAfterLayerInDom = layerAfterDxf;

  if (dxfZ !== "auto" && layerZ !== "auto") {
    // Numeric z-index (το πραγματικό setup: dxf=docked=10, layer=base=0): dxf πρέπει > layer
    isCorrectOrder = dxfZ > layerZ && canvasesVisible;
    reason = `Z-index hierarchy ${dxfZ > layerZ ? "OK" : "WRONG"} (dxf:${dxfZ} > layer:${layerZ}) + canvases visible`;
  } else if (dxfZ === "auto" && layerZ === "auto") {
    // Και τα δύο auto: ο dxf πρέπει να είναι ΜΕΤΑ τον layer στο DOM (→ πάνω)
    isCorrectOrder = dxfAfterLayerInDom && canvasesVisible;
    reason = "Both auto; DXF after layer in DOM (dxf on top) + canvases visible";
  } else {
    // Mixed case: αν ο dxf έχει numeric z-index → πάνω· αλλιώς fallback σε DOM order
    isCorrectOrder = (dxfZ !== "auto" || dxfAfterLayerInDom) && canvasesVisible;
    reason = "Mixed z-index; dxf numeric on top OR DOM-order fallback + visibility";
  }

  const result = {
    status: isCorrectOrder ? "PASS" : "FAIL",
    reason,
    dxfZ,
    layerZ,
    dxfVisible: visualCheck.dxfVisible,
    layerVisible: visualCheck.layerVisible,
    topElement: visualCheck.topElement,
    topElementIsOverlay: visualCheck.topElementIsOverlay,
    coordsTested: visualCheck.coordsTested,
    domOrder: layerAfterDxf ? "dxf after layer (dxf on top)" : "layer after dxf (layer on top)",
    note: visualCheck.topElementIsOverlay
      ? "✅ Overlay on top (expected - crosshair/snap indicators)"
      : visualCheck.topElementIsCanvas
        ? "✅ Canvas on top"
        : "⚠️ Unknown element on top",
  };

  if (result.status === "PASS") {
    console.log("✅ CANVAS STACKING VERIFIED:", result);
  } else {
    console.warn("⚠️ CANVAS STACKING ISSUE:", result);
  }

  return result;
}

/**
 * Geometric alignment (bounding rect check)
 */
function checkGeometricAlignment() {
  const dxfCanvas = document.querySelector<HTMLCanvasElement>(
    'canvas[data-canvas-type="dxf"]'
  );
  const layerCanvas = document.querySelector<HTMLCanvasElement>(
    'canvas[data-canvas-type="layer"]'
  );

  if (!dxfCanvas || !layerCanvas) {
    return { status: "ERROR", reason: "Canvas elements not found" };
  }

  const dxfRect = dxfCanvas.getBoundingClientRect();
  const layerRect = layerCanvas.getBoundingClientRect();

  const tolerance = 1; // pixel tolerance
  const positionDiff = {
    x: Math.abs(dxfRect.x - layerRect.x),
    y: Math.abs(dxfRect.y - layerRect.y),
  };
  const sizeDiff = {
    width: Math.abs(dxfRect.width - layerRect.width),
    height: Math.abs(dxfRect.height - layerRect.height),
  };

  const isAligned =
    positionDiff.x <= tolerance &&
    positionDiff.y <= tolerance &&
    sizeDiff.width <= tolerance &&
    sizeDiff.height <= tolerance;

  const result = {
    status: isAligned ? "PASS" : "FAIL",
    positionDiff,
    sizeDiff,
    dxfRect,
    layerRect,
  };

  if (result.status === "PASS") {
    console.log("✅ GEOMETRIC ALIGNMENT OK:", result);
  } else {
    console.warn("⚠️ GEOMETRIC ALIGNMENT ISSUE:", result);
  }

  return result;
}

/**
 * Εντοπίζει πράσινο border (για layering mode)
 */
function findGreenBorder() {
  const elements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    const hasGreenBorder =
      style.borderColor.includes('green') ||
      style.borderColor.includes('lime') ||
      style.borderColor.includes(UI_COLORS.BRIGHT_GREEN.substring(0, 10)) ||
      style.backgroundColor.includes(`rgba(0, 255, 0,`);
    return hasGreenBorder;
  });

  const result = {
    status: elements.length > 0 ? "FOUND" : "NOT_FOUND",
    elements: elements.map(el => ({
      tagName: el.tagName,
      className: el.className,
      borderColor: getComputedStyle(el).borderColor,
      backgroundColor: getComputedStyle(el).backgroundColor
    }))
  };

  if (result.status === "FOUND") {
    console.log("✅ GREEN BORDER FOUND:", result);
  } else {
    console.log("ℹ️ GREEN BORDER NOT FOUND");
  }

  return result;
}

/**
 * Συγκεντρωτικό run όλων των tests
 */
export function runCanvasTests() {
  console.log("🔍 STARTING ENTERPRISE CANVAS TESTS...");

  const stackingTest = checkCanvasStacking();
  const geometricTest = checkGeometricAlignment();
  const greenBorderTest = findGreenBorder();

  const summary = {
    stacking: stackingTest.status,
    geometric: geometricTest.status,
    greenBorder: greenBorderTest.status,
    allPassed: stackingTest.status === "PASS" && geometricTest.status === "PASS",
  };

  console.log("📊 TEST SUMMARY:", summary);
  return summary;
}

/**
 * Legacy συμβατότητα
 */
export class CanvasAlignmentTester {
  static testCanvasAlignment() {
    const geom = checkGeometricAlignment();
    return {
      isAligned: geom.status === "PASS",
      dxfCanvas: ('dxfRect' in geom) ? geom.dxfRect : null,
      layerCanvas: ('layerRect' in geom) ? geom.layerRect : null,
      differences: {
        position: ('positionDiff' in geom) ? geom.positionDiff : null,
        size: ('sizeDiff' in geom) ? geom.sizeDiff : null,
      },
    };
  }

  static testCanvasZIndex() {
    const stack = checkCanvasStacking();
    return {
      dxfZIndex: ('dxfZ' in stack) ? (typeof stack.dxfZ === "number" ? stack.dxfZ : 0) : 0,
      layerZIndex: ('layerZ' in stack) ? (typeof stack.layerZ === "number" ? stack.layerZ : 0) : 0,
      isCorrectOrder: stack.status === "PASS",
    };
  }

  static findGreenBorder() {
    const greenTest = findGreenBorder();
    return greenTest.elements.length > 0 ? greenTest.elements[0] : null;
  }
}

export interface CanvasTestNotificationResult {
  /** Έτοιμο multi-line μήνυμα για showCopyableNotification */
  message: string;
  /** true μόνο αν alignment + z-index είναι σωστά (green border = informational) */
  passed: boolean;
}

/**
 * 🎯 SSoT: ΕΝΑ σημείο που τρέχει το canvas alignment + z-index + green-border test
 * και παράγει το notification payload (message + pass/fail). Καλείται ΚΑΙ από το
 * κουμπί «Canvas Test» του DebugToolbar ΚΑΙ από το Tests Modal → ΕΝΑ format, ΕΝΑ
 * pass/fail κριτήριο, μηδέν drift.
 *
 * ℹ️ Green border = debug-only visual για layering mode → informational, ΟΧΙ pass/fail.
 */
export function runCanvasAlignmentTestNotification(): CanvasTestNotificationResult {
  const alignmentResult = CanvasAlignmentTester.testCanvasAlignment();
  const zIndexResult = CanvasAlignmentTester.testCanvasZIndex();
  const greenBorder = CanvasAlignmentTester.findGreenBorder();

  // Diagnostics (πρώην inline μόνο στο DebugToolbar) — τώρα κεντρικά για ΟΛΑ τα call sites
  console.log('🔍 DETAILED Z-INDEX DEBUG:', {
    alignmentResult,
    zIndexResult,
    greenBorder: !!greenBorder,
  });
  const dxfEl = document.querySelector('canvas[data-canvas-type="dxf"]');
  const layerEl = document.querySelector('canvas[data-canvas-type="layer"]');
  console.log('🔍 DIRECT DOM INSPECTION:', {
    dxfCanvas: dxfEl ? {
      inlineStyle: (dxfEl as HTMLElement).style.cssText,
      computedZIndex: window.getComputedStyle(dxfEl).zIndex,
      computedPosition: window.getComputedStyle(dxfEl).position,
    } : 'NOT FOUND',
    layerCanvas: layerEl ? {
      inlineStyle: (layerEl as HTMLElement).style.cssText,
      computedZIndex: window.getComputedStyle(layerEl).zIndex,
      computedPosition: window.getComputedStyle(layerEl).position,
    } : 'NOT FOUND',
  });

  const message =
    `Canvas Alignment: ${alignmentResult.isAligned ? '✅ OK' : '❌ MISALIGNED'}\n` +
    `Z-Index Order: ${zIndexResult.isCorrectOrder ? '✅ OK' : '❌ WRONG'}\n` +
    `Green Border (layering mode): ${greenBorder ? '✅ active' : 'ℹ️ inactive'}`;

  // ⚠️ Green border ΔΕΝ μετράει στο pass/fail (debug-only visual για layering mode)
  const passed = alignmentResult.isAligned && zIndexResult.isCorrectOrder;

  return { message, passed };
}

// ✅ ENTERPRISE: Type-safe window extension
interface WindowWithCanvasTests extends Window {
  runCanvasTests: typeof runCanvasTests;
  CanvasAlignmentTester: typeof CanvasAlignmentTester;
}

// Expose στο window (type-safe)
(window as unknown as WindowWithCanvasTests).runCanvasTests = runCanvasTests;
(window as unknown as WindowWithCanvasTests).CanvasAlignmentTester = CanvasAlignmentTester;

export default CanvasAlignmentTester;