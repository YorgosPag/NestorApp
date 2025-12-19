'use client';

import React from 'react';
import { OverlayProperties } from '../OverlayProperties';
import { usePrecisionPositioning } from '../../utils/precision-positioning';
import { useDraggable } from '../../../../hooks/useDraggable';
import { Card, CardHeader, CardContent } from '../../../../components/ui/card';
import { Activity, X } from 'lucide-react';
import { performanceMonitorUtilities } from '../../../../styles/design-tokens/components/performance-tokens';
// Enterprise floating panel design tokens integration

interface DraggableOverlayPropertiesProps {
  overlay: any;
  onUpdate: (overlayId: string, updates: any) => void;
  onClose: () => void;
}

export const DraggableOverlayProperties: React.FC<DraggableOverlayPropertiesProps> = ({
  overlay,
  onUpdate,
  onClose
}) => {
  // CENTRALIZED PRECISION POSITIONING for initial placement
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { position: initialPosition } = usePrecisionPositioning(containerRef, {
    targetPoint: { x: 2550, y: 1230 },
    alignment: 'bottom-right',
    dependencies: [overlay]
  });

  // ✅ ENTERPRISE CENTRALIZED DRAGGING SYSTEM
  const draggable = useDraggable(true, {
    initialPosition: initialPosition || { x: 0, y: 0 },
    autoCenter: false, // Use precision positioning instead
    elementWidth: 320,
    elementHeight: 400,
    minPosition: { x: 0, y: 0 },
    maxPosition: {
      x: window.innerWidth - 320,
      y: window.innerHeight - 400
    }
  });

  // Update position when precision positioning changes
  React.useEffect(() => {
    if (initialPosition && !draggable.isDragging) {
      draggable.setPosition(initialPosition);
    }
  }, [initialPosition?.x, initialPosition?.y, draggable.isDragging]);

  // Sync refs for precision positioning compatibility
  React.useEffect(() => {
    if (draggable.elementRef.current) {
      containerRef.current = draggable.elementRef.current;
    }
  }, [draggable.elementRef.current]);

  return (
    <Card
      ref={draggable.elementRef}
      className={performanceMonitorUtilities.getOverlayContainerClasses()}
      style={{
        left: draggable.position?.x || 0,
        top: draggable.position?.y || 0,
        ...performanceMonitorUtilities.getOverlayContainerStyles()
      }}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      <CardHeader
        className={performanceMonitorUtilities.getOverlayHeaderClasses()}
        style={performanceMonitorUtilities.getOverlayHeaderStyles()}
        onMouseDown={draggable.handleMouseDown}
      >
        <div className="flex items-center gap-3 flex-1">
          <Activity className="h-4 w-4" style={performanceMonitorUtilities.getOverlayIconStyles('primary')} />
          <h3 className="text-sm font-semibold" style={performanceMonitorUtilities.getOverlayTitleStyles()}>Overlay Properties</h3>

          <div
            className="ml-auto cursor-grab transition-colors text-xs select-none"
            style={performanceMonitorUtilities.getOverlayIconStyles('secondary')}
            title="Drag to move"
            onMouseDown={draggable.handleMouseDown}
          >
            ⋮⋮
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={performanceMonitorUtilities.getOverlayButtonStyles()}
            title="Hide properties"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>

      <CardContent
        className="space-y-4"
        style={performanceMonitorUtilities.getOverlayContentStyles()}
      >
        <OverlayProperties
          overlay={overlay}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      </CardContent>
    </Card>
  );
};