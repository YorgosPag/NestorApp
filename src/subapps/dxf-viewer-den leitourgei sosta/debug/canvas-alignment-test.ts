// 🎯 ENTERPRISE CANVAS ALIGNMENT TEST
// Συνδυασμός CSS z-index, DOM order και Visual stacking με elementFromPoint

function getZIndexSafe(el: HTMLElement): number | "auto" {
  const z = getComputedStyle(el).zIndex;
  if (z === "auto") return "auto";
  const parsed = parseInt(z, 10);
  return Number.isNaN(parsed) ? "auto" : parsed;
}

/**
 * Visual stacking test: ποιο στοιχείο είναι πραγματικά πάνω στο ίδιο pixel.
 */
function verifyCanvasStacking(
  dxfCanvas: HTMLCanvasElement,
  layerCanvas: HTMLCanvasElement
) {
  const rect = dxfCanvas.getBoundingClientRect();
  const cx = Math.floor(rect.left + rect.width / 2);
  const cy = Math.floor(rect.top + rect.height / 2);

  const topElement = document.elementFromPoint(cx, cy);
  const visuallyOnTop =
    topElement === layerCanvas || layerCanvas.contains(topElement);

  return {
    visuallyOnTop,
    topElement: topElement?.tagName,
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

  // Decision
  let isCorrectOrder = false;
  let reason = "";

  if (dxfZ === "auto" && layerZ === "auto") {
    isCorrectOrder = layerAfterDxf && visualCheck.visuallyOnTop;
    reason = "Both auto; using DOM order + visual stacking";
  } else if (dxfZ !== "auto" && layerZ !== "auto") {
    isCorrectOrder = layerZ > dxfZ && visualCheck.visuallyOnTop;
    reason = "Numeric z-index + visual stacking";
  } else {
    isCorrectOrder =
      (layerZ !== "auto" || layerAfterDxf) && visualCheck.visuallyOnTop;
    reason = "Mixed case; fallback to visual stacking";
  }

  const result = {
    status: isCorrectOrder ? "PASS" : "FAIL",
    reason,
    dxfZ,
    layerZ,
    visuallyOnTop: visualCheck.visuallyOnTop,
    topElement: visualCheck.topElement,
    coordsTested: visualCheck.coordsTested,
    domOrder: layerAfterDxf ? "layer after dxf" : "dxf after layer",
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
      style.borderColor.includes('rgb(0, 255') ||
      style.backgroundColor.includes('rgba(0, 255, 0,');
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

// Expose στο window
(window as any).runCanvasTests = runCanvasTests;
(window as any).CanvasAlignmentTester = CanvasAlignmentTester;

export default CanvasAlignmentTester;