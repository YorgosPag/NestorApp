'use client';

import React from 'react';
import { ZoomControls } from '../../toolbar/ZoomControls';
// 🏢 ADR-418: real view-scale (1:N) micro-leaf — drives display + emits ratio
import { useViewScale } from '../../../systems/zoom/hooks/useViewScale';
import { useRibbonCommand } from '../context/RibbonCommandContext';

export const ZoomControlsWidget: React.FC = () => {
  const { ratioN } = useViewScale();
  const { onAction } = useRibbonCommand();

  return (
    <ZoomControls
      currentRatioN={ratioN}
      onSetRatio={(ratio) => onAction('set-view-ratio', ratio)}
    />
  );
};
