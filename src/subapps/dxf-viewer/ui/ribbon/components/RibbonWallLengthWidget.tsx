'use client';

/**
 * ADR-363 — Editable wall length field for the contextual Wall ribbon.
 *
 * Mirror του `RibbonStairDimensionsWidget` (meters read-out convention,
 * building-scale). Commit μετακινεί το `end` κατά μήκος του axis κρατώντας
 * `start` + bearing (Revit "location line" length edit) μέσω
 * `setWallLengthMeters` + `UpdateWallParamsCommand` (undo/redo + geometry
 * recompute). Straight-only — curved/polyline εμφανίζονται read-only.
 *
 * Input = `type="text"` + `inputMode="decimal"` ώστε να δέχεται ΚΑΙ τελεία ΚΑΙ
 * κόμμα (el-GR υποδιαστολή). Normalize μέσω `normalizeNumber` SSoT. Custom
 * stepper βελάκια (▲▼) αντί native number spinner (το `type=number` μπλοκάρει
 * το κόμμα ανάλογα με locale) — step 0.1 m, immediate commit, κρατούν το focus.
 *
 * Live commit: typing → debounced (coalesce mid-type keystrokes σε 1 undo step),
 * steppers/Enter/blur → immediate flush, ESC → cancel + revert (escape-bus SSoT).
 *
 * ADR-040 micro-leaf: selection + level-scene subscribed στο leaf, όχι στο
 * orchestrator panel.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useEscapeHandler, ESC_PRIORITY } from '../../../systems/escape-bus';
import { normalizeNumber } from '../../../systems/dynamic-input/utils/number';
import { isWallEntity } from '../../../types/entities';
import type { WallEntity } from '../../../bim/types/wall-types';
import { setWallLengthMeters } from '../../../bim/walls/wall-length-edit';
import { useWallParamsDispatcher } from '../../wall-advanced-panel/commands/dispatchWallParamPatch';

/** Debounce window for live commit while typing. */
const COMMIT_DEBOUNCE_MS = 200;
/** Stepper increment (meters). */
const STEP_M = 0.1;
/** Minimum length (meters) — mirrors MIN_WALL_LENGTH_MM clamp in setWallLengthMeters. */
const MIN_M = 0.1;

function toDraft(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters)) return '';
  return meters.toFixed(2);
}

/** Parse a draft string accepting both '.' and ',' as the decimal separator. */
function parseMeters(raw: string): number {
  return Number.parseFloat(normalizeNumber(raw.trim()));
}

export function RibbonWallLengthWidget(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const dispatchPatch = useWallParamsDispatcher({ levelManager });

  const wall = useMemo<WallEntity | null>(() => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isWallEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  const currentMeters = wall ? wall.geometry.length : null;
  const editable = !!wall && wall.kind === 'straight';

  const initialString = useMemo(() => toDraft(currentMeters), [currentMeters]);
  const [draft, setDraft] = useState<string>(initialString);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef<boolean>(false);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset draft when the selection / external geometry changes — but NOT while
  // the user is editing: a live commit re-renders the scene and would otherwise
  // clobber the in-flight draft / cursor mid-type.
  useEffect(() => {
    if (!focusedRef.current) setDraft(initialString);
  }, [initialString]);

  const clearCommitTimer = useCallback(() => {
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  // Cancel any pending commit on unmount.
  useEffect(() => clearCommitTimer, [clearCommitTimer]);

  // Core numeric commit — moves `end`, skips no-op dispatch so an unchanged
  // value (debounce re-fire / clamped step) never pollutes the undo stack.
  const commitMeters = useCallback((meters: number) => {
    if (!wall) return;
    const next = setWallLengthMeters(wall.params, meters);
    if (!next) return;
    if (
      Math.abs(next.end.x - wall.params.end.x) < 1e-6 &&
      Math.abs(next.end.y - wall.params.end.y) < 1e-6
    ) return;
    dispatchPatch(wall, { end: next.end });
  }, [wall, dispatchPatch]);

  const commitDraft = useCallback((raw: string) => {
    const parsed = parseMeters(raw);
    if (Number.isNaN(parsed)) { setDraft(initialString); return; }
    commitMeters(parsed);
  }, [initialString, commitMeters]);

  // Typing → debounced commit (coalesces mid-type keystrokes). Filters to
  // digits + the two decimal separators so junk chars never enter the draft.
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

  // Stepper (buttons + Arrow keys) — immediate commit. Base = current draft if
  // valid, else the committed geometry length, so steps never drift.
  const stepBy = useCallback((delta: number) => {
    const parsed = parseMeters(draft);
    const base = Number.isNaN(parsed) ? (currentMeters ?? 0) : parsed;
    const nextVal = Math.max(MIN_M, Math.round((base + delta) * 100) / 100);
    setDraft(nextVal.toFixed(2));
    clearCommitTimer();
    commitMeters(nextVal);
  }, [draft, currentMeters, clearCommitTimer, commitMeters]);

  // ESC reverts draft + blurs (ADR-364 escape-bus SSoT — owns ESC while focused).
  useEscapeHandler({
    id: 'ribbon-wall-length',
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
      stepBy(STEP_M);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(-STEP_M);
    }
  }, [stepBy]);

  const label = t('ribbon.commands.wallEditor.length');
  const unit = t('ribbon.commands.wallEditor.lengthUnit');

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
          {currentMeters !== null ? `${currentMeters.toFixed(2)} ${unit}` : '—'}
        </span>
      </span>
    );
  }

  // Keep focus in the input when a stepper is pressed (no blur-commit race).
  const preventBlur = (e: React.MouseEvent): void => e.preventDefault();

  return (
    <span className="dxf-ribbon-wall-length">
      <span className="dxf-ribbon-wall-length-label">{label}</span>
      <span className="dxf-ribbon-wall-length-field">
        <input
          ref={inputRef}
          className="dxf-ribbon-wall-length-input"
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
        <span className="dxf-ribbon-wall-length-steppers">
          <button
            type="button"
            tabIndex={-1}
            className="dxf-ribbon-wall-length-step"
            aria-label={t('ribbon.commands.wallEditor.lengthIncrease')}
            onMouseDown={preventBlur}
            onClick={() => stepBy(STEP_M)}
          >
            <span aria-hidden="true">▲</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="dxf-ribbon-wall-length-step"
            aria-label={t('ribbon.commands.wallEditor.lengthDecrease')}
            onMouseDown={preventBlur}
            onClick={() => stepBy(-STEP_M)}
          >
            <span aria-hidden="true">▼</span>
          </button>
        </span>
      </span>
      <span className="dxf-ribbon-wall-length-unit">{unit}</span>
    </span>
  );
}
