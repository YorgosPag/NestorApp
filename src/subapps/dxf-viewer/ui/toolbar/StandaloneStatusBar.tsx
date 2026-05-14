'use client';

import React from 'react';
import type { ToolType } from './types';
import { ToolbarStatusBar } from './ToolbarStatusBar';
import { MobileToolbarLayout } from './MobileToolbarLayout';
import { useCurrentZoom } from '../../systems/zoom/ZoomStore';
import { useProSnapIntegration } from '../../hooks/common/useProSnapIntegration';
import { useCursor } from '../../systems/cursor';
import { useResponsiveLayout } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';

interface StandaloneStatusBarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void;
  commandCount?: number;
  onSidebarToggle?: () => void;
}

export const StandaloneStatusBar: React.FC<StandaloneStatusBarProps> = ({
  activeTool,
  onToolChange,
  onAction,
  commandCount,
  onSidebarToggle,
}) => {
  const currentZoom = useCurrentZoom();
  const { snapEnabled } = useProSnapIntegration();
  const { settings } = useCursor();
  const { layoutMode } = useResponsiveLayout();

  if (layoutMode !== 'desktop') {
    return (
      <>
        <MobileToolbarLayout
          activeTool={activeTool}
          onToolChange={onToolChange}
          onAction={onAction}
          commandCount={commandCount}
          onSidebarToggle={onSidebarToggle ?? (() => {})}
        />
        <ToolbarStatusBar
          activeTool={activeTool}
          currentZoom={currentZoom}
          snapEnabled={snapEnabled}
          compact
        />
      </>
    );
  }

  return (
    <ToolbarStatusBar
      activeTool={activeTool}
      currentZoom={currentZoom}
      snapEnabled={snapEnabled}
      commandCount={commandCount}
      showCoordinates={settings.behavior.coordinate_display}
    />
  );
};
