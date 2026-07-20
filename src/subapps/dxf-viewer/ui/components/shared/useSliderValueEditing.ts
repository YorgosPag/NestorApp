/**
 * =============================================================================
 * useSliderValueEditing — draft/commit state machine for SliderValueField
 * =============================================================================
 *
 * Extracted from the component, then decomposed into four single-job units so
 * no function exceeds the 40-line cap (N.7.1):
 *
 *   evaluateCommit / resolveNudgeBase   pure decisions, no React
 *   useSliderDraft                      draft state + invalidation effects
 *   useSliderPush                       the single onChange emit door
 *   useSliderCommit / Nudge / Cancel    one action each
 *   useSliderFocus/Text/KeyDown         DOM event handlers, one concern each
 *   useSliderValueEditing               composition (public)
 *
 * The draft lives in DISPLAY space (`unit.formatEdit` / `unit.parse`), the
 * `value` prop lives in MODEL space. Every crossing goes through the unit —
 * there is no other conversion in this file.
 *
 * Four failure modes this machine exists to prevent, all observed in the field:
 *
 *  1. COMMIT ON UNTOUCHED TEXT. Blur used to always re-quantize, so a bare Tab
 *     across a field holding an off-grid value rewrote the setting
 *     (0.8 → 1.0). The text captured at focus is compared verbatim; identical
 *     text means the user did not edit, which means NO onChange at all.
 *  2. NUDGE FROM AN EMPTY DRAFT. `Number('')` is 0, so clearing the field and
 *     pressing ArrowUp collapsed the value to min. The nudge base is a valid
 *     parse of the draft, else the `value` prop. Never 0.
 *  3. STALE DRAFT AFTER AN EXTERNAL CHANGE. A field disabled programmatically
 *     mid-typing kept showing the abandoned draft. External value changes and
 *     transitions to `disabled` both drop it.
 *  4. ESCAPE THAT DID NOT REVERT. Arrow nudges push on every keypress, so
 *     dropping the draft left the already-emitted value in place — the
 *     documented "Escape reverts" contract held for typing and broke for
 *     nudging. Escape now restores the value captured at FOCUS time: it
 *     cancels the SESSION, not merely the unsent text.
 *
 * Rejection is always VISIBLE (`status`), never silent — including the
 * out-of-range case, which commits a clamped value but says so.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clamp } from '../../../utils/scalar-math';
import { quantizeToStep } from '../../../rendering/entities/shared/geometry-utils';
import { handleInlineRenameKey } from '../../utils/inline-rename-keyboard';
import type { SliderValueUnit } from './slider-value-units';

/** Coarse nudge multiplier — Shift+Arrow, matching C4D / Figma. */
const COARSE_NUDGE_STEPS = 10;

/**
 * `ok`       — nothing to report.
 * `rejected` — unparseable text, reverted, NO commit.
 * `clamped`  — parseable but out of [min,max]; committed at the bound, flagged.
 */
export type SliderValueStatus = 'ok' | 'rejected' | 'clamped';

/** The numeric envelope a value must land in. */
interface ValueRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

// =============================================================================
// PURE STEP-GRID MATH
// =============================================================================

/** Decimal places carried by `step` — used to kill float noise after quantizing. */
function decimalsOfStep(step: number): number {
  const text = String(step);
  const exponent = text.indexOf('e-');
  if (exponent >= 0) return Number(text.slice(exponent + 2));
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * Clamp to [min,max] and quantize to the step grid anchored at `min`
 * (the same grid Radix Slider uses), then strip float noise.
 */
export function normalizeSliderValue(
  raw: number,
  min: number,
  max: number,
  step: number
): number {
  const clamped = clamp(raw, min, max);
  const quantized = step > 0 ? min + quantizeToStep(clamped - min, step) : clamped;
  const bounded = clamp(quantized, min, max);
  const factor = 10 ** decimalsOfStep(step);
  return Math.round(bounded * factor) / factor;
}

// =============================================================================
// PURE DECISIONS — the commit rules, decided without touching React
// =============================================================================

export interface CommitOutcome {
  readonly status: SliderValueStatus;
  /** `null` = do not emit. Distinct from 0, which is a legitimate value. */
  readonly committed: number | null;
}

/**
 * Decides what a blur/Enter on `text` means. `focusText` is the text captured
 * when the field was focused — identical text is not an edit (failure mode 1).
 */
export function evaluateCommit(
  text: string,
  focusText: string,
  unit: SliderValueUnit,
  range: ValueRange
): CommitOutcome {
  if (text === focusText) return { status: 'ok', committed: null };

  const parsed = unit.parse(text);
  if (parsed === null) return { status: 'rejected', committed: null };

  const { min, max, step } = range;
  const committed = normalizeSliderValue(parsed, min, max, step);
  // `clamped` means "what we stored is not what you typed" — whether the value
  // was pulled into range OR snapped onto the step grid. Typing 85 on a
  // step=10 percent slider stores 90; that substitution must stay visible.
  const status: SliderValueStatus = committed !== parsed ? 'clamped' : 'ok';
  return { status, committed };
}

/**
 * Base for an arrow-key nudge: a valid parse of the in-flight draft, else the
 * committed prop. NEVER a coerced 0 (failure mode 2).
 */
export function resolveNudgeBase(
  draft: string | null,
  value: number,
  unit: SliderValueUnit
): number {
  const fromDraft = draft === null ? null : unit.parse(draft);
  return fromDraft ?? value;
}

// =============================================================================
// DRAFT STATE — ownership of the in-flight text and its invalidation
// =============================================================================

interface SliderDraft {
  readonly draft: string | null;
  readonly status: SliderValueStatus;
  readonly isEditing: boolean;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  /** Text captured at focus — the baseline for "did the user actually edit?". */
  readonly focusTextRef: React.MutableRefObject<string>;
  /** Set right before a programmatic blur() so blur does not commit twice. */
  readonly skipBlurRef: React.MutableRefObject<boolean>;
  /**
   * The committed value as it stood when the field took focus — the point
   * Escape restores to. `null` when no session is open (failure mode 4).
   */
  readonly sessionValueRef: React.MutableRefObject<number | null>;
  /** Records a value THIS field emitted, so its echo is not seen as external. */
  readonly markSelfValue: (next: number) => void;
  readonly setDraft: (text: string | null) => void;
  readonly setStatus: (status: SliderValueStatus) => void;
  readonly reset: () => void;
}

/**
 * Failure mode 3 — a draft is only valid while the world behind it holds still.
 * An external value change or a programmatic disable both discard it.
 */
function useDraftInvalidation(
  value: number,
  disabled: boolean,
  selfValueRef: React.MutableRefObject<number>,
  reset: () => void
): void {
  useEffect(() => {
    if (value === selfValueRef.current) return;
    selfValueRef.current = value;
    reset();
  }, [value, selfValueRef, reset]);

  useEffect(() => {
    if (disabled) reset();
  }, [disabled, reset]);
}

function useSliderDraft(value: number, disabled: boolean): SliderDraft {
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTextRef = useRef('');
  const skipBlurRef = useRef(false);
  const selfValueRef = useRef(value);
  const sessionValueRef = useRef<number | null>(null);

  /** `null` = not editing; string = in-flight draft text (display space). */
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<SliderValueStatus>('ok');

  const isEditing = draft !== null;

  const reset = useCallback(() => {
    sessionValueRef.current = null;
    setDraft(null);
    setStatus('ok');
  }, []);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  useDraftInvalidation(value, disabled, selfValueRef, reset);

  const markSelfValue = useCallback((next: number) => {
    selfValueRef.current = next;
  }, []);

  return {
    draft, status, isEditing, inputRef, focusTextRef, skipBlurRef, sessionValueRef,
    markSelfValue, setDraft, setStatus, reset,
  };
}

// =============================================================================
// ACTIONS — commit and nudge, wired to the pure decisions above
// =============================================================================

interface SliderActions {
  readonly commit: (text: string) => void;
  readonly nudge: (direction: 1 | -1, coarse: boolean) => void;
  /** Escape — abandons the WHOLE session, including already-pushed nudges. */
  readonly cancel: () => void;
}

interface CommitActionsArgs {
  readonly state: SliderDraft;
  readonly value: number;
  readonly range: ValueRange;
  readonly unit: SliderValueUnit;
  readonly onChange: (value: number) => void;
}

/** The single emit door: records the value as ours, then notifies if it moved. */
type PushValue = (next: number) => void;

function useSliderPush(state: SliderDraft, value: number, onChange: (v: number) => void): PushValue {
  const { markSelfValue } = state;
  return useCallback(
    (next: number) => {
      markSelfValue(next);
      if (next !== value) onChange(next);
    },
    [markSelfValue, value, onChange]
  );
}

function useSliderCommit(
  state: SliderDraft,
  range: ValueRange,
  unit: SliderValueUnit,
  push: PushValue
): SliderActions['commit'] {
  const { setDraft, setStatus, focusTextRef, sessionValueRef, draft } = state;

  return useCallback(
    (text: string) => {
      // No draft = no in-flight edit = nothing to commit. Guards the path where
      // an external value change reset the draft while the field still had
      // focus: `focusTextRef` is stale there, so comparing against it would
      // re-quantize a value the user never touched.
      if (draft === null) return;
      const outcome = evaluateCommit(text, focusTextRef.current, unit, range);
      sessionValueRef.current = null;
      setDraft(null);
      setStatus(outcome.status);
      if (outcome.committed !== null) push(outcome.committed);
    },
    [draft, focusTextRef, sessionValueRef, unit, range, setDraft, setStatus, push]
  );
}

function useSliderNudge(
  state: SliderDraft,
  value: number,
  range: ValueRange,
  unit: SliderValueUnit,
  push: PushValue
): SliderActions['nudge'] {
  const { setDraft, setStatus, draft } = state;

  const { sessionValueRef } = state;

  return useCallback(
    (direction: 1 | -1, coarse: boolean) => {
      // RE-ARM the Escape baseline. An external value change calls `reset()`,
      // which clears the baseline — but the input never lost focus, so the
      // session is still alive. Without this, every nudge after such a change
      // pushes a value that Escape can no longer undo: failure mode 4,
      // reconstituted. The baseline becomes the post-external value, which is
      // the correct thing to return to.
      sessionValueRef.current ??= value;

      const base = resolveNudgeBase(draft, value, unit);
      const delta = direction * range.step * (coarse ? COARSE_NUDGE_STEPS : 1);
      const next = normalizeSliderValue(base + delta, range.min, range.max, range.step);
      setDraft(unit.formatEdit(next));
      setStatus('ok');
      push(next);
    },
    [draft, value, unit, range, sessionValueRef, setDraft, setStatus, push]
  );
}

/**
 * Escape (failure mode 4). Dropping the draft is NOT enough: an arrow nudge
 * pushes immediately, so by the time Escape arrives the setting has already
 * moved — the header of SliderInput promised "Escape reverts" and, after a
 * nudge, broke that promise silently.
 *
 * So Escape restores the value captured at FOCUS time, i.e. it cancels the
 * editing session rather than just the unsent text. Nothing is emitted when the
 * session never moved the value: `push` only calls `onChange` on a real change,
 * which keeps the operation idempotent (N.7.2 §3).
 */
function useSliderCancel(state: SliderDraft, push: PushValue): SliderActions['cancel'] {
  const { sessionValueRef, reset } = state;

  return useCallback(() => {
    const baseline = sessionValueRef.current;
    reset();
    if (baseline !== null) push(baseline);
  }, [sessionValueRef, reset, push]);
}

function useSliderCommitActions({
  state, value, range, unit, onChange,
}: CommitActionsArgs): SliderActions {
  const push = useSliderPush(state, value, onChange);

  return {
    commit: useSliderCommit(state, range, unit, push),
    nudge: useSliderNudge(state, value, range, unit, push),
    cancel: useSliderCancel(state, push),
  };
}

// =============================================================================
// HANDLERS — DOM events only
// =============================================================================

interface SliderHandlers {
  readonly handleFocus: () => void;
  readonly handleTextChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly handleBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  readonly handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

/** Arrow nudging + local Enter/Escape. Split out to keep each hook under 40. */
function useSliderKeyDown(
  state: SliderDraft,
  actions: SliderActions
): SliderHandlers['handleKeyDown'] {
  const { skipBlurRef } = state;
  const { commit, nudge, cancel } = actions;

  return useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        nudge(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey);
        return;
      }
      // Local Enter/Escape via the SSoT helper (ADR-364 allowlist): the Escape
      // Command Bus intentionally skips editable focus.
      const target = event.currentTarget;
      handleInlineRenameKey(event, {
        onConfirm: () => {
          skipBlurRef.current = true;
          commit(target.value);
          target.blur();
        },
        onCancel: () => {
          skipBlurRef.current = true;
          cancel();
          target.blur();
        },
      });
    },
    [nudge, commit, cancel, skipBlurRef]
  );
}

/**
 * Session entry. Captures TWO baselines, for two different questions:
 *   focusTextRef    — "did the user actually edit?"  (blur comparison)
 *   sessionValueRef — "what does Escape restore?"
 * Both are taken at focus, not on the first keystroke: an arrow nudge is an
 * edit that never produces a keystroke.
 */
function useSliderFocusHandler(
  state: SliderDraft,
  value: number,
  unit: SliderValueUnit
): SliderHandlers['handleFocus'] {
  const { setDraft, setStatus, focusTextRef, sessionValueRef, skipBlurRef } = state;

  return useCallback(() => {
    const text = unit.formatEdit(value);
    focusTextRef.current = text;
    sessionValueRef.current = value;
    // Disarm the blur latch. It is set BEFORE a programmatic blur(); if that
    // blur never fires, a stale `true` would swallow the NEXT real commit.
    // Clearing it on entry makes the latch idempotent for free.
    skipBlurRef.current = false;
    setDraft(text);
    setStatus('ok');
  }, [unit, value, focusTextRef, sessionValueRef, skipBlurRef, setDraft, setStatus]);
}

function useSliderTextHandlers(
  state: SliderDraft,
  commit: SliderActions['commit']
): Pick<SliderHandlers, 'handleTextChange' | 'handleBlur'> {
  const { setDraft, setStatus, skipBlurRef } = state;

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(event.target.value);
      setStatus('ok');
    },
    [setDraft, setStatus]
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (skipBlurRef.current) {
        skipBlurRef.current = false;
        return;
      }
      commit(event.target.value);
    },
    [skipBlurRef, commit]
  );

  return { handleTextChange, handleBlur };
}

function useSliderFieldHandlers(
  state: SliderDraft,
  actions: SliderActions,
  value: number,
  unit: SliderValueUnit
): SliderHandlers {
  return {
    handleFocus: useSliderFocusHandler(state, value, unit),
    ...useSliderTextHandlers(state, actions.commit),
    handleKeyDown: useSliderKeyDown(state, actions),
  };
}

// =============================================================================
// PUBLIC HOOK — composition
// =============================================================================

export interface SliderValueEditingArgs {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: SliderValueUnit;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
}

export interface SliderValueEditing extends SliderHandlers {
  /** What the input must display right now. */
  readonly text: string;
  readonly status: SliderValueStatus;
  readonly isEditing: boolean;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
}

export function useSliderValueEditing({
  value, min, max, step, unit, disabled, onChange,
}: SliderValueEditingArgs): SliderValueEditing {
  const range = useMemo<ValueRange>(() => ({ min, max, step }), [min, max, step]);

  const state = useSliderDraft(value, disabled);
  const actions = useSliderCommitActions({ state, value, range, unit, onChange });
  const handlers = useSliderFieldHandlers(state, actions, value, unit);

  return {
    text: state.draft ?? unit.format(value),
    status: state.status,
    isEditing: state.isEditing,
    inputRef: state.inputRef,
    ...handlers,
  };
}
