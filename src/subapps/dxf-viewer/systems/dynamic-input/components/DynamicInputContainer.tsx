'use client';

import React, { ReactNode } from 'react';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
import type { Point2D } from '../../../rendering/types/Types';

interface DynamicInputContainerProps {
  position: Point2D;
  showInput: boolean;
  children: ReactNode;
}

export function DynamicInputContainer({ position, showInput, children }: DynamicInputContainerProps) {
  return (
    <div
      className={`absolute -translate-y-full ${showInput ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: portalComponents.overlay.controls.zIndex() + 90  // ✅ ENTERPRISE: Centralized z-index (1600)
      }}
    >
      <div className={`bg-transparent ${PANEL_LAYOUT.SPACING.MD} min-w-[220px]`}>
        {children}
      </div>
    </div>
  );
}