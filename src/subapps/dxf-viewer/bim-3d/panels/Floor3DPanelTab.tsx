'use client';

/**
 * Floor3DPanelTab — per-level Show/Ghost/Hide visibility controls.
 * ADR-366 Phase 4 Group B (B.3). Low-freq — triggered by user interaction only.
 */

import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Focus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { BuildingVisMode } from '../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { sortLevelsTopDown } from '../utils/floor-visibility-state';
import type { FloorVisMode, FloorPreset } from '../utils/floor-visibility-state';
import type { BuildingRef } from '../../bim/utils/bim-floor-utils';
import type { Level } from '../../systems/levels/config';

const PRESETS: FloorPreset[] = ['all', 'active', 'none', 'invert'];

function ModeButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={[
        'flex h-6 w-6 items-center justify-center rounded text-xs transition-colors',
        active
          ? 'bg-primary/80 text-white'
          : 'text-white/50 hover:bg-white/10 hover:text-white/80',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function LevelRow({ level, activeLevelId }: { level: Level; activeLevelId: string | null }) {
  const { t } = useTranslation('bim3d');
  const mode: FloorVisMode =
    useViewMode3DStore((s) => s.floorVisibilityModes.get(level.id)) ?? 'show';
  const setFloorMode = useViewMode3DStore((s) => s.setFloorMode);
  const isActive = level.id === activeLevelId;

  return (
    <li className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white/5">
      {isActive ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label={t('floatingPanel.floors.activeLevel')} />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-white/80">{level.name}</span>
      <div className="flex shrink-0 gap-0.5">
        <ModeButton active={mode === 'show'} onClick={() => setFloorMode(level.id, 'show')} label={t('floatingPanel.floors.show')}>
          <Eye size={12} />
        </ModeButton>
        <ModeButton active={mode === 'ghost'} onClick={() => setFloorMode(level.id, 'ghost')} label={t('floatingPanel.floors.ghost')}>
          <Eye size={12} className="opacity-40" />
        </ModeButton>
        <ModeButton active={mode === 'hide'} onClick={() => setFloorMode(level.id, 'hide')} label={t('floatingPanel.floors.hide')}>
          <EyeOff size={12} />
        </ModeButton>
      </div>
    </li>
  );
}

function BuildingRow({ building }: { building: BuildingRef }) {
  const { t } = useTranslation('bim3d');
  const mode: BuildingVisMode =
    useBim3DEntitiesStore((s) => s.buildingVisibilityModes.get(building.id)) ?? 'show';
  const setBuildingMode = useBim3DEntitiesStore((s) => s.setBuildingMode);
  const applyPreset = useBim3DEntitiesStore((s) => s.applyBuildingsPreset);

  return (
    <li className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white/5">
      <span className="min-w-0 flex-1 truncate text-xs text-white/80">
        {building.name ?? building.id}
      </span>
      <div className="flex shrink-0 gap-0.5">
        <ModeButton active={mode === 'show'} onClick={() => setBuildingMode(building.id, 'show')} label={t('floatingPanel.buildings.show')}>
          <Eye size={12} />
        </ModeButton>
        <ModeButton active={mode === 'ghost'} onClick={() => setBuildingMode(building.id, 'ghost')} label={t('floatingPanel.buildings.ghost')}>
          <Eye size={12} className="opacity-40" />
        </ModeButton>
        <ModeButton active={mode === 'hide'} onClick={() => setBuildingMode(building.id, 'hide')} label={t('floatingPanel.buildings.hide')}>
          <EyeOff size={12} />
        </ModeButton>
        <ModeButton active={false} onClick={() => applyPreset('active', building.id)} label={t('floatingPanel.buildings.focusAria')}>
          <Focus size={12} />
        </ModeButton>
      </div>
    </li>
  );
}

function BuildingsVisibilitySection() {
  const { t } = useTranslation('bim3d');
  const buildings = useBim3DEntitiesStore((s) => s.buildings);
  const applyPreset = useBim3DEntitiesStore((s) => s.applyBuildingsPreset);

  if (buildings.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
          {t('floatingPanel.buildings.visibilityLabel')}
        </span>
        <button
          onClick={() => applyPreset('all')}
          className="rounded px-1 py-0.5 text-[10px] text-white/40 hover:bg-white/10 hover:text-white/70"
        >
          {t('floatingPanel.buildings.presets.all')}
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {buildings.map((b) => (
          <BuildingRow key={b.id} building={b} />
        ))}
      </ul>
    </div>
  );
}

function BuildingSelector() {
  const { t } = useTranslation('bim3d');
  const buildings = useBim3DEntitiesStore((s) => s.buildings);
  const activeBuildingId = useBim3DEntitiesStore((s) => s.activeBuildingId);
  const setActiveBuildingId = useBim3DEntitiesStore((s) => s.setActiveBuildingId);

  if (buildings.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
        {t('floatingPanel.buildings.label')}
      </span>
      <Select
        value={activeBuildingId ?? ''}
        onValueChange={(v) => setActiveBuildingId(v === '' ? null : v)}
      >
        <SelectTrigger
          className="h-7 w-full border-white/15 bg-white/10 text-xs text-white/80 hover:bg-white/15"
          aria-label={t('floatingPanel.buildings.selectAria')}
        >
          <SelectValue placeholder={t('floatingPanel.buildings.allBuildings')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t('floatingPanel.buildings.allBuildings')}</SelectItem>
          {buildings.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name ?? b.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Floor3DPanelTab() {
  const { t } = useTranslation('bim3d');
  // ADR-371: useLevelsOptional() — null outside LevelsSystem (Properties read-only context).
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels ?? [];
  const activeLevelId = useBim3DEntitiesStore((s) => s.activeLevelId);
  const applyFloorsPreset = useViewMode3DStore((s) => s.applyFloorsPreset);
  const floorVisibilityModes = useViewMode3DStore((s) => s.floorVisibilityModes);

  const sorted = sortLevelsTopDown(levels);

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Building selector — only when >1 buildings (ADR-369 Q2.2) */}
      <BuildingSelector />

      {/* Per-building Show/Ghost/Hide + Focus (ADR-369 Q2.3) */}
      <BuildingsVisibilitySection />

      {/* Preset buttons */}
      <div className="flex gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => applyFloorsPreset(levels, preset, activeLevelId)}
            className="flex-1 rounded bg-white/10 px-1 py-0.5 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            {t(`floatingPanel.floors.presets.${preset}`)}
          </button>
        ))}
      </div>

      {/* Level list */}
      {sorted.length === 0 ? (
        <p className="text-center text-xs text-white/40">{t('floatingPanel.floors.noLevels')}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {sorted.map((level) => (
            <LevelRow key={level.id} level={level} activeLevelId={activeLevelId} />
          ))}
        </ul>
      )}

      {/* Hidden: re-render trigger when modes map changes (stable reference problem workaround) */}
      <span className="sr-only">{floorVisibilityModes.size}</span>
    </div>
  );
}
