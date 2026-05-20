'use client';

/**
 * Floor3DPanelTab — per-level Show/Ghost/Hide visibility controls.
 * ADR-366 Phase 4 Group B (B.3). Low-freq — triggered by user interaction only.
 */

import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { sortLevelsTopDown } from '../utils/floor-visibility-state';
import type { FloorVisMode, FloorPreset } from '../utils/floor-visibility-state';
import type { Level } from '../../systems/levels/config';

const PRESETS: FloorPreset[] = ['all', 'active', 'none', 'invert'];

function ModeButton({
  active,
  onClick,
  title,
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

export function Floor3DPanelTab() {
  const { t } = useTranslation('bim3d');
  const { levels } = useLevels();
  const activeLevelId = useBim3DEntitiesStore((s) => s.activeLevelId);
  const applyFloorsPreset = useViewMode3DStore((s) => s.applyFloorsPreset);
  const floorVisibilityModes = useViewMode3DStore((s) => s.floorVisibilityModes);

  const sorted = sortLevelsTopDown(levels);

  return (
    <div className="flex flex-col gap-2 p-2">
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
