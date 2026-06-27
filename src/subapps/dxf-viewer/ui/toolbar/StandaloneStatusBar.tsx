'use client';

import React from 'react';
import type { ToolType } from './types';
import { ToolbarStatusBar } from './ToolbarStatusBar';
import { MobileToolbarLayout } from './MobileToolbarLayout';
import { useProSnapIntegration } from '../../hooks/common/useProSnapIntegration';
import { useCursorSettings } from '../../systems/cursor';
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
  // 🏢 ADR-418/ADR-040: zoom is read by the StatusBarViewScaleLeaf micro-leaf inside
  // ToolbarStatusBar — this orchestrator no longer subscribes to zoom (no re-render per notch).
  const { snapEnabled } = useProSnapIntegration();
  // 🚀 PERF (2026-06-28, ADR-040): split settings context — no re-render on cursor activity.
  const { settings } = useCursorSettings();
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
          snapEnabled={snapEnabled}
          compact
        />
      </>
    );
  }

  return (
    <ToolbarStatusBar
      activeTool={activeTool}
      snapEnabled={snapEnabled}
      commandCount={commandCount}
      showCoordinates={settings.behavior.coordinate_display}
    />
  );
};
