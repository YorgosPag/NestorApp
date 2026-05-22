'use client';

/**
 * ADR-366 §C.6.Q1 — Horizontal cut Y-axis floor preset picker.
 *
 * Dropdown showing ADR-326 floor elevations from Bim3DEntitiesStore.
 * When no floors defined — falls back to a numeric input.
 * Selected preset → updates plane constant via SectionStore.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import { useSectionStore } from '../../stores/SectionStore';
import { resolveFloorPresets } from '../../systems/section/horizontal-cut-preset-resolver';

interface Props {
  planeId: string;
  currentElevationM: number;
}

export function HorizontalPresetPicker({ planeId, currentElevationM }: Props) {
  const { t } = useTranslation('bim3d');

  const floors = useSyncExternalStore(
    useBim3DEntitiesStore.subscribe,
    () => useBim3DEntitiesStore.getState().floors,
    () => useBim3DEntitiesStore.getState().floors,
  );

  const presets = resolveFloorPresets(floors, t);
  const hasPresets = presets.length > 1;

  const currentPresetLabel =
    presets.find((p) => !isNaN(p.elevationM) && Math.abs(p.elevationM - currentElevationM) < 0.01)
      ?.label ?? presets[presets.length - 1]?.label ?? '';

  function onPresetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const label = e.target.value;
    const preset = presets.find((p) => p.label === label);
    if (!preset || isNaN(preset.elevationM)) return;
    useSectionStore.getState().updatePlane(planeId, { constant: -preset.elevationM });
  }

  function onManualChange(e: React.ChangeEvent<HTMLInputElement>) {
    const elevM = parseFloat(e.target.value);
    if (isNaN(elevM)) return;
    useSectionStore.getState().updatePlane(planeId, { constant: -elevM });
  }

  return (
    <div className="flex flex-col gap-1">
      {hasPresets && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wide text-white/40 w-10 shrink-0">
            {t('section.presets.title')}
          </span>
          <select
            className="flex-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/80"
            value={currentPresetLabel}
            onChange={onPresetChange}
          >
            {presets.map((p) => (
              <option key={p.label} value={p.label} className="bg-black text-white">
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-wide text-white/40 w-10 shrink-0">
          {t('section.distanceLabel')}
        </span>
        <input
          type="number"
          step={0.1}
          value={isNaN(currentElevationM) ? '' : currentElevationM.toFixed(1)}
          className="flex-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/80"
          onChange={onManualChange}
          aria-label={t('section.distanceLabel')}
        />
        <span className="text-[9px] text-white/40">{t('section.metersAbbrev')}</span>
      </div>
    </div>
  );
}
