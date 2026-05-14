'use client';

import React from 'react';
import { ZoomControls } from '../../toolbar/ZoomControls';
import { useTransformScale } from '../../../systems/cursor/ImmediateTransformStore';
import { useRibbonCommand } from '../context/RibbonCommandContext';

export const ZoomControlsWidget: React.FC = () => {
  const scale = useTransformScale();
  const { onAction } = useRibbonCommand();

  return (
    <ZoomControls
      currentZoom={scale}
      onSetZoom={(zoom) => onAction('set-zoom', zoom)}
    />
  );
};
