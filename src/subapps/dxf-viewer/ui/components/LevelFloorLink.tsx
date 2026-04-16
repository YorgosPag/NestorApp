'use client';

/**
 * LevelFloorLink — inline floor-selector for a DXF level card.
 *
 * Reads available floors from ProjectHierarchyContext (selectedBuilding.floors).
 * Calls linkLevelToFloor(levelId, floorId | null) on change.
 *
 * @see ADR-237 / SPEC-237B — useFloorOverlays requires Level.floorId to bridge
 *   DXF viewer overlays to the properties floor-plan read-only view.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useProjectHierarchy } from '../../contexts/ProjectHierarchyContext';
import { PANEL_TOKENS } from '../../config/panel-tokens';

interface LevelFloorLinkProps {
  levelId: string;
  floorId: string | undefined;
  onLink: (levelId: string, floorId: string | null) => Promise<void>;
}

export function LevelFloorLink({ levelId, floorId, onLink }: LevelFloorLinkProps) {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const { selectedBuilding } = useProjectHierarchy();

  const floors = selectedBuilding?.floors ?? [];

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      void onLink(levelId, value === '' ? null : value);
    },
    [levelId, onLink]
  );

  if (floors.length === 0) {
    return (
      <p className={PANEL_TOKENS.LEVEL_FLOOR_LINK?.HINT ?? 'text-xs text-muted-foreground mt-1 truncate'}>
        {t('panels.levels.noBuildingSelected')}
      </p>
    );
  }

  const linkedFloor = floors.find(f => f.id === floorId);

  return (
    <select
      value={floorId ?? ''}
      onChange={handleChange}
      aria-label={t('panels.levels.linkFloor')}
      title={linkedFloor ? t('panels.levels.linkedFloor', { floorName: linkedFloor.name }) : t('panels.levels.noFloorLinked')}
      className={PANEL_TOKENS.LEVEL_FLOOR_LINK?.SELECT ?? 'mt-1 w-full text-xs rounded border border-border bg-background text-foreground px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring'}
    >
      <option value="">{t('panels.levels.selectFloorPlaceholder')}</option>
      {floors.map(floor => (
        <option key={floor.id} value={floor.id}>
          {floor.name}
        </option>
      ))}
    </select>
  );
}
