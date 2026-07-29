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
  activeTool: string;
  // ADR-309 Phase 2: Wizard button in LevelPanel
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => void;
}

export const MobileSidebarDrawer: React.FC<MobileSidebarDrawerProps> = ({
  open,
  onOpenChange,
  floatingRef,
  currentScene,
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
          {/*
            ADR-724 Φ1: το πλάτος δεν έρχεται από το `variant` — η παλέτα γεμίζει ό,τι της δώσει
            ο γονέας της, και εδώ ο γονέας είναι το `SheetContent` (`w-[85vw] max-w-[384px]`).
            ADR-724 Φ3: το `variant` επέστρεψε, αλλά δηλώνει **ποιος είναι το εξωτερικό δοχείο**.
            Εδώ είναι το συρτάρι — και είναι **σταθερό**: το dock system είναι desktop-only
            (§4.5), οπότε αυτή η τιμή δεν εξαρτάται ποτέ από το `mode` του store.
          */}
          <SidebarSection
            variant="drawer"
            floatingRef={floatingRef}
            currentScene={currentScene}
            activeTool={activeTool}
            onSceneImported={onSceneImported}
          />
        </nav>
      </SheetContent>
    </Sheet>
  );
};

MobileSidebarDrawer.displayName = 'MobileSidebarDrawer';
