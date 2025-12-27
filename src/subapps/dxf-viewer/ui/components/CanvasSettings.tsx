'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface CanvasSettingsProps {
  className?: string;
}

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({ className }) => {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <div className={`${colors.bg.primary} text-white ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className={`${getDirectionalBorder('default', 'bottom')} pb-3 mb-4`}>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            🖼️ Ρυθμίσεις Καμβά
          </h2>
          <p className={`text-xs ${colors.text.muted} mt-1`}>
            Ρυθμίσεις εμφάνισης και συμπεριφοράς καμβά
          </p>
        </div>

        {/* Coming Soon Placeholder */}
        <div className={`text-center py-8 ${colors.text.secondary}`}>
          <div className="text-4xl mb-4">🎨</div>
          <h3 className="text-lg font-medium mb-2">Σύντομα Διαθέσιμο</h3>
          <p className={`text-sm ${colors.text.muted}`}>
            Οι ρυθμίσεις καμβά θα περιλαμβάνουν:
          </p>
          <ul className={`text-xs ${colors.text.muted} mt-3 space-y-1`}>
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