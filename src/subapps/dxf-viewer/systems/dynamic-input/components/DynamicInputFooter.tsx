'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import type { Phase } from '../hooks/useDynamicInputState';

interface DynamicInputFooterProps {
  activeTool: string;
  drawingPhase: Phase;
}

export function DynamicInputFooter({ activeTool, drawingPhase }: DynamicInputFooterProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_SM} border-t ${quick.muted} ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
      <div className={`${colors.text.infoAccent} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}>
        {activeTool === 'line'
          ? drawingPhase === 'first-point'
            ? '🔐 Line (1st point): X→Y→°→L | ή X→Y→°(κενό)→Enter για 2ο σημείο'
            : '🔐 Line (2nd point): X→Y→Enter (complete line)'
          : '✅ Flow: X → Y → L → Enter (δημιουργεί σημείο)'
        }
      </div>
      <div className={`${colors.text.orangeLight} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
        {activeTool === 'line'
          ? '⚠️ 1ο σημείο: °+L = άμεση γραμμή | Κενό ° = 2ο σημείο | Angle: 0-360°'
          : '⚠️ Length: Μόνο θετικές τιμές (χωρίς μείον)'
        }
      </div>
      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.tertiary} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
        Tab: Επόμενο πεδίο | Enter: Εφαρμογή | Esc: Ακύρωση
      </div>
    </div>
  );
}