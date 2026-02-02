/**
 * 🧪 UNIFIED TEST RUNNER
 *
 * Enterprise-grade test orchestrator που εκτελεί όλα τα debug tests σειριακά
 * και επιστρέφει consolidated results για copy/paste debugging.
 *
 * @module unified-test-runner
 * @category Debug
 */

import type { Point2D } from '../rendering/types/Types';

// ============================================================================
// TYPES
// ============================================================================

export interface TestResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'info';
  duration: number; // milliseconds
  summary: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface UnifiedTestReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  totalDuration: number; // milliseconds
  tests: TestResult[];
  systemInfo: {
    viewport: { width: number; height: number };
    userAgent: string;
    timestamp: string;
  };
}

// ============================================================================
// TEST EXECUTION HELPERS
// ============================================================================

/**
 * Wrapper για ασφαλή εκτέλεση test με timeout protection
 */
async function safeExecuteTest(
  testName: string,
  testFunction: () => Promise<Record<string, unknown>>
): Promise<TestResult> {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();

  try {
    const result = await Promise.race([
      testFunction(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), 30000)
      )
    ]);

    const duration = performance.now() - startTime;
    const details = (result && typeof result === 'object')
      ? result as Record<string, unknown>
      : { value: result };

    return {
      name: testName,
      status: 'success',
      duration,
      summary: `✅ ${testName} completed successfully`,
      details,
      timestamp
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    const details = error instanceof Error
      ? { message: error.message }
      : { error: String(error) };
    return {
      name: testName,
      status: 'error',
      duration,
      summary: `❌ ${testName} failed: ${error instanceof Error ? error.message : String(error)}`,
      details,
      timestamp
    };
  }
}

// ============================================================================
// INDIVIDUAL TEST RUNNERS
// ============================================================================

/**
 * 1️⃣ Τεστ Ευθυγράμμισης Canvas
 */
async function runCanvasAlignmentTest(): Promise<TestResult> {
  return safeExecuteTest('Τεστ Ευθυγράμμισης Canvas', async () => {
    const module = await import('./canvas-alignment-test');
    const { CanvasAlignmentTester } = module;

    const alignmentResult = CanvasAlignmentTester.testCanvasAlignment();
    const zIndexResult = CanvasAlignmentTester.testCanvasZIndex();
    const greenBorder = CanvasAlignmentTester.findGreenBorder();

    const allPass = alignmentResult.isAligned && zIndexResult.isCorrectOrder && greenBorder;

    return {
      success: allPass,
      alignment: alignmentResult,
      zIndex: zIndexResult,
      greenBorder: !!greenBorder,
      summary: allPass ? 'Όλοι οι έλεγχοι πέρασαν' : 'Κάποιοι έλεγχοι απέτυχαν'
    };
  });
}

/**
 * 2️⃣ Τεστ Ροής Εργασίας Layering
 */
async function runLayeringWorkflowTest(): Promise<TestResult> {
  return safeExecuteTest('Τεστ Ροής Εργασίας Layering', async () => {
    const module = await import('./layering-workflow-test');
    const { runLayeringWorkflowTest } = module;

    const result = await runLayeringWorkflowTest();

    return {
      success: result.success,
      steps: result.steps,
      layerDisplayed: result.layerDisplayed,
      summary: `${result.steps.filter((s: { status: string }) => s.status === 'success').length}/${result.steps.length} βήματα πέρασαν`
    };
  });
}

/**
 * 3️⃣ Τεστ Επιθεώρησης DOM
 */
async function runDOMInspectorTest(): Promise<TestResult> {
  return safeExecuteTest('Τεστ Επιθεώρησης DOM', async () => {
    const module = await import('./dom-inspector');
    const { inspectDOMElements, findFloatingPanelAdvanced } = module;

    const inspection = inspectDOMElements();
    const panel = findFloatingPanelAdvanced();

    return {
      floatingPanelsFound: inspection.floatingPanels.filter((p: { found: boolean }) => p.found).length,
      tabsFound: inspection.tabs.length,
      cardsFound: inspection.cards.length,
      canvasesFound: inspection.canvases.length,
      advancedPanelDetection: !!panel,
      summary: `Βρέθηκαν ${inspection.canvases.length} canvases, ${inspection.tabs.length} καρτέλες`
    };
  });
}

/**
 * 4️⃣ Enterprise Τεστ Δρομέα-Σταυρονήματος
 */
async function runEnterpriseCursorCrosshairTest(): Promise<TestResult> {
  return safeExecuteTest('Enterprise Τεστ Δρομέα-Σταυρονήματος', async () => {
    const module = await import('./enterprise-cursor-crosshair-test');
    const { runEnterpriseMouseCrosshairTests } = module.default;

    const results = runEnterpriseMouseCrosshairTests();

    return {
      overallStatus: results.overallStatus,
      passedScenarios: results.passedScenarios,
      totalScenarios: results.totalScenarios,
      avgPerformance: results.avgPerformance,
      maxError: results.maxError,
      minPassRate: results.minPassRate,
      summary: `${results.passedScenarios}/${results.totalScenarios} σενάρια πέρασαν (${results.overallStatus})`
    };
  });
}

/**
 * 5️⃣ Enterprise Τεστ Πλέγματος
 */
async function runGridEnterpriseTest(): Promise<TestResult> {
  return safeExecuteTest('Enterprise Τεστ Πλέγματος', async () => {
    const module = await import('./grid-enterprise-test');
    const { runGridEnterpriseTests } = module;

    const report = await runGridEnterpriseTests();

    return {
      success: report.success,
      passed: report.passed,
      failed: report.failed,
      warnings: report.warnings,
      topologicalIntegrity: report.topologicalIntegrity.percentage,
      coordinatePrecision: report.coordinatePrecision.withinTolerance,
      gridPixelsDetected: report.canvasState.gridPixelsDetected,
      summary: `${report.passed}/${report.totalTests} τεστ πέρασαν, ${report.topologicalIntegrity.percentage.toFixed(0)}% ακεραιότητα`
    };
  });
}

/**
 * 6️⃣ Έλεγχος Κατάστασης Δεικτών Προέλευσης
 */
async function runOriginMarkersTest(): Promise<TestResult> {
  return safeExecuteTest('Κατάσταση Δεικτών Προέλευσης', async () => {
    const module = await import('./OriginMarkersDebugOverlay');
    const { originMarkersDebug } = module;

    const status = originMarkersDebug.getStatus();

    return {
      enabled: status.enabled,
      registeredCanvases: status.registeredCanvases,
      summary: `Δείκτες προέλευσης είναι ${status.enabled ? 'ΕΝΕΡΓΟΙ' : 'ΑΝΕΝΕΡΓΟΙ'} (${status.registeredCanvases} canvases)`
    };
  });
}

/**
 * 7️⃣ Έλεγχος Κατάστασης Αποσφαλμάτωσης Χαράκων
 */
async function runRulerDebugTest(): Promise<TestResult> {
  return safeExecuteTest('Κατάσταση Αποσφαλμάτωσης Χαράκων', async () => {
    const module = await import('./RulerDebugOverlay');
    const { rulerDebugOverlay } = module;

    const diagnostics = rulerDebugOverlay.getDiagnostics();
    const diagnosticText = typeof diagnostics === 'string' ? diagnostics : JSON.stringify(diagnostics);

    return {
      diagnostics: diagnosticText,
      summary: `Διαγνωστικά αποσφαλμάτωσης χαράκων ανακτήθηκαν επιτυχώς`
    };
  });
}

/**
 * 8️⃣ Κατάσταση Ορατότητας Canvas
 */
async function runCanvasVisibilityTest(): Promise<TestResult> {
  return safeExecuteTest('Κατάσταση Ορατότητας Canvas', async () => {
    const dxfCanvas = document.querySelector('canvas[data-canvas-type="dxf"]') as HTMLCanvasElement;
    const layerCanvas = document.querySelector('canvas[data-canvas-type="layer"]') as HTMLCanvasElement;

    const dxfVisible = dxfCanvas ? window.getComputedStyle(dxfCanvas).display !== 'none' : false;
    const layerVisible = layerCanvas ? window.getComputedStyle(layerCanvas).display !== 'none' : false;

    return {
      dxfCanvasVisible: dxfVisible,
      layerCanvasVisible: layerVisible,
      dxfCanvasFound: !!dxfCanvas,
      layerCanvasFound: !!layerCanvas,
      summary: `DXF: ${dxfVisible ? '✅ ON' : '❌ OFF'}, Layer: ${layerVisible ? '✅ ON' : '❌ OFF'}`
    };
  });
}

/**
 * 9️⃣ Κατάσταση Μετασχηματισμού & Viewport
 */
async function runTransformStatusTest(): Promise<TestResult> {
  return safeExecuteTest('Κατάσταση Μετασχηματισμού & Viewport', async () => {
    const canvasElement = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    if (!canvasElement) {
      throw new Error('Canvas not found');
    }

    const rect = canvasElement.getBoundingClientRect();
    // 🏢 ENTERPRISE: Type assertion for window global (debug only)
    interface DxfTransform { scale: number; offsetX: number; offsetY: number; }
    const debugWin = window as Window & { dxfTransform?: DxfTransform };
    const transform = debugWin.dxfTransform || { scale: 1, offsetX: 0, offsetY: 0 };

    return {
      viewport: {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
      },
      transform: {
        scale: transform.scale,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY
      },
      summary: `Viewport: ${rect.width.toFixed(0)}×${rect.height.toFixed(0)}, Zoom: ${(transform.scale * 100).toFixed(0)}%`
    };
  });
}

/**
 * 🔟 Τεστ Πληροφοριών Συστήματος
 */
async function runSystemInfoTest(): Promise<TestResult> {
  return safeExecuteTest('Πληροφορίες Συστήματος', async () => {
    const canvasElement = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    const rect = canvasElement?.getBoundingClientRect();

    return {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      canvasSize: rect ? {
        width: rect.width,
        height: rect.height
      } : null,
      timestamp: new Date().toISOString(),
      summary: `Browser: ${navigator.userAgent.match(/Chrome|Firefox|Safari|Edge/)?.[0] || 'Unknown'}, Viewport: ${window.innerWidth}×${window.innerHeight}`
    };
  });
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * 🧪 RUN ALL TESTS
 *
 * Εκτελεί όλα τα debug tests σειριακά και επιστρέφει consolidated report.
 */
export async function runAllTests(): Promise<UnifiedTestReport> {
  console.log('🧪 ============================================');
  console.log('🧪 ΕΝΙΑΙΟ ΣΥΣΤΗΜΑ ΕΚΤΕΛΕΣΗΣ ΤΕΣΤ - ΕΝΑΡΞΗ');
  console.log('🧪 ============================================');

  const startTime = performance.now();
  const timestamp = new Date().toISOString();

  // Εκτέλεση όλων των tests σειριακά
  const tests: TestResult[] = [];

  console.log('\n1️⃣ Εκτέλεση Τεστ Ευθυγράμμισης Canvas...');
  tests.push(await runCanvasAlignmentTest());

  console.log('\n2️⃣ Εκτέλεση Τεστ Ροής Εργασίας Layering...');
  tests.push(await runLayeringWorkflowTest());

  console.log('\n3️⃣ Εκτέλεση Τεστ Επιθεώρησης DOM...');
  tests.push(await runDOMInspectorTest());

  console.log('\n4️⃣ Εκτέλεση Enterprise Τεστ Δρομέα-Σταυρονήματος...');
  tests.push(await runEnterpriseCursorCrosshairTest());

  console.log('\n5️⃣ Εκτέλεση Enterprise Τεστ Πλέγματος...');
  tests.push(await runGridEnterpriseTest());

  console.log('\n6️⃣ Εκτέλεση Τεστ Δεικτών Προέλευσης...');
  tests.push(await runOriginMarkersTest());

  console.log('\n7️⃣ Εκτέλεση Τεστ Αποσφαλμάτωσης Χαράκων...');
  tests.push(await runRulerDebugTest());

  console.log('\n8️⃣ Εκτέλεση Τεστ Ορατότητας Canvas...');
  tests.push(await runCanvasVisibilityTest());

  console.log('\n9️⃣ Εκτέλεση Τεστ Μετασχηματισμού & Viewport...');
  tests.push(await runTransformStatusTest());

  console.log('\n🔟 Εκτέλεση Τεστ Πληροφοριών Συστήματος...');
  tests.push(await runSystemInfoTest());

  const totalDuration = performance.now() - startTime;

  // Calculate statistics
  const passed = tests.filter(t => t.status === 'success').length;
  const failed = tests.filter(t => t.status === 'error').length;
  const warnings = tests.filter(t => t.status === 'warning').length;

  // Get system info
  const canvasElement = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
  const rect = canvasElement?.getBoundingClientRect();

  const report: UnifiedTestReport = {
    timestamp,
    totalTests: tests.length,
    passed,
    failed,
    warnings,
    totalDuration,
    tests,
    systemInfo: {
      viewport: {
        width: rect?.width || window.innerWidth,
        height: rect?.height || window.innerHeight
      },
      userAgent: navigator.userAgent,
      timestamp
    }
  };

  console.log('\n🧪 ============================================');
  console.log('🧪 ΕΝΙΑΙΟ ΣΥΣΤΗΜΑ ΕΚΤΕΛΕΣΗΣ ΤΕΣΤ - ΟΛΟΚΛΗΡΩΣΗ');
  console.log('🧪 ============================================');
  console.log(`✅ Επιτυχία: ${passed}/${tests.length}`);
  console.log(`❌ Αποτυχία: ${failed}/${tests.length}`);
  console.log(`⚠️ Προειδοποιήσεις: ${warnings}/${tests.length}`);
  console.log(`⏱️ Συνολική Διάρκεια: ${totalDuration.toFixed(0)}ms`);
  console.log('🧪 ============================================\n');

  return report;
}

/**
 * 📋 FORMAT REPORT FOR COPY/PASTE
 *
 * Converts report to human-readable text format for easy copy/paste.
 */
export function formatReportForCopy(report: UnifiedTestReport): string {
  const lines: string[] = [];

  lines.push('🧪 ============================================');
  lines.push('🧪 ΕΝΙΑΙΟ ΣΥΣΤΗΜΑ ΕΚΤΕΛΕΣΗΣ ΤΕΣΤ - ΠΛΗΡΗΣ ΑΝΑΦΟΡΑ');
  lines.push('🧪 ============================================');
  lines.push('');
  lines.push(`📅 Χρονοσήμανση: ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`⏱️ Συνολική Διάρκεια: ${report.totalDuration.toFixed(0)}ms`);
  lines.push(`📊 Αποτελέσματα: ${report.passed}✅ / ${report.failed}❌ / ${report.warnings}⚠️ (${report.totalTests} σύνολο)`);
  lines.push('');
  lines.push('🖥️ ΠΛΗΡΟΦΟΡΙΕΣ ΣΥΣΤΗΜΑΤΟΣ:');
  lines.push(`  • Viewport: ${report.systemInfo.viewport.width}×${report.systemInfo.viewport.height}`);
  lines.push(`  • User Agent: ${report.systemInfo.userAgent}`);
  lines.push('');
  lines.push('📋 ΑΠΟΤΕΛΕΣΜΑΤΑ ΤΕΣΤ:');
  lines.push('');

  report.tests.forEach((test, index) => {
    const icon = test.status === 'success' ? '✅' : test.status === 'error' ? '❌' : test.status === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`${index + 1}. ${icon} ${test.name}`);
    lines.push(`   Διάρκεια: ${test.duration.toFixed(0)}ms`);
    lines.push(`   Περίληψη: ${test.summary}`);
    if (test.details) {
      lines.push(`   Λεπτομέρειες: ${JSON.stringify(test.details, null, 2).split('\n').join('\n   ')}`);
    }
    lines.push('');
  });

  lines.push('🧪 ============================================');
  lines.push('🧪 ΤΕΛΟΣ ΑΝΑΦΟΡΑΣ');
  lines.push('🧪 ============================================');

  return lines.join('\n');
}
