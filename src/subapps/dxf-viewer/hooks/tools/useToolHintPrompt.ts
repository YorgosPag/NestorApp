import { useEffect } from 'react';
import i18next from 'i18next';
import { toolHintOverrideStore } from '../toolHintOverrideStore';

/**
 * ADR-589 — status-bar tool-hint prompt sync SSoT.
 *
 * Replaces the byte-copied "status-bar prompt sync" effect across the modify
 * tool hooks (trim/extend/fillet/chamfer/offset):
 *
 * ```ts
 * useEffect(() => {
 *   if (!isActive || phase === 'idle') { toolHintOverrideStore.setOverride(null); return; }
 *   const key = <per-tool ternary>;
 *   toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
 *   return () => { toolHintOverrideStore.setOverride(null); };
 * }, [isActive, phase]);
 * ```
 *
 * The two per-tool differences — the clear condition (`!isActive` vs
 * `!isActive || phase === 'idle'`) AND the key ternary — are BOTH folded into
 * the caller-resolved `key`: pass `null` to clear the override (inactive or an
 * idle phase), or the i18n key SUFFIX (the `tool-hints:` namespace is prepended
 * here) to show that prompt. `key` is derived from `phase`/`polylineMode` at the
 * call site, so `[isActive, key]` is the correct dependency (React: depend on
 * the value you use) — every distinct prompt maps to a distinct key, so this is
 * user-visible-identical to the previous `[isActive, phase]` effects.
 *
 * Two entry points, ONE effect: `useToolHintPrompt` for callers whose prompt is a
 * `tool-hints:` key, `useToolHintPromptText` for callers that already hold the resolved
 * string. The move/mirror/rotate/schedule-pick tools need the latter — they resolve
 * from OTHER namespaces (`dxf-viewer-guides:`, `dxf-schedule:`), so the hardcoded
 * `tool-hints:` prefix here cannot serve them. That gap is why the same effect had
 * survived, byte-copied, in those four hooks after ADR-589 folded the other five.
 *
 * @param isActive true while the owning tool is the active tool
 * @param key      i18n key suffix under the `tool-hints` namespace, or null to clear
 */
export function useToolHintPrompt(isActive: boolean, key: string | null): void {
  useToolHintPromptText(isActive, key === null ? null : i18next.t(`tool-hints:${key}`));
}

/**
 * The resolved-text variant — same publish/clear contract, no i18n resolution.
 *
 * Use when the prompt comes from a namespace other than `tool-hints`, or is already
 * interpolated. Pass `null` (or `active: false`) to clear; callers with a phase pass
 * `isActive && phase !== 'idle'`.
 *
 * The clear-on-cleanup is the load-bearing part: without it a tool that unmounts
 * mid-phase leaves its prompt pinned in the store.
 *
 * @param active true while this tool should own the status-bar hint
 * @param text   the resolved prompt, or null to clear
 */
export function useToolHintPromptText(active: boolean, text: string | null): void {
  useEffect(() => {
    if (!active || text === null) {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    toolHintOverrideStore.setOverride(text);
    return () => {
      toolHintOverrideStore.setOverride(null);
    };
  }, [active, text]);
}
