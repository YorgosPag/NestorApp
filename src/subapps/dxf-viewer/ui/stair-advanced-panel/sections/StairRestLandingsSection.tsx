'use client';

/**
 * ADR-637 Phase 4-B — Rest Landings (πλατύσκαλα) section: ADD / REMOVE / edit
 * length+depth of `StairParams.restLandings`. Phase 4-A already renders and
 * grip-drags existing landings (slide `at`, resize `length` —
 * `bim/stairs/stair-grip-rest-landing.ts`); without this section there was no
 * way to CREATE the first landing, so the grips had nothing to target.
 *
 * Gated on `stairKindSupportsRestLandings` (`bim/geometry/stairs/
 * stair-run-landings.ts`) — only `straight` / `multi-flight` / `v-shape`
 * geometry generators consume the field today; other kinds show a hint
 * instead of an editor that would silently do nothing (N.7 — no dead UI).
 *
 * Unlike per-tread/per-riser overrides, a rest landing has no click-into
 * sub-element selection yet (no `part:'landing'` in
 * `stair-sub-element-selection-store` — Phase 4-A scope). Rows are always
 * "persisted" (no transient active row), so `StairOverrideRowShell` is reused
 * with `isActive=false` — shared row chrome (index cell + remove button),
 * not a cloned twin (N.18).
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairRestLanding } from '../../../bim/types/stair-types';
import { stairKindSupportsRestLandings } from '../../../bim/geometry/stairs/stair-run-landings';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';
import { StairOverrideRowShell } from './StairOverrideRowShell';
import {
  appendRestLanding,
  removeRestLandingById,
  patchRestLandingById,
} from './stair-rest-landing-helpers';

export interface StairRestLandingsSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairRestLandingsSection({
  stair,
  dispatchPatch,
}: StairRestLandingsSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const landings = stair.params.restLandings ?? [];
  const supported = stairKindSupportsRestLandings(stair.params.variant.kind);

  const onAdd = useCallback(() => {
    dispatchPatch(stair, { restLandings: appendRestLanding(landings) });
  }, [stair, landings, dispatchPatch]);

  const onRemove = useCallback(
    (id: string) => {
      dispatchPatch(stair, { restLandings: removeRestLandingById(landings, id) });
    },
    [stair, landings, dispatchPatch],
  );

  const onPatch = useCallback(
    (id: string, patch: Partial<StairRestLanding>) => {
      dispatchPatch(stair, { restLandings: patchRestLandingById(landings, id, patch) });
    },
    [stair, landings, dispatchPatch],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.restLandings.title')}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('stairAdvancedPanel.sections.restLandings.title')}
        </h4>
        {supported ? (
          <button
            type="button"
            onClick={onAdd}
            className="rounded border border-border bg-card px-2 py-0.5 text-xs text-foreground hover:bg-accent"
          >
            {t('stairAdvancedPanel.sections.restLandings.addLanding')}
          </button>
        ) : null}
      </header>
      {!supported ? (
        <p className="text-xs italic text-muted-foreground">
          {t('stairAdvancedPanel.sections.restLandings.unsupportedHint')}
        </p>
      ) : landings.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          {t('stairAdvancedPanel.sections.restLandings.empty')}
        </p>
      ) : (
        <LandingsTable
          landings={landings}
          width={stair.params.width}
          onRemove={onRemove}
          onPatch={onPatch}
        />
      )}
    </section>
  );
}

interface LandingsTableProps {
  readonly landings: readonly StairRestLanding[];
  readonly width: number;
  readonly onRemove: (id: string) => void;
  readonly onPatch: (id: string, patch: Partial<StairRestLanding>) => void;
}

function LandingsTable({
  landings,
  width,
  onRemove,
  onPatch,
}: LandingsTableProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <table className="w-full text-xs text-foreground">
      <thead className="text-muted-foreground">
        <tr>
          <th className="w-10 text-left font-medium">
            {t('stairAdvancedPanel.sections.restLandings.columns.index')}
          </th>
          <th className="text-left font-medium">
            {t('stairAdvancedPanel.sections.restLandings.columns.length')}
          </th>
          <th className="text-left font-medium">
            {t('stairAdvancedPanel.sections.restLandings.columns.depth')}
          </th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {landings.map((landing, index) => (
          <LandingRow
            key={landing.id}
            index={index}
            landing={landing}
            width={width}
            onRemove={onRemove}
            onPatch={onPatch}
          />
        ))}
      </tbody>
    </table>
  );
}

interface LandingRowProps {
  readonly index: number;
  readonly landing: StairRestLanding;
  readonly width: number;
  readonly onRemove: (id: string) => void;
  readonly onPatch: (id: string, patch: Partial<StairRestLanding>) => void;
}

function LandingRow({
  index,
  landing,
  width,
  onRemove,
  onPatch,
}: LandingRowProps): React.ReactElement {
  const onRemoveThis = useCallback(() => onRemove(landing.id), [onRemove, landing.id]);
  const onLength = useCallback(
    (next: 'auto' | number) => onPatch(landing.id, { length: next }),
    [onPatch, landing.id],
  );
  const onDepth = useCallback(
    (next: 'auto' | number) => onPatch(landing.id, { depth: next }),
    [onPatch, landing.id],
  );

  return (
    <StairOverrideRowShell
      index={index}
      persisted
      isActive={false}
      labelKeyBase="stairAdvancedPanel.sections.restLandings"
      onRemove={onRemoveThis}
    >
      <td className="py-1 align-middle">
        <AutoOrNumberCell value={landing.length} defaultMm={width} onChange={onLength} />
      </td>
      <td className="py-1 align-middle">
        <AutoOrNumberCell value={landing.depth} defaultMm={width} onChange={onDepth} />
      </td>
    </StairOverrideRowShell>
  );
}

interface AutoOrNumberCellProps {
  readonly value: 'auto' | number | undefined;
  /** Prefill when the user unchecks "auto" — the stair width (square landing). */
  readonly defaultMm: number;
  readonly onChange: (next: 'auto' | number) => void;
}

function AutoOrNumberCell({
  value,
  defaultMm,
  onChange,
}: AutoOrNumberCellProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const isAuto = value === undefined || value === 'auto';

  const onToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.checked ? 'auto' : defaultMm);
    },
    [onChange, defaultMm],
  );

  const onNumber = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw === '') return;
      const num = Number.parseFloat(raw);
      if (Number.isNaN(num) || num <= 0) return;
      onChange(num);
    },
    [onChange],
  );

  return (
    <div className="flex items-center gap-1">
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={isAuto} onChange={onToggle} className="h-3.5 w-3.5" />
        <span className="text-[10px] text-muted-foreground">
          {t('stairAdvancedPanel.sections.restLandings.auto')}
        </span>
      </label>
      <input
        type="number"
        min={1}
        step={50}
        value={isAuto ? '' : value}
        disabled={isAuto}
        onChange={onNumber}
        className="w-16 rounded border border-border bg-muted px-1 py-0.5 text-xs text-foreground disabled:opacity-40"
      />
    </div>
  );
}
