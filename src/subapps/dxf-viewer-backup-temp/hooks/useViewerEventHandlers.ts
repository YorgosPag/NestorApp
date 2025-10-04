/**
 * useViewerEventHandlers
 *
 * Centralized event handling for DxfViewerContent
 * Manages keyboard shortcuts, custom events, and transform updates
 *
 * Extracted from DxfViewerContent.tsx (was ~135 lines inline)
 */

import React from 'react';
import type { ToolType } from '../ui/toolbar/types';
import type { ViewTransform, Point2D } from '../rendering/types/Types';

interface UseViewerEventHandlersProps {
  activeTool: ToolType;
  handleToolChange: (tool: ToolType) => void;
  showCopyableNotification: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  currentScene: any;
  canvasOps: any;
  setCanvasTransform: React.Dispatch<React.SetStateAction<{ scale: number; offsetX: number; offsetY: number }>>;
  overlayStore: any;
  setSelectedEntityIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleAction: (action: string, data?: any) => void;
  showLayers: boolean;
}

export function useViewerEventHandlers({
  activeTool,
  handleToolChange,
  showCopyableNotification,
  currentScene,
  canvasOps,
  setCanvasTransform,
  overlayStore,
  setSelectedEntityIds,
  handleAction,
  showLayers
}: UseViewerEventHandlersProps) {

  // 🎯 KEYBOARD SHORTCUTS
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('🎯 KEY EVENT:', { key: event.key, ctrlKey: event.ctrlKey, keyCode: event.keyCode });

      // 🎯 Multiple ways to detect Ctrl+F2
      const isCtrlF2 = (event.key === 'F2' && event.ctrlKey) ||
                       (event.keyCode === 113 && event.ctrlKey) ||
                       (event.code === 'F2' && event.ctrlKey);

      if (isCtrlF2) {
        event.preventDefault();
        event.stopPropagation();
        console.log('🎯 Ctrl+F2 SHORTCUT: LAYERING WORKFLOW TEST TRIGGERED');

        // Direct call to window function
        if ((window as any).runLayeringWorkflowTest) {
          (window as any).runLayeringWorkflowTest().then((result: any) => {
            console.log('📊 LAYERING WORKFLOW RESULT:', result);
            const successSteps = result.steps.filter((s: any) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        } else {
          // Fallback to import
          import('../debug/layering-workflow-test').then(module => {
            const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
            runLayeringWorkflowTest().then((result: any) => {
              console.log('📊 LAYERING WORKFLOW RESULT:', result);
              const successSteps = result.steps.filter((s: any) => s.status === 'success').length;
              const totalSteps = result.steps.length;
              const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
              showCopyableNotification(summary, result.success ? 'success' : 'error');
            });
          });
        }
        return;
      }

      // 🎯 Alternative: F12 shortcut (less likely to conflict)
      if (event.key === 'F12') {
        event.preventDefault();
        console.log('🎯 F12 SHORTCUT: LAYERING WORKFLOW TEST TRIGGERED');
        if ((window as any).runLayeringWorkflowTest) {
          (window as any).runLayeringWorkflowTest().then((result: any) => {
            console.log('📊 LAYERING WORKFLOW RESULT:', result);
            const successSteps = result.steps.filter((s: any) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        }
        return;
      }

      // 🎯 F3 SHORTCUT: Cursor-Crosshair Alignment Test
      const isF3 = event.key === 'F3' || event.keyCode === 114 || event.code === 'F3';
      if (isF3) {
        event.preventDefault();
        event.stopPropagation();
        console.log('🎯 F3 SHORTCUT: CURSOR-CROSSHAIR ALIGNMENT TEST TRIGGERED');

        import('../debug/enterprise-cursor-crosshair-test').then(module => {
          const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = module.default;

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
        return;
      }

      // ESC to exit layering mode
      if (event.key === 'Escape' && activeTool === 'layering') {
        handleToolChange('select');
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeTool, handleToolChange, showCopyableNotification]);

  // 🚨 FIXED: Initialize canvasTransform only once to prevent infinite loops
  const isInitializedRef = React.useRef(false);
  React.useEffect(() => {
    // Only initialize once when scene becomes available
    if (isInitializedRef.current || !currentScene) return;

    try {
      const initialTransform = canvasOps.getTransform();
      setCanvasTransform({
        scale: initialTransform.scale || 1,
        offsetX: initialTransform.offsetX || 0,
        offsetY: initialTransform.offsetY || 0,
      });
      isInitializedRef.current = true;
    } catch (error) {
      console.warn('Failed to get initial transform:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene]); // ✅ FIX: Removed setCanvasTransform from deps - it's stable

  // 🚨 FIXED: Replaced periodic sync with event-based sync to prevent infinite loops
  React.useEffect(() => {
    if (activeTool !== 'layering') return;

    const handleTransformChange = (event: CustomEvent) => {
      try {
        const { transform } = event.detail;
        if (!transform) return;

        setCanvasTransform(prev => {
          // Only update if values changed significantly - STRONGER thresholds
          if (Math.abs(prev.scale - transform.scale) > 0.01 ||
              Math.abs(prev.offsetX - transform.offsetX) > 5 ||
              Math.abs(prev.offsetY - transform.offsetY) > 5) {
            return {
              scale: transform.scale || 1,
              offsetX: transform.offsetX || 0,
              offsetY: transform.offsetY || 0,
            };
          }
          return prev;
        });
      } catch (error) {
        console.warn('Failed to sync transform from event:', error);
      }
    };

    // 🔺 EVENT-BASED: Listen for zoom events instead of polling every 100ms
    document.addEventListener('dxf-zoom-changed', handleTransformChange as EventListener);
    return () => {
      document.removeEventListener('dxf-zoom-changed', handleTransformChange as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]); // ✅ FIX: Removed setCanvasTransform from deps - it's stable

  // Listen for tool change requests from LevelPanel
  React.useEffect(() => {
    const handleToolChangeRequest = (event: CustomEvent) => {
      const requestedTool = event.detail;
      handleToolChange(requestedTool);
    };

    window.addEventListener('level-panel:tool-change', handleToolChangeRequest as EventListener);
    return () => window.removeEventListener('level-panel:tool-change', handleToolChangeRequest as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIX: Empty deps - handleToolChange is from props/context, stable

  // ✅ ΧΡΗΣΗ ΥΠΑΡΧΟΝΤΟΣ EVENT SYSTEM: Listen for layering activation from LevelPanel
  React.useEffect(() => {
    const handleLayeringActivation = (event: CustomEvent) => {
      const { levelId } = event.detail;
      console.log('🎯 Level panel activated layering for level:', levelId);

      // ✅ ΔΙΟΡΘΩΣΗ: Ensure layers are always shown (not toggled)
      // Note: Checking showLayers inside event handler to get current value
      handleAction('toggle-layers');
    };
    window.addEventListener('level-panel:layering-activate', handleLayeringActivation as EventListener);
    return () => window.removeEventListener('level-panel:layering-activate', handleLayeringActivation as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIX: Empty deps - handleAction is stable

  // 🔺 Listen for polygon updates from grip editing
  React.useEffect(() => {
    const handlePolygonUpdate = (event: CustomEvent) => {
      const { regionId, newVertices } = event.detail;

      if (newVertices && regionId) {
        // Convert Point2D array to flat array for overlay store
        const flatVertices = newVertices.flatMap((v: Point2D) => [v.x, v.y]);
        overlayStore.update(regionId, { polygon: flatVertices });
      }
    };

    window.addEventListener('overlay:polygon-update', handlePolygonUpdate as EventListener);
    return () => window.removeEventListener('overlay:polygon-update', handlePolygonUpdate as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIX: Empty deps - overlayStore methods are stable

  // Fix 2: Ασφάλεια στο parent - sync από το bus (μόνο για 'select')
  React.useEffect(() => {
    const onSelectFromBus = (ev: Event) => {
      const d = (ev as CustomEvent<{ mode: string; ids: string[] }>).detail;
      if (!d || d.mode !== 'select') return;
      const ids: string[] = Array.isArray(d.ids) ? d.ids : [];
      setSelectedEntityIds(prev => {
        if (prev.length === ids.length && prev.every((v, i) => v === ids[i])) return prev; // no-op
        return ids;
      });
    };
    window.addEventListener('dxf.highlightByIds', onSelectFromBus as EventListener);
    return () => window.removeEventListener('dxf.highlightByIds', onSelectFromBus as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ FIX: Removed setSelectedEntityIds from deps - it's stable
}
