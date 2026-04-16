/**
 * ADR-176: Mobile Sidebar Drawer
 *
 * Wraps SidebarSection inside a Sheet (Radix Dialog) for off-canvas
 * navigation on mobile/tablet viewports. Desktop uses inline SidebarSection.
 *
 * @since 2026-02-12
 */

'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { SidebarSection } from './SidebarSection';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import type { SceneModel } from '../types/scene';
import type { DxfSaveContext } from '../services/dxf-firestore.service';

interface MobileSidebarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floatingRef: React.RefObject<FloatingPanelHandle>;
  currentScene: SceneModel | null;
  selectedEntityIds: string[];
  setSelectedEntityIds: (ids: string[]) => void;
  currentZoom: number;
  activeTool: string;
  // ADR-309 Phase 2: Wizard button in LevelPanel
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext) => void;
}

export const MobileSidebarDrawer: React.FC<MobileSidebarDrawerProps> = ({
  open,
  onOpenChange,
  floatingRef,
  currentScene,
  selectedEntityIds,
  setSelectedEntityIds,
  currentZoom,
  activeTool,
  onSceneImported,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-[384px] p-0"
        aria-label="DXF Viewer Sidebar"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>DXF Sidebar</SheetTitle>
          <SheetDescription>Panel navigation and layers</SheetDescription>
        </SheetHeader>
        <nav role="navigation" className="h-full">
          <SidebarSection
            variant="drawer"
            floatingRef={floatingRef}
            currentScene={currentScene}
            selectedEntityIds={selectedEntityIds}
            setSelectedEntityIds={setSelectedEntityIds}
            currentZoom={currentZoom}
            activeTool={activeTool}
            onSceneImported={onSceneImported}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
};

MobileSidebarDrawer.displayName = 'MobileSidebarDrawer';
