'use client';

/**
 * ADR-358 Q19 Φ6 — Nosing Profile picker for the clicked-into tread.
 *
 * Closes the per-tread nosing loop: the geometry pipeline (Φ4a plan footprint +
 * Φ4b 3D swept nose) already CONSUMES `perTreadOverrides[i].customProfile`; this
 * section is the WRITER that authors it. Revit-parity: the user picks a preset
 * SHAPE (square / bullnose / chamfer) + one size dimension — NOT a freehand point
 * sketch — and `nosing-profile-presets` generates the section (SSoT translator).
 *
 * Interaction mirrors Φ5 (`StairPerTreadOverrideSection`): reactive read of the
 * sub-element selection SSoT (low-freq — click / Tab / Esc only, ADR-040). The
 * clicked-into tread of THIS stair opens the picker; picking a shape dispatches a
 * 0-based `perTreadOverrides` patch through the shared `dispatchStairParamPatch`
 * writer (undo + geometry recompute). `square` clears `customProfile` (flat nose —
 * overhang falls back to the scalar `nosing`); a fresh tread left square never
 * materialises an empty row.
 *
 * Kept as a DEDICATED section (not folded into the 358-line per-tread table) per
 * N.7.1 file-size discipline.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { Point2D, StairPerTreadOverride } from '../../../bim/types/stair-types';
import {
  buildNosingProfile,
  classifyNosingProfile,
  DEFAULT_NOSING_PROFILE_SIZE,
  type NosingProfileClass,
  type NosingProfilePreset,
} from '../../../bim/geometry/stairs/nosing-profile-presets';
// ADR-358 Q19 Φ5/Φ6 — shared click-into SSoT (2D + 3D). Reactive read is low-freq (ADR-040).
import { useStairSubElementSelectionStore } from '../../../bim/stairs/stair-sub-element-selection-store';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';

type OverrideRecord = Readonly<Record<number, StairPerTreadOverride>>;

const PRESET_OPTIONS: readonly NosingProfilePreset[] = ['square', 'bullnose', 'chamfer'];

export interface StairTreadNosingProfileSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairTreadNosingProfileSection({
  stair,
  dispatchPatch,
}: StairTreadNosingProfileSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const selected = useStairSubElementSelectionStore((s) => s.selected);
  const activeIndex =
    selected && selected.stairId === stair.id && selected.part === 'tread'
      ? selected.index
      : null;

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.nosingProfile.title')}
      className="flex flex-col gap-2"
    >
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('stairAdvancedPanel.sections.nosingProfile.title')}
        </h4>
      </header>
      {activeIndex === null ? (
        <p className="text-xs italic text-muted-foreground">
          {t('stairAdvancedPanel.sections.nosingProfile.hint')}
        </p>
      ) : (
        <NosingProfileEditor stair={stair} index={activeIndex} dispatchPatch={dispatchPatch} />
      )}
    </section>
  );
}

interface NosingProfileEditorProps {
  readonly stair: StairEntity;
  readonly index: number;
  readonly dispatchPatch: DispatchStairParamPatch;
}

function NosingProfileEditor({
  stair,
  index,
  dispatchPatch,
}: NosingProfileEditorProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const overrides: OverrideRecord = stair.params.perTreadOverrides ?? {};
  const current = classifyNosingProfile(overrides[index]?.customProfile);

  const write = useCallback(
    (kind: NosingProfilePreset, sizeMm: number) => {
      const profile = buildNosingProfile(kind, sizeMm);
      const prev = overrides[index] ?? {};
      if (!profile && !prev.customProfile) return; // square on a fresh tread → no empty row
      dispatchPatch(stair, {
        perTreadOverrides: writeCustomProfile(overrides, index, prev, profile),
      });
    },
    [stair, overrides, index, dispatchPatch],
  );

  const onKind = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      write(
        event.target.value as NosingProfilePreset,
        current.size > 0 ? current.size : DEFAULT_NOSING_PROFILE_SIZE,
      );
    },
    [write, current.size],
  );

  const onSize = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (current.kind === 'square' || current.kind === 'custom') return;
      const num = Number.parseFloat(event.target.value);
      if (Number.isNaN(num)) return;
      write(current.kind, num);
    },
    [write, current.kind],
  );

  const showSize = current.kind === 'bullnose' || current.kind === 'chamfer';
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {t('stairAdvancedPanel.sections.nosingProfile.treadLabel', { index: index + 1 })}
      </p>
      <ShapeSelect kind={current.kind} onChange={onKind} />
      {showSize ? <SizeInput value={current.size} onChange={onSize} /> : null}
    </div>
  );
}

interface ShapeSelectProps {
  readonly kind: NosingProfileClass;
  readonly onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

function ShapeSelect({ kind, onChange }: ShapeSelectProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <span className="w-32 shrink-0">
        {t('stairAdvancedPanel.sections.nosingProfile.shape')}
      </span>
      <select
        value={kind}
        onChange={onChange}
        className="flex-1 rounded border border-border bg-muted px-2 py-1 text-xs text-foreground"
      >
        {PRESET_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {t(`stairAdvancedPanel.sections.nosingProfile.shapes.${opt}`)}
          </option>
        ))}
        {/* A freehand/imported section shows as read-only "custom"; picking a preset overwrites it. */}
        {kind === 'custom' ? (
          <option value="custom" disabled>
            {t('stairAdvancedPanel.sections.nosingProfile.shapes.custom')}
          </option>
        ) : null}
      </select>
    </label>
  );
}

interface SizeInputProps {
  readonly value: number;
  readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function SizeInput({ value, onChange }: SizeInputProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <span className="w-32 shrink-0">
        {t('stairAdvancedPanel.sections.nosingProfile.size')}
      </span>
      <input
        type="number"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={onChange}
        className="w-20 rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground"
      />
    </label>
  );
}

/** Merge a resolved `customProfile` into `overrides[index]`, dropping the key when flat. */
function writeCustomProfile(
  overrides: OverrideRecord,
  index: number,
  prev: StairPerTreadOverride,
  profile: readonly Point2D[] | undefined,
): OverrideRecord {
  const { customProfile: _drop, ...rest } = prev;
  const merged: StairPerTreadOverride = profile ? { ...rest, customProfile: profile } : rest;
  return { ...overrides, [index]: merged };
}
