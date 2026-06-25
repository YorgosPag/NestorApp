'use client';

/**
 * ADR-358 Phase 9 — Stair contextual ribbon: floor info section.
 *
 * Pattern (Revit / ArchiCAD / AutoCAD Architecture convergence): when a stair
 * is bound to a building floor, surface the floor metadata read-only AND
 * expose the link state via a 🔗 / ⚠️ badge so the user can tell at a glance
 * whether the stair's `multiStoryConfig.storyHeight` tracks the floor or has
 * been manually overridden. A "Reset to floor" button re-binds the link.
 *
 * Why a custom widget (not a data-driven panel): the section mixes read-only
 * fields, an inline badge with conditional colors, and a one-shot action
 * button — none of which map onto the existing combobox / toggle ribbon
 * controls. Mirrors the `font-family` / `annotation-scale` widget pattern
 * from ADR-345 Fase 6 (declarative tab data + leaf widget for non-standard
 * UX). ADR-040 micro-leaf compliance: every Firestore subscription is
 * scoped to this leaf, not the orchestrator.
 *
 * Unit conventions:
 *   - Floor row stores `height` / `elevation` in meters (see
 *     `useFloorsTabState.FloorRecord`).
 *   - Stair `multiStoryConfig.storyHeight` stores millimeters.
 *   - Display layer formats meters for the floor read-only fields and
 *     converts on "Reset to floor" (m → mm).
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Link2 as LinkIcon, AlertTriangle, RotateCcw } from 'lucide-react';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useCommandHistory } from '../../../core/commands';
import { UpdateStairParamsCommand } from '../../../core/commands/entity-commands/UpdateStairParamsCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { isStairEntity } from '../../../types/entities';
import type { StairEntity } from '../../../types/entities';
import type { StairMultiStoryConfig, StairParams } from '../../../bim/types/stair-types';
import { useFloorMetadata, type FloorMetadata } from '../../../hooks/data/useFloorMetadata';
import { useBuildingTotalFloors } from '../../../hooks/data/useBuildingTotalFloors';

const M_TO_MM = 1000;

function formatMeters(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)} m`;
}

function isLinkedToFloor(
  config: StairMultiStoryConfig | undefined,
  floor: FloorMetadata,
): boolean {
  if (!config) return false;
  if (config.linkedToFloor === true) return true;
  // Migration fallback for stairs persisted before Phase 9: if the stored
  // storyHeight already equals the floor height (within 0.5mm tolerance),
  // treat as linked even when the explicit flag is missing.
  if (config.linkedToFloor === undefined && typeof floor.height === 'number') {
    return Math.abs(config.storyHeight - floor.height * M_TO_MM) < 0.5;
  }
  return false;
}

export function RibbonStairFloorInfoWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const { execute } = useCommandHistory();

  // ADR-358 Phase 9 — accept any populated floorId in saveContext (entityType
  // check is documentation, not a gate). Wizard flows that set floorId but
  // miss entityType (legacy import paths) still surface the floor link.
  const floorId = levelManager.saveContext?.floorId ?? null;
  const floor = useFloorMetadata(floorId);
  // ADR-358 Phase 9B-1 — surface the building total floor count so the
  // engineer always sees "this floor of N" context. Same SSoT subscription
  // used by BuildingTabs (no duplicate cost).
  const { floorsCount: totalFloors } = useBuildingTotalFloors(floor?.buildingId);

  const stair = useMemo<StairEntity | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isStairEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const handleResetToFloor = useCallback(() => {
    if (!stair || !floor || typeof floor.height !== 'number') return;
    if (!levelManager.currentLevelId) return;
    const prev = stair.params;
    const cur = prev.multiStoryConfig;
    const next: StairMultiStoryConfig = {
      topLevel: cur?.topLevel || floor.id,
      storyHeight: floor.height * M_TO_MM,
      storyCount: cur?.storyCount ?? 1,
      linkedToFloor: true,
    };
    const params: StairParams = { ...prev, multiStoryConfig: next };
    const sm = createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
    execute(new UpdateStairParamsCommand(stair.id, params, prev, sm, false));
  }, [execute, floor, levelManager, stair]);

  if (!stair) return null;
  if (!floorId) return null;
  if (!floor) return null;

  const linked = isLinkedToFloor(stair.params.multiStoryConfig, floor);
  const endElevation =
    floor.elevation !== null && floor.height !== null
      ? floor.elevation + floor.height
      : null;

  const currentStoryHeightMm = stair.params.multiStoryConfig?.storyHeight ?? null;
  const customMeters =
    currentStoryHeightMm !== null ? currentStoryHeightMm / M_TO_MM : null;
  const canReset = typeof floor.height === 'number';

  return (
    <span className="dxf-ribbon-stair-floor-info">
      <span className="dxf-ribbon-stair-floor-grid">
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.floor.number')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {floor.number !== null
              ? (totalFloors > 0
                  ? `${floor.number} / ${totalFloors}`
                  : String(floor.number))
              : '—'}
          </span>
        </span>
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.floor.name')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {floor.name || '—'}
          </span>
        </span>
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.floor.totalFloors')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {totalFloors > 0 ? String(totalFloors) : '—'}
          </span>
        </span>
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.floor.elevation')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {formatMeters(floor.elevation)}
          </span>
        </span>
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.floor.endElevation')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {formatMeters(endElevation)}
          </span>
        </span>
        <span className="dxf-ribbon-stair-floor-row">
          <span className="dxf-ribbon-stair-floor-label">
            {t('ribbon.commands.stairEditor.floor.height')}
          </span>
          <span className="dxf-ribbon-stair-floor-value">
            {formatMeters(floor.height)}
          </span>
        </span>
      </span>

      <span
        className={
          linked
            ? 'dxf-ribbon-stair-floor-badge dxf-ribbon-stair-floor-badge--linked'
            : 'dxf-ribbon-stair-floor-badge dxf-ribbon-stair-floor-badge--custom'
        }
        role="status"
      >
        {linked ? (
          <>
            <LinkIcon size={12} aria-hidden />
            <span>
              {t('ribbon.commands.stairEditor.floor.linkedBadge', {
                name: floor.name,
                value: formatMeters(floor.height),
              })}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle size={12} aria-hidden />
            <span>
              {t('ribbon.commands.stairEditor.floor.customBadge', {
                value: formatMeters(customMeters),
              })}
            </span>
          </>
        )}
      </span>

      {!linked && canReset ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetToFloor}
          className="dxf-ribbon-stair-floor-reset"
        >
          <RotateCcw size={12} aria-hidden />
          <span>{t('ribbon.commands.stairEditor.floor.resetButton')}</span>
        </Button>
      ) : null}
    </span>
  );
}
