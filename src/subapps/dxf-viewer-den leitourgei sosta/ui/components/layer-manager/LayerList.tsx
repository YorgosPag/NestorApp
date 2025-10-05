import React from 'react';
import { Layers, Eye, EyeOff, MoreVertical } from 'lucide-react';
import type { LayerListProps } from './types';

export function LayerList({ layers, onToggleVisibility, onLayerAction }: LayerListProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'electrical':
        return 'bg-yellow-500';
      case 'plumbing':
        return 'bg-blue-500';
      case 'hvac':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (layers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Δεν βρέθηκαν layers</p>
        <p className="text-xs">Δημιουργήστε ένα νέο layer ή αλλάξτε τα φίλτρα</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {layers.map(layer => (
        <div key={layer.id} className="p-2 bg-gray-700 rounded border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-3 h-3 rounded-full ${getCategoryColor(layer.category)}`} />
              
              <span className="text-sm text-white font-medium">{layer.name}</span>
              
              <span className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                {layer.elements}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleVisibility?.(layer.id)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title={layer.visible ? 'Απόκρυψη' : 'Εμφάνιση'}
              >
                {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              
              <button 
                onClick={() => onLayerAction?.(layer.id, 'menu')}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Περισσότερες επιλογές"
              >
                <MoreVertical className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}