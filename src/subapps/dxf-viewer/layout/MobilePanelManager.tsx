/**
 * ADR-176: Mobile Panel Manager
 *
 * Single-active panel state machine for mobile/tablet viewports.
 * Each panel renders as Sheet side="bottom". Opening a new panel
 * closes the current one.
 *
 * @since 2026-02-12
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { SceneModel } from '../types/scene';
import type { OverlayEditorMode, OverlayKind, Status, Overlay } from '../overlays/types';
import type { ToolType } from '../ui/toolbar/types';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { ColorManager } from '../ui/components/ColorManager';
import CursorSettingsPanel from '../ui/CursorSettingsPanel';
import type { UnifiedTestReport } from '../debug/unified-test-runner';
import { TestResultsModal } from '../debug/TestResultsModal';

/** Available mobile panel types */
type MobilePanel = 'color' | 'cursor-settings' | 'test-results' | null;

interface MobilePanelManagerProps {
  colorMenu: { open: boolean; x: number; y: number; ids: string[] };
  currentScene: SceneModel | null;
  handleSceneChange: (scene: SceneModel) => void;
  closeColorMenu: () => void;
  floatingRef: React.RefObject<FloatingPanelHandle>;
  showCursorSettings: boolean;
  handleAction: (action: string) => void;
  testModalOpen: boolean;
  setTestModalOpen: (open: boolean) => void;
  testReport: UnifiedTestReport | null;
  formattedTestReport: string;
}

export const MobilePanelManager: React.FC<MobilePanelManagerProps> = ({
  colorMenu,
  currentScene,
  handleSceneChange,
  closeColorMenu,
  floatingRef,
  showCursorSettings,
  handleAction,
  testModalOpen,
  setTestModalOpen,
  testReport,
  formattedTestReport,
}) => {
  const [activePanel, setActivePanel] = useState<MobilePanel>(null);

  const openPanel = useCallback((panel: MobilePanel) => {
    setActivePanel(panel);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  // Sync color menu open state
  React.useEffect(() => {
    if (colorMenu.open) openPanel('color');
  }, [colorMenu.open, openPanel]);

  React.useEffect(() => {
    if (showCursorSettings) openPanel('cursor-settings');
  }, [showCursorSettings, openPanel]);

  return (
    <>
      {/* COLOR MANAGER — always rendered (has its own visibility logic) */}
      <ColorManager
        colorMenu={colorMenu}
        currentScene={currentScene}
        onSceneChange={handleSceneChange}
        onColorMenuClose={closeColorMenu}
        onExpandForSelection={(ids, scene) =>
          floatingRef.current?.expandForSelection(ids, scene)
        }
      />

      {/* CURSOR SETTINGS — bottom sheet on mobile */}
      <Sheet open={activePanel === 'cursor-settings'} onOpenChange={(open) => {
        if (!open) {
          closePanel();
          handleAction('toggle-cursor-settings');
        }
      }}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Cursor Settings</SheetTitle>
            <SheetDescription className="sr-only">Adjust cursor and crosshair settings</SheetDescription>
          </SheetHeader>
          <CursorSettingsPanel
            isVisible={true}
            onClose={() => {
              closePanel();
              handleAction('toggle-cursor-settings');
            }}
          />
        </SheetContent>
      </Sheet>

      {/* TEST RESULTS MODAL — uses existing modal on all viewports */}
      <TestResultsModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        report={testReport}
        formattedReport={formattedTestReport}
      />
    </>
  );
};

MobilePanelManager.displayName = 'MobilePanelManager';
