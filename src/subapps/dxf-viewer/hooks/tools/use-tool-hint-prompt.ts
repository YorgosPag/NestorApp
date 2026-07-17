/**
 * TOOL HINT PROMPT — SSoT for "publish this tool's prompt while it is active".
 *
 * Every phase-driven modify tool ends with the same effect: while the tool is live,
 * push its current prompt into `toolHintOverrideStore`; the moment it goes idle or
 * unmounts, clear the override so the next tool's hint is not shadowed by a stale one.
 *
 * That effect was byte-identical in `useMoveTool`, `useMirrorTool` and `useRotationTool`,
 * and near-identical in `useScheduleRegionPickTool` (which has no phase). One `active`
 * boolean covers both shapes — callers that have a phase pass `isActive && phase !== 'idle'`.
 *
 * The clear-on-cleanup is the load-bearing part: without it a tool that unmounts mid-phase
 * leaves its prompt pinned in the store.
 *
 * @see hooks/toolHintOverrideStore — the store this writes to
 */
'use client';
import { useEffect } from 'react';
import { toolHintOverrideStore } from '../toolHintOverrideStore';

/**
 * Publishes `prompt` as the tool-hint override while `active`; clears it otherwise and
 * on unmount. Pass `active: false` (not an empty prompt) to stand down.
 */
export function useToolHintPrompt(active: boolean, prompt: string): void {
  useEffect(() => {
    if (!active) {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    toolHintOverrideStore.setOverride(prompt);
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [active, prompt]);
}
