'use client';

import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

interface DynamicInputHeaderProps {
  activeTool: string;
}

export function DynamicInputHeader({ activeTool }: DynamicInputHeaderProps) {
  const colors = useSemanticColors();
  return (
    <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
      Δυναμική Εισαγωγή ({activeTool})
    </div>
  );
}