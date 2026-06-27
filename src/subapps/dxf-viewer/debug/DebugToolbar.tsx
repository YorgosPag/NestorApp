'use client';

import React from 'react';
import {
  FlaskConical,
  Target,
  RefreshCw,
  Search,
  Building2,
  Ruler,
  Crosshair,
  Triangle,
  Eye,
  EyeOff,
  Home,
  Activity  // 🏢 ENTERPRISE: Performance Monitor icon
} from 'lucide-react';
// 🏢 ENTERPRISE: Unified Performance HUD toggle (ADR-366 §B.5.U) — same store the
// 3D Quality panel drives, so the PERF button and the 3D switch are one source.
import { usePerformanceHUDStore } from '../bim-3d/performance/PerformanceHUDStore';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { useIconSizes } from '@/hooks/useIconSizes';
import type { SceneModel } from '../types/scene';
import type { ToolType } from '../ui/toolbar/types';
import { runAllTests, formatReportForCopy, type UnifiedTestReport } from './unified-test-runner';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { useDebugToolbarShortcuts } from './useDebugToolbarShortcuts';
import type { DOMInspectionResult, EnterpriseCursorTestModule } from './debug-toolbar-types';

// Type definitions live in ./debug-toolbar-types.ts (CHECK 4 file-size SRP split).
// Window.runLayeringWorkflowTest is declared globally in src/types/window.d.ts.

interface DebugToolbarProps {
  showCopyableNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  showGrid: boolean;
  currentScene: SceneModel | null;
  activeTool: ToolType;
  handleToolChange: (tool: ToolType) => void;
  testModalOpen: boolean;
  setTestModalOpen: (open: boolean) => void;
  testReport: UnifiedTestReport | null;
  setTestReport: (report: UnifiedTestReport | null) => void;
  formattedTestReport: string;
  setFormattedTestReport: (report: string) => void;
  dxfCanvasVisible: boolean;
  setDxfCanvasVisible: (visible: boolean) => void;
  layerCanvasVisible: boolean;
  setLayerCanvasVisible: (visible: boolean) => void;
  panToWorldOrigin: () => void;
  showCalibration: boolean;
  handleCalibrationToggle: () => void;
}

export const DebugToolbar: React.FC<DebugToolbarProps> = ({
  showCopyableNotification,
  showGrid,
  currentScene,
  activeTool,
  handleToolChange,
  testModalOpen,
  setTestModalOpen,
  testReport,
  setTestReport,
  formattedTestReport,
  setFormattedTestReport,
  dxfCanvasVisible,
  setDxfCanvasVisible,
  layerCanvasVisible,
  setLayerCanvasVisible,
  panToWorldOrigin,
  showCalibration,
  handleCalibrationToggle
}) => {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const iconSizes = useIconSizes();  // 🏢 ENTERPRISE: Centralized icon sizing

  // 🏢 ENTERPRISE: Unified Performance HUD enabled state (ADR-366 §B.5.U) — reactive
  // read of the shared store (zero React state of its own; OFF by default).
  const perfMonitorEnabled = React.useSyncExternalStore(
    usePerformanceHUDStore.subscribe,
    () => usePerformanceHUDStore.getState().enabled,
    () => false,
  );
  // ⌨️ ENTERPRISE: Keyboard shortcuts (Ctrl+F2/Ctrl+Shift+T layering, F3 cursor)
  // extracted to ./useDebugToolbarShortcuts (centralized keyboard-shortcuts.ts).
  useDebugToolbarShortcuts(showCopyableNotification);

  return (
    <nav className={`flex ${PANEL_LAYOUT.GAP.SM} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${quick.card}`} role="toolbar" aria-label="Debug Tools">
      {/* Run All Tests Button */}
      <button
        onClick={async () => {
          console.log('🧪 RUN ALL TESTS TRIGGERED FROM HEADER');

          // Show loading notification
          showCopyableNotification('Running all tests... Please wait.', 'info');

          try {
            // Run all tests
            const report = await runAllTests();
            const formatted = formatReportForCopy(report);

            // Store results in state
            setTestReport(report);
            setFormattedTestReport(formatted);

            // Open modal
            setTestModalOpen(true);

            // Show quick summary notification
            const passRate = ((report.passed / report.totalTests) * 100).toFixed(0);
            showCopyableNotification(
              `Tests Complete: ${report.passed}✅ / ${report.failed}❌ (${passRate}% pass rate)\nClick modal for details`,
              report.failed === 0 ? 'success' : 'warning'
            );
          } catch (error) {
            console.error('Failed to run all tests:', error);
            showCopyableNotification('Failed to run all tests', 'error');
          }
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} bg-gradient-to-r from-purple-600 to-pink-600 ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.GRADIENT_PURPLE_PINK}`}
      >
        <FlaskConical className={iconSizes.xs} /> Run All Tests
      </button>

      {/* Canvas Alignment Test Button */}
      <button
        onClick={() => {
          console.log('🎯 MANUAL CANVAS ALIGNMENT TEST TRIGGERED FROM HEADER');
          import('./canvas-alignment-test').then(module => {
            const CanvasAlignmentTester = module.CanvasAlignmentTester;
            const alignmentResult = CanvasAlignmentTester.testCanvasAlignment();
            const zIndexResult = CanvasAlignmentTester.testCanvasZIndex();
            const greenBorder = CanvasAlignmentTester.findGreenBorder();

            console.log('🔍 DETAILED Z-INDEX DEBUG:', {
              alignmentResult,
              zIndexResult,
              greenBorder: !!greenBorder
            });

            // Direct DOM inspection
            const dxfEl = document.querySelector('canvas[data-canvas-type="dxf"]');
            const layerEl = document.querySelector('canvas[data-canvas-type="layer"]');
            console.log('🔍 DIRECT DOM INSPECTION:', {
              dxfCanvas: dxfEl ? {
                inlineStyle: (dxfEl as HTMLElement).style.cssText,
                computedZIndex: window.getComputedStyle(dxfEl).zIndex,
                computedPosition: window.getComputedStyle(dxfEl).position
              } : 'NOT FOUND',
              layerCanvas: layerEl ? {
                inlineStyle: (layerEl as HTMLElement).style.cssText,
                computedZIndex: window.getComputedStyle(layerEl).zIndex,
                computedPosition: window.getComputedStyle(layerEl).position
              } : 'NOT FOUND'
            });

            const testMessage = `Canvas Alignment: ${alignmentResult.isAligned ? '✅ OK' : '❌ MISALIGNED'}\nZ-Index Order: ${zIndexResult.isCorrectOrder ? '✅ OK' : '❌ WRONG'}\nGreen Border Found: ${greenBorder ? '✅ YES' : '❌ NO'}`;
            const allTestsPass = alignmentResult.isAligned && zIndexResult.isCorrectOrder && greenBorder;
            showCopyableNotification(testMessage, allTestsPass ? 'success' : 'warning');
          }).catch(err => {
            console.error('Failed to load CanvasAlignmentTester:', err);
            showCopyableNotification('Failed to load test module', 'error');
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.warning} ${colors.text.BLACK} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.WARNING_BUTTON}`}
      >
        <Target className={iconSizes.xs} /> Canvas Test
      </button>

      {/* Layering Workflow Test Button */}
      <button
        onClick={() => {
          console.log('🎯 LAYERING WORKFLOW TEST TRIGGERED FROM HEADER');
          import('./layering-workflow-test').then(module => {
            const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
            runLayeringWorkflowTest().then(result => {
              console.log('📊 LAYERING WORKFLOW RESULT:', result);
              const successSteps = result.steps.filter(s => s.status === 'success').length;
              const totalSteps = result.steps.length;
              const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;

              showCopyableNotification(summary, result.success ? 'success' : 'error');
            }).catch(err => {
              console.error('Failed to run layering workflow test:', err);
              showCopyableNotification('Failed to run workflow test', 'error');
            });
          }).catch(err => {
            console.error('Failed to load layering workflow test:', err);
            showCopyableNotification('Failed to load workflow test module', 'error');
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.success} ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_BUTTON}`}
      >
        <RefreshCw className={iconSizes.xs} /> Layering Test (Ctrl+F2)
      </button>

      {/* DOM Inspector Button */}
      <button
        onClick={() => {
          console.log('🔍 DOM INSPECTOR TRIGGERED FROM HEADER');
          import('./dom-inspector').then(module => {
            const { inspectDOMElements, findFloatingPanelAdvanced, showDetailedDOMInfo } = module;

            console.log('📋 Running complete DOM inspection...');
            const inspection = inspectDOMElements();

            console.log('🔍 Trying advanced floating panel detection...');
            const panel = findFloatingPanelAdvanced();

            console.log('📊 Showing detailed DOM info...');
            showDetailedDOMInfo();

            const typedInspection = inspection as DOMInspectionResult;
            const summary = `DOM Inspection Complete!\n\n` +
              `Floating Panels Found: ${typedInspection.floatingPanels.filter((p) => p.found).length}\n` +
              `Tabs Found: ${typedInspection.tabs.length}\n` +
              `Cards Found: ${typedInspection.cards.length}\n` +
              `Canvases Found: ${typedInspection.canvases.length}\n` +
              `Advanced Panel Detection: ${panel ? '✅ SUCCESS' : '❌ FAILED'}\n\n` +
              `Check console for detailed results.`;

            showCopyableNotification(summary, 'info');
          }).catch(err => {
            console.error('Failed to load DOM inspector:', err);
            showCopyableNotification('Failed to load DOM inspector', 'error');
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.info} ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`}
      >
        <Search className={iconSizes.xs} /> DOM Inspector
      </button>

      {/* Enterprise Cursor Test Button */}
      <button
        onClick={() => {
          console.log('🏢 ENTERPRISE CURSOR-CROSSHAIR ALIGNMENT TEST TRIGGERED');
          import('./enterprise-cursor-crosshair-test').then(module => {
            const defaultExport = module.default as EnterpriseCursorTestModule;
            const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = defaultExport;

            console.log('🔍 Running enterprise cursor-crosshair alignment tests...');
            const results = runEnterpriseMouseCrosshairTests();

            const summary = `Enterprise Test: ${results.overallStatus}
Scenarios: ${results.passedScenarios}/${results.totalScenarios} passed
Avg Performance: ${results.avgPerformance.toFixed(1)}ms
Max Error: ${results.maxError.toFixed(3)}px
Min Pass Rate: ${(results.minPassRate * 100).toFixed(1)}%

Check console for detailed metrics`;

            console.log('🎮 Starting enterprise interactive test - Move mouse over canvas, press ESC to stop');
            startEnterpriseInteractiveTest();

            showCopyableNotification(summary, results.overallStatus === 'PASS' ? 'success' : 'warning');
          }).catch(error => {
            console.error('Failed to load enterprise cursor-crosshair test:', error);
            showCopyableNotification('Failed to load enterprise cursor-crosshair test module', 'error');
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.info} ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`}
      >
        <Building2 className={iconSizes.xs} /> Enterprise Test (F3)
      </button>

      {/* Origin Markers Debug Button */}
      <button
        onClick={() => {
          console.log('🛠️ ORIGIN MARKERS DEBUG TOGGLE TRIGGERED');
          import('./OriginMarkersDebugOverlay').then(module => {
            const { originMarkersDebug } = module;

            const enabled = originMarkersDebug.toggle();

            if (typeof window !== 'undefined') {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('origin-markers-toggle', {
                  detail: { enabled }
                }));
              }, 50);
            }

            const originMessage = `Origin Markers: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\nMarkers ${enabled ? 'are now visible!' : 'are now hidden!'}`;
            showCopyableNotification(originMessage, enabled ? 'success' : 'info');
          }).catch(error => {
            console.error('Failed to load origin markers debug:', error);
            showCopyableNotification('Failed to load origin markers debug module', 'error');
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.warning} ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.WARNING_BUTTON}`}
      >
        <Target className={iconSizes.xs} /> Origin (0,0)
      </button>

      {/* Ruler Debug Button */}
      <button
        onClick={() => {
          console.log('🛠️ RULER DEBUG TOGGLE TRIGGERED');
          import('./RulerDebugOverlay').then(module => {
            const { rulerDebugOverlay } = module;

            const enabled = rulerDebugOverlay.toggle();

            if (typeof window !== 'undefined') {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('ruler-debug-toggle', {
                  detail: { enabled }
                }));
              }, 50);
            }

            const diagnostics = rulerDebugOverlay.getDiagnostics();
            const shortMessage = `Ruler Debug: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\n${enabled ? '🎯 Tick Markers: RED (major) / GREEN (minor)\n📐 Calibration Grid: CYAN 100mm grid\n🔍 Auto-verification: ACTIVE' : 'All debug overlays hidden'}`;

            showCopyableNotification(shortMessage, enabled ? 'success' : 'info');
            console.log(diagnostics);
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.info} ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`}
      >
        <Ruler className={iconSizes.xs} /> Rulers
      </button>

      {/* Calibration Toggle Button */}
      <button
        onClick={() => {
          console.log('🛠️ CALIBRATION TOGGLE TRIGGERED');
          handleCalibrationToggle();
          const status = showCalibration ? 'DISABLED' : 'ENABLED';
          showCopyableNotification(`Calibration panel ${status} ✅`, 'info');
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${PANEL_LAYOUT.TRANSITION.ALL} ${
          showCalibration
            ? `${colors.bg.info} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.CYAN}`
            : `${colors.bg.hover} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
        }`}
      >
        <Crosshair className={iconSizes.xs} /> Calibration {showCalibration ? 'ON' : 'OFF'}
      </button>

      {/* Cursor-Snap Alignment Debug Button */}
      <button
        onClick={() => {
          console.log('🎯 CURSOR-SNAP ALIGNMENT DEBUG TOGGLE');
          import('./CursorSnapAlignmentDebugOverlay').then(module => {
            const { cursorSnapAlignmentDebug } = module;
            const enabled = cursorSnapAlignmentDebug.toggle();

            const diagnostics = cursorSnapAlignmentDebug.getDiagnostics();
            console.log('📊 Alignment Diagnostics:', diagnostics);

            const message = enabled
              ? '🎯 Alignment Debug: ENABLED\n\n🔵 Blue = Cursor\n🟢 Green = Crosshair\n🔴 Red = Snap Marker\n\nΜετακίνησε τον cursor κοντά σε entity για snap,\nμετά ΚΑΝΕ CLICK για να καταγράψεις μετρήσεις!'
              : '🎯 Alignment Debug: DISABLED';

            showCopyableNotification(message, enabled ? 'success' : 'info');
          }).catch(error => {
            console.error('Failed to load alignment debug:', error);
            showCopyableNotification('Failed to load alignment debug module', 'error');
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.info} ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`}
      >
        <Target className={iconSizes.xs} /> Alignment
      </button>

      {/* Grid Enterprise Test Button */}
      <button
        onClick={() => {
          console.log('🎯 GRID ENTERPRISE TEST TRIGGERED FROM HEADER');
          import('./grid-enterprise-test').then(module => {
            const { runGridEnterpriseTests } = module;

            runGridEnterpriseTests().then(report => {
              console.log('📊 GRID ENTERPRISE TEST REPORT:', report);

              const summary = `Grid Enterprise Tests Complete!\n\n` +
                `✅ Passed: ${report.passed}/${report.totalTests}\n` +
                `❌ Failed: ${report.failed}\n` +
                `⚠️ Warnings: ${report.warnings}\n\n` +
                `🏗️ Topological Integrity: ${report.topologicalIntegrity.percentage.toFixed(0)}%\n` +
                `📏 Coordinate Precision: ${report.coordinatePrecision.withinTolerance ? '✅ OK' : '⚠️ WARNING'}\n` +
                `🎨 Grid Pixels Detected: ${report.canvasState.gridPixelsDetected}\n\n` +
                `Check console for detailed report.`;

              showCopyableNotification(
                summary,
                report.success ? 'success' : (report.failed > 0 ? 'error' : 'info')
              );
            }).catch(err => {
              console.error('Failed to run grid enterprise tests:', err);
              showCopyableNotification('Failed to run grid tests', 'error');
            });
          }).catch(err => {
            console.error('Failed to load grid enterprise test:', err);
            showCopyableNotification('Failed to load grid test module', 'error');
          });
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${PANEL_LAYOUT.TRANSITION.ALL} ${
          showGrid
            ? `${colors.bg.success} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.SUCCESS}`
            : `${colors.bg.hover} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
        }`}
      >
        <Triangle className={iconSizes.xs} /> Grid TEST
      </button>

      {/* Canvas Visibility Toggle Buttons */}
      <button
        onClick={() => {
          setDxfCanvasVisible(!dxfCanvasVisible);
          console.log('🎯 DxfCanvas visibility toggled:', !dxfCanvasVisible);
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${PANEL_LAYOUT.TRANSITION.ALL} ${
          dxfCanvasVisible
            ? `${colors.bg.success} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.SUCCESS}`
            : `${colors.bg.error} ${colors.text.WHITE} ${HOVER_BACKGROUND_EFFECTS.DESTRUCTIVE}`
        }`}
      >
        {dxfCanvasVisible ? <><Eye className={iconSizes.xs} /> DXF ON</> : <><EyeOff className={iconSizes.xs} /> DXF OFF</>}
      </button>

      <button
        onClick={() => {
          setLayerCanvasVisible(!layerCanvasVisible);
          console.log('🎯 LayerCanvas visibility toggled:', !layerCanvasVisible);
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${PANEL_LAYOUT.TRANSITION.ALL} ${
          layerCanvasVisible
            ? `${colors.bg.info} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`
            : `${colors.bg.error} ${colors.text.WHITE} ${HOVER_BACKGROUND_EFFECTS.DESTRUCTIVE}`
        }`}
      >
        {layerCanvasVisible ? <><Eye className={iconSizes.xs} /> LAYER ON</> : <><EyeOff className={iconSizes.xs} /> LAYER OFF</>}
      </button>

      {/* Pan to Origin (0,0) Button */}
      <button
        onClick={panToWorldOrigin}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${colors.bg.info} ${colors.text.inverted} ${PANEL_LAYOUT.TRANSITION.ALL} ${HOVER_BACKGROUND_EFFECTS.PRIMARY}`}
      >
        <Home className={iconSizes.xs} /> Pan to (0,0)
      </button>

      {/* 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern)
          - OFF by default for better performance
          - Available only in DXF Viewer (design tools)
          - State persisted in localStorage */}
      <button
        onClick={() => {
          const newState = !perfMonitorEnabled;
          usePerformanceHUDStore.getState().setEnabled(newState);
          showCopyableNotification(
            `Performance Monitor: ${newState ? 'ENABLED ✅' : 'DISABLED ❌'}\n\n${newState ? '📊 FPS, Memory, Render metrics now visible' : '⚡ Better performance - monitoring disabled'}`,
            newState ? 'success' : 'info'
          );
        }}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${PANEL_LAYOUT.TRANSITION.ALL} ${
          perfMonitorEnabled
            ? `bg-gradient-to-r from-orange-500 to-red-500 ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.GRADIENT_PURPLE_PINK}`
            : `${colors.bg.hover} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
        }`}
        title="Toggle Performance Monitor (Bentley/Autodesk pattern - OFF by default)"
      >
        <Activity className={iconSizes.xs} /> PERF {perfMonitorEnabled ? 'ON' : 'OFF'}
      </button>

      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.hover} ${colors.text.WHITE} ${PANEL_LAYOUT.SPACING.COMPACT} ${quick.button}`}>
        Debug Tools (Development Only)
      </div>
    </nav>
  );
};
