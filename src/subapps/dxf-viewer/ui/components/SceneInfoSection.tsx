'use client';

import React from 'react';
import { Info, FileText } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { SceneModel } from '../../types/scene';

interface SceneInfoSectionProps {
  scene: SceneModel | null;
  selectedEntityIds: string[];
}

export function SceneInfoSection({ scene, selectedEntityIds }: SceneInfoSectionProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const formatSize = (value: number) => {
    if (value < 1) {
      return (value * 1000).toFixed(1);
    }
    return value.toFixed(2);
  };

  if (!scene) {
    return (
      <div className="space-y-3">
        <h3 className={`text-sm font-medium ${colors.text.info}`}>Πληροφορίες Σκηνής</h3>
        <div className="text-center py-4">
          <FileText className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-2`} />
          <p className={`text-sm ${colors.text.muted}`}>Δεν υπάρχει φορτωμένη σκηνή</p>
          <p className={`text-xs ${colors.text.muted} mt-1`}>
            Εισάγετε ένα DXF αρχείο για να δείτε πληροφορίες
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className={`text-sm font-medium ${colors.text.info}`}>Πληροφορίες Σκηνής</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className={colors.text.muted}>Στοιχεία:</span>
          <span className={`${colors.text.primary} font-medium`}>{scene.entities?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.text.muted}>Επίπεδα:</span>
          <span className={`${colors.text.primary} font-medium`}>{Object.keys(scene.layers).length}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.text.muted}>Μονάδες:</span>
          <span className={`${colors.text.primary} font-medium`}>{scene.units}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.text.muted}>Μέγεθος:</span>
          <span className={`${colors.text.primary} font-medium`}>
            {scene.bounds ? formatSize(scene.bounds.max.x - scene.bounds.min.x) : "0"} × {scene.bounds ? formatSize(scene.bounds.max.y - scene.bounds.min.y) : "0"}
          </span>
        </div>
        {selectedEntityIds.length > 0 && (
          <div className="flex justify-between">
            <span className={colors.text.warning}>Επιλεγμένα:</span>
            <span className={`${colors.text.warning} font-medium`}>{selectedEntityIds.length} στοιχεία</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function EntityTypesSection({ scene, selectedEntityIds }: SceneInfoSectionProps) {
  const colors = useSemanticColors();

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
      <h3 className={`text-sm font-medium ${colors.text.accent}`}>Τύποι Στοιχείων</h3>
      <div className="space-y-2 text-sm">
        {entityTypes.map(type => {
          const count = scene.entities ? scene.entities.filter(e => e.type === type).length : 0;
          if (count === 0) return null;

          const selectedCount = selectedEntityIds.length > 0 && scene.entities
            ? scene.entities.filter(e => e.type === type && selectedEntityIds.includes(e.id)).length
            : 0;

          return (
            <div key={type} className="flex justify-between">
              <span className={colors.text.muted}>{typeLabels[type]}:</span>
              <span className={`${colors.text.primary} font-medium`}>
                {count}
                {selectedCount > 0 && (
                  <span className={`${colors.text.warning} ml-1`}>({selectedCount} επιλεγμένα)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
