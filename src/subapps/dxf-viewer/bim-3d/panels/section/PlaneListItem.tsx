'use client';

/**
 * ADR-366 §C.6.Q2 — Single plane row in Section3DPanelTab.
 *
 * Controls: enable toggle + axis selector (X|Y|Z) + distance slider +
 * label input + optional chain badge (if grouped) + delete button.
 * When axis=Y → renders HorizontalPresetPicker inline.
 */

import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { useSectionStore, type SectionPlaneState, type Vec3Tuple } from '../../stores/SectionStore';
import { HorizontalPresetPicker } from './HorizontalPresetPicker';

type Axis = 'x' | 'y' | 'z';

const AXIS_TO_NORMAL: Record<Axis, Vec3Tuple> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

function normalToAxis(normal: Vec3Tuple): Axis {
  if (Math.abs(normal[0]) >= 0.95) return 'x';
  if (Math.abs(normal[1]) >= 0.95) return 'y';
  return 'z';
}

interface Props {
  plane: SectionPlaneState;
  isLinked: boolean;
}

export function PlaneListItem({ plane, isLinked }: Props) {
  const { t } = useTranslation('bim3d');
  const store = useSectionStore.getState;

  const currentAxis = normalToAxis(plane.normal);
  const distanceM = -plane.constant;

  function setAxis(axis: Axis) {
    store().updatePlane(plane.id, { normal: AXIS_TO_NORMAL[axis] });
  }

  function setDistance(m: number) {
    store().updatePlane(plane.id, { constant: -m });
  }

  const axisKeys: Axis[] = ['x', 'y', 'z'];

  return (
    <div className="flex flex-col gap-1 rounded bg-white/5 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Switch
          checked={plane.enabled}
          onCheckedChange={(v) => store().setPlaneEnabled(plane.id, v)}
          aria-label={t('section.toggleEnabled', { label: plane.label })}
        />
        <span className="flex-1 min-w-0 truncate text-[11px]">{plane.label}</span>
        {isLinked && (
          <span className="rounded bg-primary/20 px-1 text-[9px] text-primary">
            {t('section.linkedBadge')}
          </span>
        )}
        <button
          type="button"
          aria-label={t('section.deletePlane')}
          className="rounded px-1 text-white/40 transition-colors hover:bg-destructive/20 hover:text-destructive"
          onClick={() => store().removePlane(plane.id)}
        >
          ×
        </button>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[9px] uppercase tracking-wide text-white/40 w-10 shrink-0">
          {t('section.axisLabel')}
        </span>
        <div className="flex gap-0.5">
          {axisKeys.map((ax) => (
            <button
              key={ax}
              type="button"
              className={[
                'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                currentAxis === ax
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/5 text-white/60 hover:bg-white/10',
              ].join(' ')}
              onClick={() => setAxis(ax)}
            >
              {t(`section.axis.${ax.toUpperCase()}`)}
            </button>
          ))}
        </div>
      </div>

      {currentAxis === 'y' ? (
        <HorizontalPresetPicker planeId={plane.id} currentElevationM={distanceM} />
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wide text-white/40 w-10 shrink-0">
            {t('section.distanceLabel')}
          </span>
          <input
            type="range"
            min={-50}
            max={50}
            step={0.1}
            value={distanceM}
            className="flex-1 accent-primary"
            onChange={(e) => setDistance(parseFloat(e.target.value))}
          />
          <span className="text-[10px] text-white/60 w-10 text-right tabular-nums">
            {distanceM.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}
