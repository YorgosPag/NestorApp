'use client';

import React, { ReactNode } from 'react';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { zIndex } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
import type { Point2D } from '../../../rendering/types/Types';

interface DynamicInputContainerProps {
  position: Point2D;
  showInput: boolean;
  children: ReactNode;
}

export function DynamicInputContainer({ position, showInput, children }: DynamicInputContainerProps) {
  return (
    <div
      className={`absolute -translate-y-full ${showInput ? `visible ${PANEL_LAYOUT.POINTER_EVENTS.AUTO}` : `invisible ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        // ADR-780 Φ.Γ: ήταν `controls.zIndex() + 90`, δηλαδή `popover + 10 + 90` = **1600**
        // — ΤΥΧΑΙΑ ισοβαθμία με τον ρόλο `skipLink`, μέσω ΔΙΠΛΗΣ αριθμητικής που κανένα
        // από τα δύο σημεία δεν έβλεπε. Σε ισοβαθμία τη σειρά την αποφασίζει το DOM.
        zIndex: zIndex.dynamicInput
      }}
    >
      <div className={`bg-transparent ${PANEL_LAYOUT.SPACING.MD} ${PANEL_LAYOUT.LAYOUT_DIMENSIONS.PANEL_MIN_WIDTH_SM}`}>
        {children}
      </div>
    </div>
  );
}