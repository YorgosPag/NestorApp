'use client';

import React from 'react';
import { Info, FileText } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { SceneModel } from '../../types/scene';

interface SceneInfoSectionProps {
  scene: SceneModel | null;
  selectedEntityIds: string[];
}

export function SceneInfoSection({ scene, selectedEntityIds }: SceneInfoSectionProps) {
  const iconSizes = useIconSizes();
  const formatSize = (value: number) => {
    if (value < 1) {
      return (value * 1000).toFixed(1);
    }
    return value.toFixed(2);
  };

  if (!scene) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-blue-400">Πληροφορίες Σκηνής</h3>
        <div className="text-center py-4">
          <FileText className={`${iconSizes.xl} text-gray-600 mx-auto mb-2`} />
          <p className="text-sm text-gray-400">Δεν υπάρχει φορτωμένη σκηνή</p>
          <p className="text-xs text-gray-500 mt-1">
            Εισάγετε ένα DXF αρχείο για να δείτε πληροφορίες
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-blue-400">Πληροφορίες Σκηνής</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Στοιχεία:</span>
          <span className="text-white font-medium">{scene.entities?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Επίπεδα:</span>
          <span className="text-white font-medium">{Object.keys(scene.layers).length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Μονάδες:</span>
          <span className="text-white font-medium">{scene.units}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Μέγεθος:</span>
          <span className="text-white font-medium">
            {scene.bounds ? formatSize(scene.bounds.max.x - scene.bounds.min.x) : "0"} × {scene.bounds ? formatSize(scene.bounds.max.y - scene.bounds.min.y) : "0"}
          </span>
        </div>
        {selectedEntityIds.length > 0 && (
          <div className="flex justify-between">
            <span className="text-yellow-400">Επιλεγμένα:</span>
            <span className="text-yellow-300 font-medium">{selectedEntityIds.length} στοιχεία</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function EntityTypesSection({ scene, selectedEntityIds }: SceneInfoSectionProps) {
  if (!scene) return null;

  const typeLabels: Record<string, string> = {
    line: 'Γραμμές',
    polyline: 'Πολυγραμμές', 
    circle: 'Κύκλοι',
    arc: 'Τόξα',
    text: 'Κείμενο',
    block: 'Μπλοκ'
  };

  const entityTypes = ['line', 'polyline', 'circle', 'arc', 'text', 'block'];
  const hasAnyEntities = entityTypes.some(type => 
    scene.entities && scene.entities.filter(e => e.type === type).length > 0
  );

  if (!hasAnyEntities) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-purple-400">Τύποι Στοιχείων</h3>
      <div className="space-y-2 text-sm">
        {entityTypes.map(type => {
          const count = scene.entities ? scene.entities.filter(e => e.type === type).length : 0;
          if (count === 0) return null;
          
          const selectedCount = selectedEntityIds.length > 0 && scene.entities
            ? scene.entities.filter(e => e.type === type && selectedEntityIds.includes(e.id)).length 
            : 0;
          
          return (
            <div key={type} className="flex justify-between">
              <span className="text-gray-400">{typeLabels[type]}:</span>
              <span className="text-white font-medium">
                {count}
                {selectedCount > 0 && (
                  <span className="text-yellow-400 ml-1">({selectedCount} επιλεγμένα)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
