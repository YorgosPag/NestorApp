'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
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
      <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
        <h3 className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${PANEL_LAYOUT.TAB.FONT_WEIGHT} ${colors.text.info}`}>Πληροφορίες Σκηνής</h3>
        <div className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
          <FileText className={`${iconSizes.xl} ${colors.text.muted} mx-auto ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`} />
          <p className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.muted}`}>Δεν υπάρχει φορτωμένη σκηνή</p>
          <p className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
            Εισάγετε ένα DXF αρχείο για να δείτε πληροφορίες
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
      <h3 className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${PANEL_LAYOUT.TAB.FONT_WEIGHT} ${colors.text.info}`}>Πληροφορίες Σκηνής</h3>
      <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}>
        <div className="flex justify-between">
          <span className={colors.text.muted}>Στοιχεία:</span>
          <span className={`${colors.text.primary} ${PANEL_LAYOUT.TAB.FONT_WEIGHT}`}>{scene.entities?.length || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.text.muted}>Επίπεδα:</span>
          <span className={`${colors.text.primary} ${PANEL_LAYOUT.TAB.FONT_WEIGHT}`}>{Object.keys(scene.layers).length}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.text.muted}>Μονάδες:</span>
          <span className={`${colors.text.primary} ${PANEL_LAYOUT.TAB.FONT_WEIGHT}`}>{scene.units}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.text.muted}>Μέγεθος:</span>
          <span className={`${colors.text.primary} ${PANEL_LAYOUT.TAB.FONT_WEIGHT}`}>
            {scene.bounds ? formatSize(scene.bounds.max.x - scene.bounds.min.x) : "0"} × {scene.bounds ? formatSize(scene.bounds.max.y - scene.bounds.min.y) : "0"}
          </span>
        </div>
        {selectedEntityIds.length > 0 && (
          <div className="flex justify-between">
            <span className={colors.text.warning}>Επιλεγμένα:</span>
            <span className={`${colors.text.warning} ${PANEL_LAYOUT.TAB.FONT_WEIGHT}`}>{selectedEntityIds.length} στοιχεία</span>
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
    <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
      <h3 className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${PANEL_LAYOUT.TAB.FONT_WEIGHT} ${colors.text.accent}`}>Τύποι Στοιχείων</h3>
      <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}>
        {entityTypes.map(type => {
          const count = scene.entities ? scene.entities.filter(e => e.type === type).length : 0;
          if (count === 0) return null;

          const selectedCount = selectedEntityIds.length > 0 && scene.entities
            ? scene.entities.filter(e => e.type === type && selectedEntityIds.includes(e.id)).length
            : 0;

          return (
            <div key={type} className="flex justify-between">
              <span className={colors.text.muted}>{typeLabels[type]}:</span>
              <span className={`${colors.text.primary} ${PANEL_LAYOUT.TAB.FONT_WEIGHT}`}>
                {count}
                {selectedCount > 0 && (
                  <span className={`${colors.text.warning} ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`}>({selectedCount} επιλεγμένα)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
