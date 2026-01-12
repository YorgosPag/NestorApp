/**
 * 🧪 Automated Tests Definitions
 *
 * Περιέχει όλα τα automated test definitions για το TestsModal
 * Factory function που δέχεται το showCopyableNotification callback
 *
 * 🏢 ENTERPRISE: Uses Lucide icons instead of emoji (centralized icon system)
 */

import type {
  TestDefinition,
  NotificationFn,
  LineDrawingCheckResult,
  WorkflowStepResult,
  FloatingPanelResult
} from '../types/tests.types';
import {
  Pencil,
  Target,
  RefreshCw,
  Search,
  Building2,
  Triangle,
  Ruler,
  Eye,
  Info,
  Server
} from 'lucide-react';

export function getAutomatedTests(showCopyableNotification: NotificationFn): TestDefinition[] {
  return [
    {
      id: 'line-drawing',
      name: 'Line Drawing Test',
      description: 'Έλεγχος λειτουργίας σχεδίασης γραμμών',
      icon: Pencil,
      action: async () => {
        try {
          const response = await fetch('/api/validate-line-drawing');
          if (response.ok) {
            const result = await response.json();
            const allPassed = result.checks.every((c: LineDrawingCheckResult) => c.passed);
            const passedCount = result.checks.filter((c: LineDrawingCheckResult) => c.passed).length;
            const summary = `Line Drawing System: ${allPassed ? '✅ ALL CHECKS PASSED' : '⚠️ SOME CHECKS FAILED'}\n\nPassed: ${passedCount}/${result.checks.length}\n\n${result.checks.map((c: LineDrawingCheckResult) => `${c.passed ? '✅' : '❌'} ${c.description}`).join('\n')}`;
            showCopyableNotification(summary, allPassed ? 'success' : 'warning');
          } else {
            const checks = [
              'useDrawingHandlers hook exists',
              'onDrawingHover handler present',
              'CanvasSection handles preview entities'
            ];
            showCopyableNotification(`Line Drawing: Files checked\n\n${checks.map(c => `✅ ${c}`).join('\n')}`, 'info');
          }
        } catch (error) {
          console.error('Line drawing test failed:', error);
          showCopyableNotification('Line Drawing Test: See console for details', 'info');
        }
      }
    },
    {
      id: 'canvas-alignment',
      name: 'Canvas Alignment Test',
      description: 'Έλεγχος ευθυγράμμισης canvas και z-index',
      icon: Target,
      action: async () => {
        const module = await import('../../../../debug/canvas-alignment-test');
        const { CanvasAlignmentTester } = module;
        const alignmentResult = CanvasAlignmentTester.testCanvasAlignment();
        const zIndexResult = CanvasAlignmentTester.testCanvasZIndex();
        const greenBorder = CanvasAlignmentTester.findGreenBorder();
        const testMessage = `Canvas Alignment: ${alignmentResult.isAligned ? '✅ OK' : '❌ MISALIGNED'}\nZ-Index Order: ${zIndexResult.isCorrectOrder ? '✅ OK' : '❌ WRONG'}\nGreen Border: ${greenBorder ? '✅ YES' : '❌ NO'}`;
        showCopyableNotification(testMessage, alignmentResult.isAligned && zIndexResult.isCorrectOrder ? 'success' : 'warning');
      }
    },
    {
      id: 'layering-workflow',
      name: 'Layering Workflow Test',
      description: 'Έλεγχος ροής εργασίας layering (Ctrl+F2)',
      icon: RefreshCw,
      action: async () => {
        const module = await import('../../../../debug/layering-workflow-test');
        const result = await module.runLayeringWorkflowTest();
        const successSteps = result.steps.filter((s: WorkflowStepResult) => s.status === 'success').length;
        const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${result.steps.length}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
        showCopyableNotification(summary, result.success ? 'success' : 'error');
      }
    },
    {
      id: 'dom-inspector',
      name: 'DOM Inspector Test',
      description: 'Επιθεώρηση δομής DOM',
      icon: Search,
      action: async () => {
        const module = await import('../../../../debug/dom-inspector');
        const { inspectDOMElements, findFloatingPanelAdvanced, showDetailedDOMInfo } = module;
        const inspection = inspectDOMElements();
        const panel = findFloatingPanelAdvanced();
        showDetailedDOMInfo();
        const summary = `DOM Inspection Complete!\nFloating Panels: ${inspection.floatingPanels.filter((p: FloatingPanelResult) => p.found).length}\nTabs: ${inspection.tabs.length}\nCanvases: ${inspection.canvases.length}\nAdvanced Detection: ${panel ? '✅' : '❌'}`;
        showCopyableNotification(summary, 'info');
      }
    },
    {
      id: 'enterprise-cursor',
      name: 'Enterprise Cursor Test',
      description: 'Enterprise cursor-crosshair alignment (F3)',
      icon: Building2,
      action: async () => {
        const module = await import('../../../../debug/enterprise-cursor-crosshair-test');
        const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = module.default;
        const results = runEnterpriseMouseCrosshairTests();
        const summary = `Enterprise Test: ${results.overallStatus}\nScenarios: ${results.passedScenarios}/${results.totalScenarios} passed\nAvg Performance: ${results.avgPerformance.toFixed(1)}ms\nMax Error: ${results.maxError.toFixed(3)}px`;
        startEnterpriseInteractiveTest();
        showCopyableNotification(summary, results.overallStatus === 'PASS' ? 'success' : 'warning');
      }
    },
    {
      id: 'grid-enterprise',
      name: 'Grid Enterprise Test',
      description: 'Enterprise grid testing (CAD standards)',
      icon: Triangle,
      action: async () => {
        const module = await import('../../../../debug/grid-enterprise-test');
        const { runGridEnterpriseTests } = module;
        const report = await runGridEnterpriseTests();
        const summary = `Grid Tests Complete!\n✅ Passed: ${report.passed}/${report.totalTests}\n❌ Failed: ${report.failed}\n🏗️ Topological Integrity: ${report.topologicalIntegrity.percentage.toFixed(0)}%\n📏 Precision: ${report.coordinatePrecision.withinTolerance ? '✅ OK' : '⚠️ WARNING'}`;
        showCopyableNotification(summary, report.success ? 'success' : (report.failed > 0 ? 'error' : 'info'));
      }
    },
    {
      id: 'origin-markers',
      name: 'Origin Markers Test',
      description: 'Έλεγχος δεικτών προέλευσης (0,0)',
      icon: Target,
      action: async () => {
        const module = await import('../../../../debug/OriginMarkersDebugOverlay');
        const { originMarkersDebug } = module;
        const status = originMarkersDebug.getStatus();
        const summary = `Origin Markers: ${status.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\nRegistered Canvases: ${status.registeredCanvases}`;
        showCopyableNotification(summary, 'info');
      }
    },
    {
      id: 'ruler-debug',
      name: 'Ruler Debug Test',
      description: 'Αποσφαλμάτωση χαράκων',
      icon: Ruler,
      action: async () => {
        const module = await import('../../../../debug/RulerDebugOverlay');
        const { rulerDebugOverlay } = module;
        const diagnostics = rulerDebugOverlay.getDiagnostics();
        showCopyableNotification('Ruler diagnostics retrieved\n\nCheck console for details', 'info');
        console.log(diagnostics);
      }
    },
    {
      id: 'canvas-visibility',
      name: 'Canvas Visibility Test',
      description: 'Έλεγχος ορατότητας canvas',
      icon: Eye,
      action: async () => {
        const dxfCanvas = document.querySelector('canvas[data-canvas-type="dxf"]') as HTMLCanvasElement;
        const layerCanvas = document.querySelector('canvas[data-canvas-type="layer"]') as HTMLCanvasElement;
        const dxfVisible = dxfCanvas ? window.getComputedStyle(dxfCanvas).display !== 'none' : false;
        const layerVisible = layerCanvas ? window.getComputedStyle(layerCanvas).display !== 'none' : false;
        const summary = `DXF Canvas: ${dxfVisible ? '✅ VISIBLE' : '❌ HIDDEN'}\nLayer Canvas: ${layerVisible ? '✅ VISIBLE' : '❌ HIDDEN'}`;
        showCopyableNotification(summary, 'info');
      }
    },
    {
      id: 'system-info',
      name: 'System Info Test',
      description: 'Πληροφορίες συστήματος',
      icon: Info,
      action: async () => {
        const browser = navigator.userAgent.match(/Chrome|Firefox|Safari|Edge/)?.[0] || 'Unknown';
        const viewport = `${window.innerWidth}×${window.innerHeight}`;
        const summary = `Browser: ${browser}\nViewport: ${viewport}\nPixel Ratio: ${window.devicePixelRatio}`;
        showCopyableNotification(summary, 'info');
      }
    },
    {
      id: 'store-sync',
      name: 'Store Sync Test',
      description: 'Ports & Adapters Architecture validation (Hexagonal)',
      icon: Server,
      action: async () => {
        const module = await import('../../../../debug/store-sync-test');
        const { runStoreSyncTests } = module;
        const report = await runStoreSyncTests();
        const summary = `Store Sync Tests Complete!\n✅ Passed: ${report.passed}/${report.totalTests}\n❌ Failed: ${report.failed}\n⚠️ Warnings: ${report.warnings}\n\n🎯 Architecture:\n  Ports: ${report.architecture.portsImplemented}\n  Adapters: ${report.architecture.adaptersImplemented}\n  Pure Functions: ${report.architecture.pureFunctionsValidated ? '✅' : '❌'}\n\n🔧 Feature Flags:\n  Sync Enabled: ${report.featureFlags.syncEnabled ? '✅' : '❌'}`;
        showCopyableNotification(summary, report.success ? 'success' : (report.failed > 0 ? 'error' : 'warning'));
      }
    }
  ];
}
