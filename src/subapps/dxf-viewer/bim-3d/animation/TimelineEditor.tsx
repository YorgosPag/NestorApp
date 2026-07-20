'use client';

/**
 * ADR-366 §C.1.b — Timeline editor (Floating3DPanel "animation" tab).
 *
 * Vertical adaptation του single-track strip (ADR-366 §C.1.Q3). Inside a
 * w-72 sidebar tab:
 *  - Config row (duration/fps/axis/direction)
 *  - "Add at current camera" button (reads CameraTargetStore SSoT)
 *  - Playhead scrubber (TimelineScrubber SSoT — 0..durationSec + waypoint ticks)
 *  - Vertical waypoint list (diamond + ordinal + time + remove + drag-reorder)
 *  - Selected waypoint properties form (position/target/fov/easingToNext)
 *
 * Micro-leaf subscriber (ADR-040): single selector per piece of state, no
 * orchestrator subscriptions.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCameraTargetStore } from '../stores/CameraTargetStore';
import {
  selectActiveWaypoint,
  useAnimationStore,
} from './AnimationStore';
import {
  EASING_PRESET_IDS,
  type AnimationAxis,
  type AnimationDirection,
  type AnimationFps,
  type EasingPresetId,
  type Waypoint,
} from './animation-types';
import { ANIMATION_LIMITS } from './presets/animation-presets';
import { formatTime, waypointTimesSec } from './timeline-time-format';
import { TimelineScrubber, type TimelineScrubberMarker } from './TimelineScrubber';
import { TimelineWaypointForm } from './TimelineWaypointForm';

const AXIS_OPTIONS: readonly AnimationAxis[] = ['x', 'y', 'z'];
const DIRECTION_OPTIONS: readonly AnimationDirection[] = ['cw', 'ccw'];

export function TimelineEditor() {
  const { t } = useTranslation('bim3d');
  // ADR-040 micro-leaf pattern — individual selectors avoid the new-object
  // identity that an aggregate selector would emit on every render.
  const waypoints = useAnimationStore((s) => s.waypoints);
  const durationSec = useAnimationStore((s) => s.durationSec);
  const fps = useAnimationStore((s) => s.fps);
  const axis = useAnimationStore((s) => s.axis);
  const direction = useAnimationStore((s) => s.direction);
  const activeIndex = useAnimationStore((s) => s.activeWaypointIndex);
  const activeWaypoint = useAnimationStore(selectActiveWaypoint);
  const setActive = useAnimationStore((s) => s.setActiveWaypointIndex);
  const addWaypoint = useAnimationStore((s) => s.addWaypoint);
  const removeWaypoint = useAnimationStore((s) => s.removeWaypoint);
  const reorderWaypoints = useAnimationStore((s) => s.reorderWaypoints);
  const updateWaypoint = useAnimationStore((s) => s.updateWaypoint);
  const setDurationSec = useAnimationStore((s) => s.setDurationSec);
  const setFps = useAnimationStore((s) => s.setFps);
  const setAxis = useAnimationStore((s) => s.setAxis);
  const setDirection = useAnimationStore((s) => s.setDirection);

  const [scrubberSec, setScrubberSec] = useState(0);

  const handleAddAtCurrentCamera = useCallback(() => {
    const camera = useCameraTargetStore.getState();
    addWaypoint({
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: camera.target.x, y: camera.target.y, z: camera.target.z },
      fov: camera.fov > 0 ? camera.fov : 50,
      easingToNext: 'linear',
    });
  }, [addWaypoint]);

  // Τα waypoints είναι ισοκατανεμημένα στη διάρκεια — ίδιος υπολογισμός με
  // την κάθετη λίστα, μία φορά γραμμένος (timeline-time-format SSoT).
  const waypointTimes = useMemo(
    () => waypointTimesSec(waypoints.length, durationSec),
    [waypoints.length, durationSec],
  );

  const scrubberMarkers = useMemo<ReadonlyArray<TimelineScrubberMarker>>(
    () => waypointTimes.map((timeSec) => ({ timeSec })),
    [waypointTimes],
  );

  return (
    <section
      aria-label={t('animation.title')}
      className="flex flex-col gap-3 p-3 text-xs text-white"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
          {t('animation.title')}
        </h3>
      </header>

      <ConfigRow
        durationSec={durationSec}
        fps={fps}
        axis={axis}
        direction={direction}
        onDurationChange={setDurationSec}
        onFpsChange={setFps}
        onAxisChange={setAxis}
        onDirectionChange={setDirection}
        t={t}
      />

      <button
        type="button"
        onClick={handleAddAtCurrentCamera}
        className="rounded bg-primary/80 px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary"
      >
        {t('animation.toolbar.addAtCurrentCamera')}
      </button>

      <TimelineScrubber
        valueSec={scrubberSec}
        durationSec={durationSec}
        onChange={setScrubberSec}
        waypoints={scrubberMarkers}
        ariaLabel={t('animation.timeline.scrubberLabel')}
      />

      <WaypointList
        waypoints={waypoints}
        activeIndex={activeIndex}
        times={waypointTimes}
        onSelect={setActive}
        onRemove={removeWaypoint}
        onReorder={reorderWaypoints}
        emptyLabel={t('animation.timeline.emptyHint')}
        deleteLabel={t('animation.toolbar.deleteWaypoint')}
      />

      {activeWaypoint !== null && activeIndex !== null && (
        <TimelineWaypointForm
          waypoint={activeWaypoint}
          onPatch={(patch) => updateWaypoint(activeIndex, patch)}
        />
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Config row
// ──────────────────────────────────────────────────────────────────────────────

interface ConfigRowProps {
  readonly durationSec: number;
  readonly fps: AnimationFps;
  readonly axis: AnimationAxis;
  readonly direction: AnimationDirection;
  readonly onDurationChange: (v: number) => void;
  readonly onFpsChange: (v: AnimationFps) => void;
  readonly onAxisChange: (v: AnimationAxis) => void;
  readonly onDirectionChange: (v: AnimationDirection) => void;
  readonly t: (k: string) => string;
}

function ConfigRow(props: ConfigRowProps) {
  const { durationSec, fps, axis, direction, onDurationChange, onFpsChange, onAxisChange, onDirectionChange, t } = props;
  return (
    <div className="grid grid-cols-2 gap-2">
      <LabeledField label={t('animation.config.durationSec')}>
        <input
          type="number"
          min={ANIMATION_LIMITS.durationSecMin}
          max={ANIMATION_LIMITS.durationSecMax}
          step={0.5}
          value={durationSec}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          className="w-full rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
        />
      </LabeledField>
      <LabeledField label={t('animation.config.fps')}>
        <select
          value={fps}
          onChange={(e) => onFpsChange(Number(e.target.value) as AnimationFps)}
          className="w-full rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
        >
          {ANIMATION_LIMITS.fpsOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </LabeledField>
      <LabeledField label={t('animation.config.axis')}>
        <select
          value={axis}
          onChange={(e) => onAxisChange(e.target.value as AnimationAxis)}
          className="w-full rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
        >
          {AXIS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{t(`animation.axisOptions.${opt}`)}</option>
          ))}
        </select>
      </LabeledField>
      <LabeledField label={t('animation.config.direction')}>
        <select
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as AnimationDirection)}
          className="w-full rounded bg-black/30 px-1 py-0.5 text-[11px] text-white"
        >
          {DIRECTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{t(`animation.directionOptions.${opt}`)}</option>
          ))}
        </select>
      </LabeledField>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Waypoint list (drag-to-reorder)
// ──────────────────────────────────────────────────────────────────────────────

interface WaypointListProps {
  readonly waypoints: ReadonlyArray<Waypoint>;
  readonly activeIndex: number | null;
  /** Χρόνος ανά waypoint — από το timeline-time-format SSoT. */
  readonly times: readonly number[];
  readonly onSelect: (index: number) => void;
  readonly onRemove: (index: number) => void;
  readonly onReorder: (from: number, to: number) => void;
  readonly emptyLabel: string;
  readonly deleteLabel: string;
}

function WaypointList(props: WaypointListProps) {
  const { waypoints, activeIndex, times, onSelect, onRemove, onReorder, emptyLabel, deleteLabel } = props;
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (waypoints.length === 0) {
    return <p className="rounded border border-dashed border-white/20 p-2 text-center text-[11px] text-white/40">{emptyLabel}</p>;
  }

  return (
    <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
      {waypoints.map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <li
            key={i}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
              setDragIndex(null);
            }}
            className={[
              'flex cursor-grab items-center gap-1 rounded px-1.5 py-0.5 text-[11px]',
              isActive ? 'bg-primary/30 text-white' : 'text-white/70 hover:bg-white/10',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSelect(i)}
              className="flex flex-1 items-center gap-1 text-left"
            >
              <span aria-hidden className="text-[hsl(var(--text-warning))]">◆</span>
              <span className="w-6 font-mono">{i + 1}</span>
              <span className="font-mono text-[10px] text-white/50">{formatTime(times[i] ?? 0)}</span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={deleteLabel}
              className="rounded px-1 text-white/40 hover:text-destructive"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────────────────────────────────────

function LabeledField({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
      {children}
    </label>
  );
}

export const TIMELINE_EASING_OPTIONS: readonly EasingPresetId[] = EASING_PRESET_IDS;
