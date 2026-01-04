import React from 'react';
import { Layers, Plus, Settings } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { LayerHeaderProps } from './types';

export function LayerHeader({ isConnected, onAddLayer, onSettings }: LayerHeaderProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div className="flex items-center justify-between">
      <h3 className={`text-sm font-medium ${colors.text.primary} flex items-center gap-2`}>
        <Layers className={iconSizes.sm} />
        Layer Manager
        <div className="flex items-center gap-1">
          <div
            className={`${iconSizes.xs} rounded-full ${isConnected ? colors.bg.success : colors.bg.error}`}
            title={isConnected ? "Συνδεδεμένο - Real-time sync ενεργό" : "Αποσυνδεδεμένο"}
          />
        </div>
      </h3>
      
      <div className="flex items-center gap-1">
        <button
          onClick={onAddLayer}
          className={`p-1 ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} transition-colors`}
          title="Προσθήκη νέου layer"
        >
          <Plus className={iconSizes.xs} />
        </button>
        
        <div className="relative">
          <button
            onClick={onSettings}
            className={`p-1 ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} transition-colors`}
            title="Ρυθμίσεις"
          >
            <Settings className={iconSizes.xs} />
          </button>
        </div>
      </div>
    </div>
  );
}