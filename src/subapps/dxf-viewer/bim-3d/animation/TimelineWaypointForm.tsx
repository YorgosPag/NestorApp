'use client';

/**
 * ADR-366 §C.1.b — Waypoint properties form (TimelineEditor sub-component).
 *
 * Fine-tune coords for the currently selected waypoint. Mirror του
 * Dim3DPropertiesPanel form-field pattern. Each field change calls
 * onPatch with a Partial<Waypoint>.
 */

import { useTranslation } from 'react-i18next';
import {
  EASING_PRESET_IDS,
  type EasingPresetId,
  type Vec3,
  type Waypoint,
} from './animation-types';

interface Props {
  readonly waypoint: Waypoint;
  readonly onPatch: (patch: Partial<Waypoint>) => void;
}

type Vec3Axis = 'x' | 'y' | 'z';
type Vec3Field = 'position' | 'target';

export function TimelineWaypointForm({ waypoint, onPatch }: Props) {
  const { t } = useTranslation('bim3d');

  function patchVec(field: Vec3Field, axis: Vec3Axis, value: number) {
    const current = waypoint[field];
    onPatch({ [field]: { ...current, [axis]: value } } as Partial<Waypoint>);
  }

  return (
    <section
      aria-label={t('animation.waypoint.title')}
      className="flex flex-col gap-2 rounded border border-white/10 bg-black/30 p-2"
    >
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
        {t('animation.waypoint.title')}
      </h4>

      <Vec3Row
        label={t('animation.waypoint.position')}
        value={waypoint.position}
        onChange={(axis, v) => patchVec('position', axis, v)}
      />
      <Vec3Row
        label={t('animation.waypoint.target')}
        value={waypoint.target}
        onChange={(axis, v) => patchVec('target', axis, v)}
      />

      <label className="flex items-center gap-2">
        <span className="w-16 text-[10px] uppercase tracking-wide text-white/50">
          {t('animation.waypoint.fov')}
        </span>
        <input
          type="number"
          min={10}
          max={120}
          step={1}
          value={waypoint.fov}
          onChange={(e) => onPatch({ fov: Number(e.target.value) })}
          className="flex-1 rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="w-16 text-[10px] uppercase tracking-wide text-white/50">
          {t('animation.waypoint.easingToNext')}
        </span>
        <select
          value={waypoint.easingToNext}
          onChange={(e) => onPatch({ easingToNext: e.target.value as EasingPresetId })}
          className="flex-1 rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
        >
          {EASING_PRESET_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`animation.easing.${easingI18nKey(id)}`)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

interface Vec3RowProps {
  readonly label: string;
  readonly value: Vec3;
  readonly onChange: (axis: Vec3Axis, v: number) => void;
}

function Vec3Row({ label, value, onChange }: Vec3RowProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-16 text-[10px] uppercase tracking-wide text-white/50">{label}</span>
      <Vec3Input axis="x" value={value.x} onChange={onChange} />
      <Vec3Input axis="y" value={value.y} onChange={onChange} />
      <Vec3Input axis="z" value={value.z} onChange={onChange} />
    </div>
  );
}

function Vec3Input({ axis, value, onChange }: { readonly axis: Vec3Axis; readonly value: number; readonly onChange: (axis: Vec3Axis, v: number) => void }) {
  return (
    <input
      type="number"
      step={0.01}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(axis, Number(e.target.value))}
      aria-label={axis}
      className="w-full min-w-0 rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
    />
  );
}

function easingI18nKey(id: EasingPresetId): string {
  // 'ease-in-quart' → 'easeInQuart' (camelCase για i18n key)
  return id
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}
