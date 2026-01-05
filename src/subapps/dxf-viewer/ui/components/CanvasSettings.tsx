'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

interface CanvasSettingsProps {
  className?: string;
}

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({ className }) => {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <div className={`${colors.bg.primary} ${colors.text.primary} ${className}`}>
      <div className={PANEL_LAYOUT.SPACING.LG}>
        {/* Header */}
        <div className={`${getDirectionalBorder('default', 'bottom')} ${PANEL_LAYOUT.PADDING.BOTTOM_SM} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
          <h2 className={`text-lg font-semibold ${colors.text.primary} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            🖼️ Ρυθμίσεις Καμβά
          </h2>
          <p className={`text-xs ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
            Ρυθμίσεις εμφάνισης και συμπεριφοράς καμβά
          </p>
        </div>

        {/* Coming Soon Placeholder */}
        <div className={`text-center ${PANEL_LAYOUT.SPACING.XL} ${colors.text.secondary}`}>
          <div className={`text-4xl ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>🎨</div>
          <h3 className={`text-lg font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>Σύντομα Διαθέσιμο</h3>
          <p className={`text-sm ${colors.text.muted}`}>
            Οι ρυθμίσεις καμβά θα περιλαμβάνουν:
          </p>
          <ul className={`text-xs ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_MD} ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
            <li>• Χρώμα φόντου καμβά</li>
            <li>• Ρυθμίσεις zoom και pan</li>
            <li>• Εμφάνιση πλέγματος αναφοράς</li>
            <li>• Ρυθμίσεις rendering</li>
            <li>• Προσαρμογές performance</li>
          </ul>
        </div>
      </div>
    </div>
  );
};