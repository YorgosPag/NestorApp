'use client';

import React, { useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { OverlayProperties } from '../OverlayProperties';
import { useDraggable } from '../../../../hooks/useDraggable';
import { Card, CardHeader, CardContent } from '../../../../components/ui/card';
import { Activity, X } from 'lucide-react';
import { performanceMonitorUtilities } from '@/styles/design-tokens';
import type { Overlay, UpdateOverlayData } from '../../overlays/types';

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

interface DraggableOverlayPropertiesProps {
  overlay: Overlay;
  onUpdate: (overlayId: string, updates: UpdateOverlayData) => void;
  onClose: () => void;
}

// ============================================================================
// CONSTANTS - Enterprise Design Tokens
// ============================================================================

const PANEL_DIMENSIONS = {
  width: 340,
  height: 500,
  margin: 30
} as const;

// ============================================================================
// COMPONENT - Enterprise Draggable Pattern (Same as GlobalPerformanceDashboard)
// ============================================================================

export const DraggableOverlayProperties: React.FC<DraggableOverlayPropertiesProps> = ({
  overlay,
  onUpdate,
  onClose
}) => {
  const iconSizes = useIconSizes();

  // ✅ ENTERPRISE: Hydration safety (same pattern as GlobalPerformanceDashboard)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ ENTERPRISE: Calculate initial position on client only
  const getInitialPosition = () => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };
    return {
      x: window.innerWidth - PANEL_DIMENSIONS.width - PANEL_DIMENSIONS.margin,
      y: 100
    };
  };

  // ✅ ENTERPRISE CENTRALIZED DRAGGING SYSTEM
  // Destructure exactly like GlobalPerformanceDashboard
  const {
    position,
    isDragging,
    elementRef,
    handleMouseDown
  } = useDraggable(true, {
    initialPosition: getInitialPosition(),
    autoCenter: false,
    elementWidth: PANEL_DIMENSIONS.width,
    elementHeight: PANEL_DIMENSIONS.height,
    minPosition: { x: 0, y: 0 },
    maxPosition: {
      x: typeof window !== 'undefined' ? window.innerWidth - PANEL_DIMENSIONS.width : 1000,
      y: typeof window !== 'undefined' ? window.innerHeight - PANEL_DIMENSIONS.height : 400
    }
  });

  // ✅ ENTERPRISE: Draggable styles with smooth transition (same as GlobalPerformanceDashboard)
  const draggableStyles = mounted ? {
    left: position.x,
    top: position.y,
    transition: isDragging ? 'none' : 'left 0.2s ease, top 0.2s ease',
    ...performanceMonitorUtilities.getOverlayContainerStyles()
  } : undefined;

  // ✅ ENTERPRISE: Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <Card
      ref={elementRef}
      className={`${performanceMonitorUtilities.getOverlayContainerClasses()} w-[340px] ${isDragging ? 'cursor-grabbing select-none' : ''}`}
      style={draggableStyles}
    >
      <CardHeader
        className={performanceMonitorUtilities.getOverlayHeaderClasses()}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3 flex-1">
          <Activity className={`${iconSizes.sm} text-primary`} />
          <h3 className="text-sm font-semibold text-foreground">Overlay Properties</h3>

          {/* ✅ ENTERPRISE: Dedicated drag handle */}
          <div
            className="ml-auto cursor-grab transition-colors text-xs select-none text-muted-foreground hover:text-foreground"
            title="Drag to move"
            data-drag-handle="true"
            onMouseDown={handleMouseDown}
          >
            ⋮⋮
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Hide properties"
          >
            <X className={iconSizes.xs} />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <OverlayProperties
          overlay={overlay}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      </CardContent>
    </Card>
  );
};