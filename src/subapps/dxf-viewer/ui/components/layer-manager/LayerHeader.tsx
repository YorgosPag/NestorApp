import React from 'react';
import { Layers, Plus, Settings } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { LayerHeaderProps } from './types';

export function LayerHeader({ isConnected, onAddLayer, onSettings }: LayerHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-white flex items-center gap-2">
        <Layers className="w-4 h-4" />
        Layer Manager
        <div className="flex items-center gap-1">
          <div 
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            title={isConnected ? "Συνδεδεμένο - Real-time sync ενεργό" : "Αποσυνδεδεμένο"}
          />
        </div>
      </h3>
      
      <div className="flex items-center gap-1">
        <button
          onClick={onAddLayer}
          className={`p-1 text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} transition-colors`}
          title="Προσθήκη νέου layer"
        >
          <Plus className="w-3 h-3" />
        </button>
        
        <div className="relative">
          <button
            onClick={onSettings}
            className={`p-1 text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} transition-colors`}
            title="Ρυθμίσεις"
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}