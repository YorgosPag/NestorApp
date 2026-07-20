'use client';

/**
 * ADR-363 Phase 1L-J — Explicit wall-join override (Revit «Wall Joins» parity).
 *
 * Two dropdowns — «Ένωση Αρχής» / «Ένωση Τέλους» — that set `WallParams.startJoin`
 * / `endJoin` per endpoint of the selected straight wall. The override steers WHICH
 * junction cleanup `computeWallTrims` runs, decoupling the result from whether the
 * endpoint happened to snap coincident: `miter` forces a geometric miter even on a
 * face-to-face butt, `disallow` leaves the walls rectangular, `butt`/`square` square
 * off. Default `auto` = the automatic geometric decision.
 *
 * Write path mirrors `RibbonWallDimensionWidget`: `useWallParamsDispatcher`
 * (→ `UpdateWallParamsCommand`, undo + geometry recompute) then
 * `emitBimEntityParamsUpdated('wall', id)` to trigger `useWallRetrimEffect`, which
 * recomputes the junction across all walls. The patch also clears the stale
 * `startMiter`/`startBevel` (resp. end) so the immediate recompute drops the old
 * miter before the debounced retrim rebuilds it fresh.
 *
 * Straight-only — curved/polyline joins land with WallKind Phase 1.5.
 *
 * @see ../../../bim/walls/wall-trims-corner-resolve.ts — resolution logic
 * @see ../../wall-advanced-panel/commands/dispatchWallParamPatch.ts — SSoT writer
 */

import React, { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../../systems/levels';
import { useLiveSelectedEntity } from '../../../systems/selection/useLiveSelectedEntity';
import { isWallEntity } from '../../../types/entities';
import type { WallEntity, WallParams, WallJoinMode } from '../../../bim/types/wall-types';
import { useWallParamsDispatcher } from '../../wall-advanced-panel/commands/dispatchWallParamPatch';
import { emitBimEntityParamsUpdated } from '../../../systems/events/emit-bim-entity-params-updated';

const JOIN_MODES: readonly WallJoinMode[] = ['auto', 'miter', 'butt', 'square', 'disallow'] as const;

/**
 * ADR-458 (wall↔wall cross) — join-priority presets. `undefined` = «auto» (category default,
 * `WALL_JOIN_PRIORITY_BY_CATEGORY`). Higher wins at an X-crossing: the winner stays whole, the
 * loser is cut at the overlap (net volume). Values mirror the category scale.
 */
const PRIORITY_OPTIONS: readonly { readonly key: string; readonly value: number | undefined }[] = [
  { key: 'auto', value: undefined },
  { key: 'low', value: 20 },
  { key: 'medium', value: 40 },
  { key: 'high', value: 80 },
  { key: 'highest', value: 100 },
] as const;

function priorityOptionKey(joinPriority: number | undefined): string {
  return PRIORITY_OPTIONS.find((o) => o.value === joinPriority)?.key ?? 'auto';
}

export function RibbonWallJoinWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const dispatchPatch = useWallParamsDispatcher({ levelManager });

  // ΖΩΝΤΑΝΗ ανάγνωση (SSoT) — το παλιό `useMemo([levelManager, universalSelection])`
  // πάγωνε τον τοίχο στο mount, οπότε ένα join-patch επανέγραφε μπαγιάτικα params.
  const wall = useLiveSelectedEntity<WallEntity>(isWallEntity);

  const setJoin = useCallback(
    (endpoint: 'start' | 'end', mode: WallJoinMode) => {
      if (!wall) return;
      // Clear the stale resolved miter/bevel for THIS endpoint so the immediate
      // recompute drops the old join before the debounced retrim rebuilds it.
      const patch: Partial<WallParams> =
        endpoint === 'start'
          ? { startJoin: mode, startMiter: undefined, startBevel: undefined }
          : { endJoin: mode, endMiter: undefined, endBevel: undefined };
      dispatchPatch(wall, patch);
      emitBimEntityParamsUpdated('wall', wall.id);
    },
    [wall, dispatchPatch],
  );

  const setPriority = useCallback(
    (key: string) => {
      if (!wall) return;
      const value = PRIORITY_OPTIONS.find((o) => o.key === key)?.value;
      // joinPriority steers ONLY the cross cutback (DERIVED at scene time) — no persisted
      // miter/bevel to clear. The emit re-derives the plan/3D/BOQ net geometry.
      dispatchPatch(wall, { joinPriority: value });
      emitBimEntityParamsUpdated('wall', wall.id);
    },
    [wall, dispatchPatch],
  );

  // Joins are only meaningful for straight walls (the only kind computeWallTrims processes).
  if (!wall || wall.kind !== 'straight') return null;

  const startMode = wall.params.startJoin ?? 'auto';
  const endMode = wall.params.endJoin ?? 'auto';

  return (
    <span className="dxf-ribbon-combobox-row flex-col items-start gap-1">
      <JoinDropdown
        labelKey="ribbon.commands.wallEditor.join.start"
        value={startMode}
        onChange={(m) => setJoin('start', m)}
        t={t}
      />
      <JoinDropdown
        labelKey="ribbon.commands.wallEditor.join.end"
        value={endMode}
        onChange={(m) => setJoin('end', m)}
        t={t}
      />
      <span className="flex items-center gap-1">
        <span className="dxf-ribbon-combobox-label">{t('ribbon.commands.wallEditor.join.priority')}</span>
        <Select value={priorityOptionKey(wall.params.joinPriority)} onValueChange={setPriority}>
          <SelectTrigger size="sm" aria-label={t('ribbon.commands.wallEditor.join.priority')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-[9rem]">
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key} className="whitespace-nowrap">
                {t(`ribbon.commands.wallEditor.join.priorityMode.${o.key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    </span>
  );
}

function JoinDropdown({ labelKey, value, onChange, t }: {
  readonly labelKey: string;
  readonly value: WallJoinMode;
  readonly onChange: (mode: WallJoinMode) => void;
  readonly t: (key: string) => string;
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <span className="dxf-ribbon-combobox-label">{t(labelKey)}</span>
      <Select value={value} onValueChange={(v) => onChange(v as WallJoinMode)}>
        <SelectTrigger size="sm" aria-label={t(labelKey)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-[9rem]">
          {JOIN_MODES.map((m) => (
            <SelectItem key={m} value={m} className="whitespace-nowrap">
              {t(`ribbon.commands.wallEditor.join.mode.${m}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}
