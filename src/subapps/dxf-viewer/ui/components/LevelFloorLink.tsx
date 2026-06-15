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
import { Badge } from '@/components/ui/badge';
import { isBuildingStorey } from '@/utils/floor-naming';
import { useProjectHierarchy } from '../../contexts/ProjectHierarchyContext';
import { PANEL_TOKENS } from '../../config/panel-tokens';

interface LevelFloorLinkProps {
  levelId: string;
  floorId: string | undefined;
  onLink: (levelId: string, floorId: string | null, buildingId?: string | null) => Promise<void>;
}

export function LevelFloorLink({ levelId, floorId, onLink }: LevelFloorLinkProps) {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const { selectedBuilding } = useProjectHierarchy();

  const floors = selectedBuilding?.floors ?? [];

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      // Pass buildingId alongside floorId so OverlayProperties can fetch entities
      // without requiring the user to have selectedBuilding set (ADR-237)
      void onLink(levelId, value === '' ? null : value, selectedBuilding?.id ?? null);
    },
    [levelId, onLink, selectedBuilding]
  );

  if (floors.length === 0) {
    return null;
  }

  const linkedFloor = floors.find(f => f.id === floorId);
  // ADR-461 — flag a special level (foundation / roof / stair-penthouse) so the DXF
  // level switcher mirrors the «Όροφοι» table badge. Undefined kind → no badge.
  const isSpecialLevel = linkedFloor?.kind !== undefined && !isBuildingStorey(linkedFloor.kind);

  const select = (
    <select
      value={floorId ?? ''}
      onChange={handleChange}
      aria-label={t('panels.levels.linkFloor')}
      title={linkedFloor ? t('panels.levels.linkedFloor', { floorName: linkedFloor.name }) : t('panels.levels.noFloorLinked')}
      className={PANEL_TOKENS.LEVEL_FLOOR_LINK.SELECT}
    >
      <option value="">{t('panels.levels.selectFloorPlaceholder')}</option>
      {floors.map(floor => (
        <option key={floor.id} value={floor.id}>
          {floor.name}
        </option>
      ))}
    </select>
  );

  if (!isSpecialLevel) return select;

  return (
    <span className="flex items-center gap-1.5">
      {select}
      <Badge variant="info" className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium">
        {t('panels.levels.specialLevel')}
      </Badge>
    </span>
  );
}
