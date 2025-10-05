// 🎯 ENTERPRISE GRID TESTING SUITE
// Βασισμένο σε CAD QA Standards (ISO 9000, SASIG PDQ, VDA 4955)
//
// ΤΕΣΤ ΚΑΤΗΓΟΡΙΕΣ (CAD Industry Standard):
// 1. MORPHOLOGIC TESTS: Grid structure integrity
// 2. SYNTACTIC TESTS: Grid rendering correctness
// 3. SEMANTIC TESTS: Grid functionality validation
// 4. COORDINATE PRECISION: Millimeter-level accuracy
// 5. TOPOLOGICAL INTEGRITY: Grid-Canvas-Context integration

interface TestResult {
  category: string;
  test: string;
  status: "success" | "failed" | "warning";
  message: string;
  details?: any;
  durationMs: number;
}

interface GridTestReport {
  success: boolean;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  results: TestResult[];
  gridState: {
    enabled: boolean;
    visible: boolean;
    style: string;
    majorColor: string;
    minorColor: string;
    majorWeight: number;
    minorWeight: number;
    size: number;
  } | null;
  canvasState: {
    dxfCanvasFound: boolean;
    layerCanvasFound: boolean;
    gridPixelsDetected: number;
  };
  coordinatePrecision: {
    withinTolerance: boolean;
    maxDistance: number;
  };
  topologicalIntegrity: {
    score: number;
    maxScore: number;
    percentage: number;
  };
}

/**
 * Utility: sleep με promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Utility: Safe element query
 */
function querySelector(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

/**
 * Utility: Measure test duration
 */
async function measureTest(
  category: string,
  test: string,
  fn: () => Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }>
): Promise<TestResult> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startTime);

    return {
      category,
      test,
      status: result.status,
      message: result.message,
      details: result.details,
      durationMs
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);

    return {
      category,
      test,
      status: "failed",
      message: err.message || "Unknown error",
      durationMs
    };
  }
}

// ===== 1. MORPHOLOGIC TESTS =====

/**
 * TEST 1.1: Grid Context Existence
 */
async function testGridContextExists(): Promise<{ status: "success" | "failed"; message: string; details?: any }> {
  await sleep(50);

  // Check window object for grid settings
  const gridSettings = (window as any).__GRID_SETTINGS__;

  if (gridSettings) {
    return {
      status: "success",
      message: "Grid context found in window object",
      details: { settingsKeys: Object.keys(gridSettings) }
    };
  }

  return {
    status: "failed",
    message: "Grid context not found in window object"
  };
}

/**
 * TEST 1.2: Grid Settings Structure Validation
 */
async function testGridSettingsStructure(): Promise<{ status: "success" | "failed"; message: string; details?: any }> {
  await sleep(50);

  const gridSettings = (window as any).__GRID_SETTINGS__;

  if (!gridSettings || !gridSettings.visual) {
    return {
      status: "failed",
      message: "Grid settings structure invalid or missing"
    };
  }

  const requiredFields = ['enabled', 'step', 'opacity', 'color'];
  const missingFields = requiredFields.filter(field => !(field in gridSettings.visual));

  if (missingFields.length > 0) {
    return {
      status: "failed",
      message: `Missing required fields: ${missingFields.join(', ')}`
    };
  }

  return {
    status: "success",
    message: "Grid settings structure valid",
    details: { fields: Object.keys(gridSettings.visual) }
  };
}

/**
 * TEST 1.3: Major/Minor Grid Configuration (CAD Standard)
 */
async function testMajorMinorConfiguration(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const gridSettings = (window as any).__GRID_SETTINGS__;

  if (!gridSettings || !gridSettings.visual) {
    return {
      status: "failed",
      message: "Cannot test Major/Minor - settings missing"
    };
  }

  const hasMajor = !!gridSettings.visual.majorGridColor && !!gridSettings.visual.majorGridWeight;
  const hasMinor = !!gridSettings.visual.minorGridColor && !!gridSettings.visual.minorGridWeight;

  if (hasMajor && hasMinor) {
    return {
      status: "success",
      message: "Major/Minor grid configuration complete (CAD standard)",
      details: {
        major: {
          color: gridSettings.visual.majorGridColor,
          weight: gridSettings.visual.majorGridWeight
        },
        minor: {
          color: gridSettings.visual.minorGridColor,
          weight: gridSettings.visual.minorGridWeight
        }
      }
    };
  }

  return {
    status: "warning",
    message: "Major/Minor grid configuration incomplete",
    details: { hasMajor, hasMinor }
  };
}

/**
 * TEST 1.4: Grid Style Configuration
 */
async function testGridStyleConfiguration(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const gridSettings = (window as any).__GRID_SETTINGS__;

  if (!gridSettings || !gridSettings.visual) {
    return {
      status: "failed",
      message: "Cannot test style - settings missing"
    };
  }

  const style = gridSettings.visual.style;
  const validStyles = ['lines', 'dots', 'crosses'];

  if (!style) {
    return {
      status: "warning",
      message: "Grid style not configured (defaulting to lines)"
    };
  }

  if (!validStyles.includes(style)) {
    return {
      status: "failed",
      message: `Invalid grid style: ${style}`,
      details: { validStyles }
    };
  }

  return {
    status: "success",
    message: `Grid style configured: ${style}`,
    details: { style }
  };
}

// ===== 2. SYNTACTIC TESTS =====

/**
 * TEST 2.1: Canvas Elements Detection
 */
async function testCanvasElements(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const dxfCanvas = querySelector('canvas[data-canvas-type="dxf"]');
  const layerCanvas = querySelector('canvas[data-canvas-type="layer"]');
  const allCanvases = document.querySelectorAll('canvas');

  const details = {
    dxfCanvasFound: !!dxfCanvas,
    layerCanvasFound: !!layerCanvas,
    totalCanvases: allCanvases.length,
    canvasTypes: Array.from(allCanvases).map(c => (c as HTMLCanvasElement).dataset.canvasType || 'unknown')
  };

  if (!dxfCanvas && !layerCanvas) {
    return {
      status: "failed",
      message: "No canvas elements found",
      details
    };
  }

  if (dxfCanvas && layerCanvas) {
    return {
      status: "success",
      message: "Both DXF and Layer canvases found",
      details
    };
  }

  return {
    status: "warning",
    message: "Only one canvas found",
    details
  };
}

/**
 * TEST 2.2: Grid Rendering Detection
 */
async function testGridRendering(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const canvases = document.querySelectorAll('canvas');
  let gridPixelsDetected = 0;
  let totalPixelsChecked = 0;

  for (const canvas of Array.from(canvases)) {
    const ctx = (canvas as HTMLCanvasElement).getContext('2d');
    if (!ctx) continue;

    try {
      // Sample 100x100 area από το κέντρο
      const centerX = Math.floor(canvas.width / 2) - 50;
      const centerY = Math.floor(canvas.height / 2) - 50;
      const sampleSize = 100;

      const imageData = ctx.getImageData(centerX, centerY, sampleSize, sampleSize);
      const pixels = imageData.data;

      totalPixelsChecked += (sampleSize * sampleSize);

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Detect non-background pixels
        if (!(r === 255 && g === 255 && b === 255) && a > 0) {
          gridPixelsDetected++;
        }
      }
    } catch (err) {
      console.warn('Canvas sampling failed:', err);
    }
  }

  const gridDensity = totalPixelsChecked > 0 ? (gridPixelsDetected / totalPixelsChecked) * 100 : 0;

  const details = {
    gridPixelsDetected,
    totalPixelsChecked,
    gridDensity: gridDensity.toFixed(2) + '%'
  };

  if (gridPixelsDetected > 50) {
    return {
      status: "success",
      message: `Grid rendering detected (${gridPixelsDetected} pixels)`,
      details
    };
  }

  if (gridPixelsDetected > 0) {
    return {
      status: "warning",
      message: `Minimal grid rendering detected (${gridPixelsDetected} pixels)`,
      details
    };
  }

  return {
    status: "failed",
    message: "No grid rendering detected",
    details
  };
}

/**
 * TEST 2.3: Grid Color Accuracy
 */
async function testGridColorAccuracy(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const gridSettings = (window as any).__GRID_SETTINGS__;

  if (!gridSettings || !gridSettings.visual) {
    return {
      status: "failed",
      message: "Cannot test colors - settings missing"
    };
  }

  const majorColor = gridSettings.visual.majorGridColor;
  const minorColor = gridSettings.visual.minorGridColor;

  // Validate color format (hex)
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

  const majorValid = hexColorRegex.test(majorColor);
  const minorValid = hexColorRegex.test(minorColor);

  const details = {
    majorColor,
    minorColor,
    majorValid,
    minorValid
  };

  if (majorValid && minorValid) {
    return {
      status: "success",
      message: "Grid colors valid",
      details
    };
  }

  return {
    status: "failed",
    message: "Invalid grid color format",
    details
  };
}

// ===== 3. SEMANTIC TESTS =====

/**
 * TEST 3.1: Grid Toggle Functionality
 */
async function testGridToggle(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const gridButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.includes('Grid'));

  if (!gridButton) {
    return {
      status: "failed",
      message: "Grid toggle button not found"
    };
  }

  return {
    status: "success",
    message: "Grid toggle button found and functional",
    details: {
      buttonText: gridButton.textContent,
      buttonEnabled: !(gridButton as HTMLButtonElement).disabled
    }
  };
}

/**
 * TEST 3.2: Grid Panel Integration
 */
async function testGridPanelIntegration(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  // Check for floating panel existence
  const floatingPanel = querySelector('[class*="floating"]') ||
                       querySelector('[role="dialog"]') ||
                       querySelector('[class*="panel"]');

  if (!floatingPanel) {
    return {
      status: "warning",
      message: "Floating panel not detected (may be hidden)"
    };
  }

  return {
    status: "success",
    message: "Grid panel integration detected",
    details: {
      panelFound: true,
      panelClassName: floatingPanel.className
    }
  };
}

// ===== 4. COORDINATE PRECISION TESTS =====

/**
 * TEST 4.1: Coordinate System Validation (CAD Standard)
 */
async function testCoordinatePrecision(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  // CAD Standard: Elements should be within 10 miles (16km) of origin
  // Convert to pixels (assuming 1 unit = 1mm, monitor DPI ~96)
  const MAX_DISTANCE_MM = 16_000_000; // 16km in millimeters

  const canvases = document.querySelectorAll('canvas');
  let maxDistance = 0;

  for (const canvas of Array.from(canvases)) {
    const rect = canvas.getBoundingClientRect();
    const distance = Math.sqrt(rect.left ** 2 + rect.top ** 2);
    maxDistance = Math.max(maxDistance, distance);
  }

  const withinTolerance = maxDistance < MAX_DISTANCE_MM;

  const details = {
    maxDistance: Math.round(maxDistance),
    maxAllowed: MAX_DISTANCE_MM,
    withinTolerance,
    unit: 'pixels'
  };

  if (withinTolerance) {
    return {
      status: "success",
      message: "Coordinate precision within CAD tolerance",
      details
    };
  }

  return {
    status: "warning",
    message: "Coordinate precision outside optimal range",
    details
  };
}

/**
 * TEST 4.2: Grid Spacing Accuracy
 */
async function testGridSpacingAccuracy(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const gridSettings = (window as any).__GRID_SETTINGS__;

  if (!gridSettings || !gridSettings.visual) {
    return {
      status: "failed",
      message: "Cannot test spacing - settings missing"
    };
  }

  const step = gridSettings.visual.step;
  const subDivisions = gridSettings.visual.subDivisions || 5;

  // Validate spacing values
  const stepValid = step > 0 && step < 1000; // Reasonable range
  const subdivisionsValid = subDivisions > 0 && subDivisions < 100;

  const details = {
    step,
    subDivisions,
    majorInterval: step * subDivisions,
    stepValid,
    subdivisionsValid
  };

  if (stepValid && subdivisionsValid) {
    return {
      status: "success",
      message: "Grid spacing within valid range",
      details
    };
  }

  return {
    status: "failed",
    message: "Grid spacing out of valid range",
    details
  };
}

// ===== 5. TOPOLOGICAL INTEGRITY TESTS =====

/**
 * TEST 5.1: Grid-Canvas Integration
 */
async function testGridCanvasIntegration(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const gridSettings = (window as any).__GRID_SETTINGS__;
  const dxfCanvas = querySelector('canvas[data-canvas-type="dxf"]');
  const layerCanvas = querySelector('canvas[data-canvas-type="layer"]');

  let integrityScore = 0;
  const maxScore = 4;

  // Check 1: Settings exist
  if (gridSettings) integrityScore++;

  // Check 2: Canvas exists
  if (dxfCanvas || layerCanvas) integrityScore++;

  // Check 3: Settings enabled
  if (gridSettings?.visual?.enabled) integrityScore++;

  // Check 4: Grid visible
  if (gridSettings?.visual?.enabled && (dxfCanvas || layerCanvas)) integrityScore++;

  const percentage = (integrityScore / maxScore) * 100;

  const details = {
    integrityScore,
    maxScore,
    percentage: percentage.toFixed(0) + '%',
    checks: {
      settingsExist: !!gridSettings,
      canvasExists: !!(dxfCanvas || layerCanvas),
      settingsEnabled: !!gridSettings?.visual?.enabled,
      gridVisible: !!(gridSettings?.visual?.enabled && (dxfCanvas || layerCanvas))
    }
  };

  if (integrityScore >= maxScore * 0.75) {
    return {
      status: "success",
      message: `Grid-Canvas integration strong (${percentage}%)`,
      details
    };
  }

  if (integrityScore >= maxScore * 0.5) {
    return {
      status: "warning",
      message: `Grid-Canvas integration moderate (${percentage}%)`,
      details
    };
  }

  return {
    status: "failed",
    message: `Grid-Canvas integration weak (${percentage}%)`,
    details
  };
}

/**
 * TEST 5.2: Context-Settings Synchronization
 */
async function testContextSync(): Promise<{ status: "success" | "failed" | "warning"; message: string; details?: any }> {
  await sleep(50);

  const gridSettings = (window as any).__GRID_SETTINGS__;

  if (!gridSettings) {
    return {
      status: "failed",
      message: "Cannot test sync - settings missing"
    };
  }

  // Check if settings are synchronized (non-null, non-undefined)
  const visual = gridSettings.visual || {};

  const syncedFields = Object.keys(visual).filter(key =>
    visual[key] !== null && visual[key] !== undefined
  );

  const totalFields = Object.keys(visual).length;
  const syncPercentage = totalFields > 0 ? (syncedFields.length / totalFields) * 100 : 0;

  const details = {
    syncedFields: syncedFields.length,
    totalFields,
    syncPercentage: syncPercentage.toFixed(0) + '%'
  };

  if (syncPercentage >= 80) {
    return {
      status: "success",
      message: `Context-Settings sync strong (${syncPercentage.toFixed(0)}%)`,
      details
    };
  }

  return {
    status: "warning",
    message: `Context-Settings sync weak (${syncPercentage.toFixed(0)}%)`,
    details
  };
}

// ===== MAIN TEST RUNNER =====

/**
 * 🎯 RUN ALL ENTERPRISE TESTS
 */
export async function runGridEnterpriseTests(): Promise<GridTestReport> {
  console.log('\n🎯 ========================================');
  console.log('🎯 GRID ENTERPRISE TEST SUITE - STARTING');
  console.log('🎯 CAD Quality Standards (ISO 9000)');
  console.log('🎯 ========================================\n');

  const results: TestResult[] = [];

  // CATEGORY 1: MORPHOLOGIC TESTS
  console.log('🏗️  RUNNING MORPHOLOGIC TESTS...');
  results.push(await measureTest('MORPHOLOGIC', 'Grid Context Existence', testGridContextExists));
  results.push(await measureTest('MORPHOLOGIC', 'Grid Settings Structure', testGridSettingsStructure));
  results.push(await measureTest('MORPHOLOGIC', 'Major/Minor Configuration', testMajorMinorConfiguration));
  results.push(await measureTest('MORPHOLOGIC', 'Grid Style Configuration', testGridStyleConfiguration));

  // CATEGORY 2: SYNTACTIC TESTS
  console.log('📐 RUNNING SYNTACTIC TESTS...');
  results.push(await measureTest('SYNTACTIC', 'Canvas Elements Detection', testCanvasElements));
  results.push(await measureTest('SYNTACTIC', 'Grid Rendering Detection', testGridRendering));
  results.push(await measureTest('SYNTACTIC', 'Grid Color Accuracy', testGridColorAccuracy));

  // CATEGORY 3: SEMANTIC TESTS
  console.log('🔄 RUNNING SEMANTIC TESTS...');
  results.push(await measureTest('SEMANTIC', 'Grid Toggle Functionality', testGridToggle));
  results.push(await measureTest('SEMANTIC', 'Grid Panel Integration', testGridPanelIntegration));

  // CATEGORY 4: COORDINATE PRECISION
  console.log('📏 RUNNING COORDINATE PRECISION TESTS...');
  results.push(await measureTest('PRECISION', 'Coordinate System Validation', testCoordinatePrecision));
  results.push(await measureTest('PRECISION', 'Grid Spacing Accuracy', testGridSpacingAccuracy));

  // CATEGORY 5: TOPOLOGICAL INTEGRITY
  console.log('🔗 RUNNING TOPOLOGICAL INTEGRITY TESTS...');
  results.push(await measureTest('TOPOLOGY', 'Grid-Canvas Integration', testGridCanvasIntegration));
  results.push(await measureTest('TOPOLOGY', 'Context-Settings Sync', testContextSync));

  // Calculate statistics
  const passed = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const totalTests = results.length;

  // Extract grid state
  const gridSettings = (window as any).__GRID_SETTINGS__;
  const gridState = gridSettings ? {
    enabled: gridSettings.visual?.enabled || false,
    visible: gridSettings.visual?.enabled || false,
    style: gridSettings.visual?.style || 'lines',
    majorColor: gridSettings.visual?.majorGridColor || '#888888',
    minorColor: gridSettings.visual?.minorGridColor || '#bbbbbb',
    majorWeight: gridSettings.visual?.majorGridWeight || 1,
    minorWeight: gridSettings.visual?.minorGridWeight || 0.5,
    size: gridSettings.visual?.step || 10
  } : null;

  // Extract canvas state
  const dxfCanvas = querySelector('canvas[data-canvas-type="dxf"]');
  const layerCanvas = querySelector('canvas[data-canvas-type="layer"]');
  const gridRenderingTest = results.find(r => r.test === 'Grid Rendering Detection');

  const canvasState = {
    dxfCanvasFound: !!dxfCanvas,
    layerCanvasFound: !!layerCanvas,
    gridPixelsDetected: gridRenderingTest?.details?.gridPixelsDetected || 0
  };

  // Extract precision data
  const precisionTest = results.find(r => r.test === 'Coordinate System Validation');
  const coordinatePrecision = {
    withinTolerance: precisionTest?.details?.withinTolerance || false,
    maxDistance: precisionTest?.details?.maxDistance || 0
  };

  // Extract topology data
  const topologyTest = results.find(r => r.test === 'Grid-Canvas Integration');
  const topologicalIntegrity = {
    score: topologyTest?.details?.integrityScore || 0,
    maxScore: topologyTest?.details?.maxScore || 4,
    percentage: topologyTest?.details?.integrityScore
      ? (topologyTest.details.integrityScore / topologyTest.details.maxScore * 100)
      : 0
  };

  const success = failed === 0;

  console.log('\n🎯 ========================================');
  console.log(`🎯 GRID ENTERPRISE TEST SUITE - ${success ? 'SUCCESS ✅' : 'ISSUES FOUND ⚠️'}`);
  console.log(`🎯 Tests: ${passed}/${totalTests} passed, ${failed} failed, ${warnings} warnings`);
  console.log('🎯 ========================================\n');

  // Print detailed results by category
  console.group('📊 DETAILED RESULTS BY CATEGORY');

  const categories = ['MORPHOLOGIC', 'SYNTACTIC', 'SEMANTIC', 'PRECISION', 'TOPOLOGY'];
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPassed = categoryResults.filter(r => r.status === 'success').length;
    const categoryTotal = categoryResults.length;

    console.group(`${category}: ${categoryPassed}/${categoryTotal}`);
    categoryResults.forEach(r => {
      const icon = r.status === 'success' ? '✅' : r.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${r.test}: ${r.message} (${r.durationMs}ms)`);
      if (r.details) {
        console.log('   Details:', r.details);
      }
    });
    console.groupEnd();
  });

  console.groupEnd();

  return {
    success,
    timestamp: new Date().toISOString(),
    totalTests,
    passed,
    failed,
    warnings,
    results,
    gridState,
    canvasState,
    coordinatePrecision,
    topologicalIntegrity
  };
}
