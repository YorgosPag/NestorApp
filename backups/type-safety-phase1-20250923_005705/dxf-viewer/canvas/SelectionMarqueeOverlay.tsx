import React, { memo } from 'react';
import { SelectionInstructions } from './selection-marquee/SelectionInstructions';
import { SelectionStatus } from './selection-marquee/SelectionStatus';
import { MarqueeRect } from './selection-marquee/MarqueeRect';
import { LassoPolygon } from './selection-marquee/LassoPolygon';
import { filterValidPoints } from './selection-marquee/utils';
import type { 
  SelectionMarqueeOverlayProps, 
  SelectionOverlayState,
  MarqueeKind 
} from './selection-marquee/types';

const SelectionMarqueeOverlay = memo<SelectionMarqueeOverlayProps>(({ 
  state, 
  className = '' 
}) => {
  const { marquee, lasso } = state || { 
    marquee: { active: false }, 
    lasso: { active: false, points: [] } 
  };

  // Show instructions when starting selection
  const showInstructions = (marquee?.active && !marquee.start) || 
                           (lasso?.active && lasso.points.length === 0);

  if (showInstructions) {
    return <SelectionInstructions className={className} />;
  }

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} style={{ zIndex: 2000 }}>
      {/* Marquee (Rectangle) Selection */}
      {marquee?.active && marquee.start && marquee.end && marquee.kind && (
        <MarqueeRect 
          start={marquee.start}
          end={marquee.end}
          kind={marquee.kind}
        />
      )}

      {/* Lasso (Polygon) Selection */}
      {lasso?.active && lasso.points.length > 1 && (
        <LassoPolygon 
          points={filterValidPoints(lasso.points)} 
        />
      )}

      {/* Status indicator */}
      <SelectionStatus 
        marquee={marquee}
        lasso={lasso}
      />
    </div>
  );
});

SelectionMarqueeOverlay.displayName = 'SelectionMarqueeOverlay';

export default SelectionMarqueeOverlay;
export type { SelectionOverlayState, MarqueeKind };