'use client';

/**
 * ADR-646 Φ4 #6 — Bridge between the contextual «Κλιμάκωση» ribbon tab and
 * `ScaleToolStore`.
 *
 * Self-contained (like `useRibbonXlineModeBridge`): reads state via
 * `useSyncExternalStore`, writes directly to the store. The three surfaces:
 *
 *   - Factor combobox  → `commitUniformScale` (routes to the hook-registered
 *     `executeScale` — the SAME commit path as typed-Enter in the `direct` sub-phase).
 *   - Copy / Non-uniform toggles → `setCopyMode` / `setNonUniformMode` (the latter
 *     also transitions the sub-phase mid-operation, mirroring the keyboard `N`).
 *   - Reference action → moves to the reference-pick sub-phase (mirrors keyboard `R`).
 *
 * No-ops for keys outside `SCALE_TOOL_RIBBON_KEYS` so it composes with every other
 * bridge in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-646-scale-tool-gap-analysis.md §#6
 */

import { useSyncExternalStore } from 'react';
import { ScaleToolStore } from '../../../systems/scale/ScaleToolStore';
import {
  SCALE_TOOL_RIBBON_KEYS,
  isScaleToolRibbonKey,
  isScaleToolToggleKey,
  isScaleToolActionKey,
} from './bridge/scale-tool-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';

export interface RibbonScaleToolBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (commandKey: string) => void;
}

const NULL_TOGGLE: RibbonToggleState = false;

/** Trim trailing zeros so the factor reads AutoCAD-style ("2", "0.5", not "2.00"). */
function formatFactor(n: number): string {
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(4)).toString();
}

export function useRibbonScaleToolBridge(): RibbonScaleToolBridge {
  const state = useSyncExternalStore(
    ScaleToolStore.subscribe,
    ScaleToolStore.getState,
    ScaleToolStore.getState,
  );

  const getComboboxState = (commandKey: string): RibbonComboboxState | null => {
    if (!isScaleToolRibbonKey(commandKey)) return null;
    // Show what the user is typing on the canvas, else the last committed factor.
    const value = state.numericBuffer !== '' ? state.numericBuffer : formatFactor(state.currentSx);
    return { value, options: [] };
  };

  const onComboboxChange = (commandKey: string, value: string): void => {
    if (!isScaleToolRibbonKey(commandKey)) return;
    const factor = Number.parseFloat(value);
    if (Number.isNaN(factor) || factor === 0) return;
    ScaleToolStore.commitUniformScale(factor);
  };

  const getToggleState = (commandKey: string): RibbonToggleState => {
    if (commandKey === SCALE_TOOL_RIBBON_KEYS.toggles.copy) return state.copyMode;
    if (commandKey === SCALE_TOOL_RIBBON_KEYS.toggles.nonUniform) return state.nonUniformMode;
    return NULL_TOGGLE;
  };

  const onToggle = (commandKey: string, nextValue: boolean): void => {
    if (!isScaleToolToggleKey(commandKey)) return;
    if (commandKey === SCALE_TOOL_RIBBON_KEYS.toggles.copy) {
      ScaleToolStore.setCopyMode(nextValue);
      return;
    }
    // Non-uniform — mirror keyboard `N`: set the flag and, if mid-operation in a
    // direct sub-phase, transition so the tool collects X then Y (or back to the
    // single-factor `direct` when turned off). The flag also arms a pre-start
    // toggle (honoured by `useScaleTool.handleScaleClick` on the base-point pick).
    ScaleToolStore.setNonUniformMode(nextValue);
    const s = ScaleToolStore.getState();
    if (s.phase !== 'scale_input') return;
    if (nextValue && s.subPhase === 'direct') ScaleToolStore.setSubPhase('direct_x');
    else if (!nextValue && (s.subPhase === 'direct_x' || s.subPhase === 'direct_y')) {
      ScaleToolStore.setSubPhase('direct');
    }
  };

  const onAction = (commandKey: string): void => {
    if (!isScaleToolActionKey(commandKey)) return;
    // Reference-pick — mirror keyboard `R`: only meaningful once a base point exists
    // (scale_input). Route to the Y reference triple if the user is on the Y axis.
    const s = ScaleToolStore.getState();
    if (s.phase !== 'scale_input') return;
    ScaleToolStore.setSubPhase(s.subPhase === 'direct_y' ? 'ref_p1_y' : 'ref_p1_x');
  };

  return { onComboboxChange, getComboboxState, onToggle, getToggleState, onAction };
}
