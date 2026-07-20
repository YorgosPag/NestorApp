'use client';

/**
 * ADR-363 — Editable wall dimension field (length / height / thickness) for the
 * contextual Wall ribbon. ONE widget, three configs (Giorgio: "ίδιος κώδικας").
 *
 * Each field:
 *   - meters I/O, building-scale (mirror `RibbonStairDimensionsWidget`)
 *   - `type=text` + `inputMode=decimal` → δέχεται ΚΑΙ τελεία ΚΑΙ κόμμα
 *     (el-GR υποδιαστολή), normalize μέσω `normalizeNumber` SSoT
 *   - optional dropdown με presets (height/thickness· length = free-form)
 *   - custom stepper βελάκια (▲▼) + ArrowUp/Down
 *   - background = `useSemanticColors().bg.primary` SSoT (ίδιο με τα Radix
 *     Select combobox triggers του ribbon)
 *   - real-time commit μέσω `UpdateWallParamsCommand` (typing → debounced·
 *     preset/stepper/Enter/blur → immediate flush· ESC → cancel + revert)
 *
 * length → μετακινεί `end` κατά μήκος axis (Revit location-line edit, straight
 * only). height/thickness → set param σε mm (×1000· height/thickness ΠΑΝΤΑ mm).
 *
 * ADR-040 micro-leaf: selection + level-scene subscribed στο leaf.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { DXF_TIMING } from '../../../config/dxf-timing';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLevels } from '../../../systems/levels';
import { useLiveSelectedEntity } from '../../../systems/selection/useLiveSelectedEntity';
import { emitBimEntityParamsUpdated } from '../../../systems/events/emit-bim-entity-params-updated';
import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';
import { normalizeNumber } from '../../../systems/dynamic-input/utils/number';
import { isWallEntity } from '../../../types/entities';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import { setWallLengthMeters } from '../../../bim/walls/wall-length-edit';
import {
  setWallHeightMeters,
  setWallThicknessMeters,
} from '../../../bim/walls/wall-dimension-edit';
import { useWallParamsDispatcher } from '../../wall-advanced-panel/commands/dispatchWallParamPatch';

export type WallDimension = 'length' | 'height' | 'thickness';

interface DimensionConfig {
  readonly labelKey: string;
  /** Dropdown presets in meters (empty = free-form, no dropdown). */
  readonly presets: readonly number[];
  /** Stepper increment (meters). */
  readonly step: number;
  /** Stepper floor (meters). */
  readonly min: number;
  /** Decimal places for display (length = 3 → ακρίβεια χιλιοστού· height/thickness = 2). */
  readonly decimals: number;
  /** Editable only on straight walls (length depends on a single axis). */
  readonly straightOnly: boolean;
  read(wall: WallEntity): number | null;
  commit(params: WallParams, meters: number): Partial<WallParams> | null;
}

const CONFIGS: Record<WallDimension, DimensionConfig> = {
  length: {
    labelKey: 'ribbon.commands.wallEditor.length',
    presets: [],
    step: 0.1,
    min: 0.1,
    decimals: 3,
    straightOnly: true,
    read: (w) => w.geometry.length,
    commit: (p, m) => {
      const next = setWallLengthMeters(p, m);
      if (!next) return null;
      if (
        Math.abs(next.end.x - p.end.x) < 1e-6 &&
        Math.abs(next.end.y - p.end.y) < 1e-6
      ) return null;
      return { end: next.end };
    },
  },
  height: {
    labelKey: 'ribbon.commands.wallEditor.height',
    presets: [2.4, 2.7, 3.0, 3.3, 3.6, 4.0],
    step: 0.1,
    min: 0.1,
    decimals: 2,
    straightOnly: false,
    read: (w) => w.params.height / 1000,
    commit: (p, m) => setWallHeightMeters(p, m),
  },
  thickness: {
    labelKey: 'ribbon.commands.wallEditor.thickness',
    presets: [0.1, 0.15, 0.2, 0.25, 0.3, 0.5],
    step: 0.05,
    min: 0.05,
    decimals: 2,
    straightOnly: false,
    read: (w) => w.params.thickness / 1000,
    commit: (p, m) => setWallThicknessMeters(p, m),
  },
};

/** Debounce window for live commit while typing. */
const COMMIT_DEBOUNCE_MS = DXF_TIMING.ui.COMMIT_DEBOUNCE; // ADR-516

function toDraft(meters: number | null, decimals: number): string {
  if (meters === null || !Number.isFinite(meters)) return '';
  return meters.toFixed(decimals);
}

/** Parse a draft accepting both '.' and ',' as the decimal separator. */
function parseMeters(raw: string): number {
  return Number.parseFloat(normalizeNumber(raw.trim()));
}

export function RibbonWallDimensionWidget(
  { dimension }: { readonly dimension: WallDimension },
): React.JSX.Element {
  const cfg = CONFIGS[dimension];
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const levelManager = useLevels();
  const dispatchPatch = useWallParamsDispatcher({ levelManager });

  // ΖΩΝΤΑΝΗ ανάγνωση (SSoT `useLiveSelectedEntity`). Το προηγούμενο
  // `useMemo([levelManager, universalSelection])` πάγωνε τον τοίχο στο mount (και
  // τα δύο deps είναι σταθερά refs) → το commit συνέθετε patch πάνω σε μπαγιάτικα
  // params, οπότε αλλαγή ΠΑΧΟΥΣ επανέγραφε το παλιό `end` (επανέφερε το ΜΗΚΟΣ)
  // και αντίστροφα (Giorgio 2026-07-20).
  const wall = useLiveSelectedEntity<WallEntity>(isWallEntity);

  const currentMeters = wall ? cfg.read(wall) : null;
  const editable = !!wall && (!cfg.straightOnly || wall.kind === 'straight');

  const initialString = useMemo(() => toDraft(currentMeters, cfg.decimals), [currentMeters, cfg.decimals]);
  const [draft, setDraft] = useState<string>(initialString);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef<boolean>(false);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset draft on selection / external change — NOT while editing (a live
  // commit re-renders the scene and would clobber the in-flight draft).
  useEffect(() => {
    if (!focusedRef.current) setDraft(initialString);
  }, [initialString]);

  const clearCommitTimer = useCallback(() => {
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearCommitTimer, [clearCommitTimer]);

  const commitMeters = useCallback((meters: number) => {
    if (!wall) return;
    const patch = cfg.commit(wall.params, meters);
    if (!patch) return; // no-op / invalid → skip dispatch (no undo pollution)
    dispatchPatch(wall, patch);
    // kind→event SSoT: μια γεωμετρική αλλαγή ανακοινώνεται ΜΙΑ φορά, ανεξάρτητα
    // από την επιφάνεια που την έκανε (parity με RibbonWallJoinWidget + grips).
    emitBimEntityParamsUpdated('wall', wall.id);
  }, [wall, cfg, dispatchPatch]);

  const commitDraft = useCallback((raw: string) => {
    const parsed = parseMeters(raw);
    if (Number.isNaN(parsed)) { setDraft(initialString); return; }
    commitMeters(parsed);
  }, [initialString, commitMeters]);

  // Typing → debounced commit (coalesces mid-type keystrokes into 1 undo step).
  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d.,]/g, '');
    setDraft(value);
    clearCommitTimer();
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      commitDraft(value);
    }, COMMIT_DEBOUNCE_MS);
  }, [clearCommitTimer, commitDraft]);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
    clearCommitTimer();
    commitDraft(draft);
  }, [clearCommitTimer, commitDraft, draft]);

  // Stepper + Arrow keys — immediate commit. Base = valid draft else committed.
  const stepBy = useCallback((delta: number) => {
    const parsed = parseMeters(draft);
    const base = Number.isNaN(parsed) ? (currentMeters ?? 0) : parsed;
    const nextVal = Math.max(cfg.min, Math.round((base + delta) * 100) / 100);
    setDraft(nextVal.toFixed(cfg.decimals));
    clearCommitTimer();
    commitMeters(nextVal);
  }, [draft, currentMeters, cfg.min, cfg.decimals, clearCommitTimer, commitMeters]);

  const selectPreset = useCallback((meters: number) => {
    setDraft(meters.toFixed(cfg.decimals));
    clearCommitTimer();
    commitMeters(meters);
  }, [cfg.decimals, clearCommitTimer, commitMeters]);

  // ESC reverts draft + blurs (ADR-364 escape-bus SSoT — owns ESC while focused).
  useEscapeHandler({
    id: `ribbon-wall-${dimension}`,
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => focusedRef.current,
    handle: () => {
      clearCommitTimer();
      setDraft(initialString);
      inputRef.current?.blur();
      return true;
    },
  });

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepBy(cfg.step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(-cfg.step);
    }
  }, [stepBy, cfg.step]);

  const label = t(cfg.labelKey);
  const unit = t('ribbon.commands.wallEditor.lengthUnit');
  const inputBg = colors.bg.primary;

  if (!wall) {
    return (
      <span className="dxf-ribbon-wall-length">
        <span className="dxf-ribbon-wall-length-value">—</span>
      </span>
    );
  }

  if (!editable) {
    return (
      <span className="dxf-ribbon-wall-length">
        <span className="dxf-ribbon-wall-length-label">{label}</span>
        <span className="dxf-ribbon-wall-length-value">
          {currentMeters !== null ? `${currentMeters.toFixed(cfg.decimals)} ${unit}` : '—'}
        </span>
      </span>
    );
  }

  // Keep input focus when a stepper is pressed (no blur-commit race).
  const preventBlur = (e: React.MouseEvent): void => e.preventDefault();

  return (
    <span className="dxf-ribbon-wall-length">
      <span className="dxf-ribbon-wall-length-label">{label}</span>
      <span className="dxf-ribbon-wall-length-field">
        <input
          ref={inputRef}
          className={cn('dxf-ribbon-wall-length-input', inputBg)}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          onChange={onChange}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          aria-label={label}
        />
        {cfg.presets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                className={cn('dxf-ribbon-wall-length-preset', inputBg)}
                aria-label={t('ribbon.commands.wallEditor.presetMenu')}
              >
                <span aria-hidden="true">▾</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {cfg.presets.map((preset) => (
                <DropdownMenuItem key={preset} onSelect={() => selectPreset(preset)}>
                  {`${preset.toFixed(cfg.decimals)} ${unit}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="dxf-ribbon-wall-length-steppers">
          <button
            type="button"
            tabIndex={-1}
            className={cn('dxf-ribbon-wall-length-step', inputBg)}
            aria-label={t('ribbon.commands.wallEditor.lengthIncrease')}
            onMouseDown={preventBlur}
            onClick={() => stepBy(cfg.step)}
          >
            <span aria-hidden="true">▲</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className={cn('dxf-ribbon-wall-length-step', inputBg)}
            aria-label={t('ribbon.commands.wallEditor.lengthDecrease')}
            onMouseDown={preventBlur}
            onClick={() => stepBy(-cfg.step)}
          >
            <span aria-hidden="true">▼</span>
          </button>
        </span>
      </span>
      <span className="dxf-ribbon-wall-length-unit">{unit}</span>
    </span>
  );
}
