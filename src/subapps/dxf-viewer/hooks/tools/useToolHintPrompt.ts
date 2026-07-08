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
 * @param isActive true while the owning tool is the active tool
 * @param key      i18n key suffix under the `tool-hints` namespace, or null to clear
 */
export function useToolHintPrompt(isActive: boolean, key: string | null): void {
  useEffect(() => {
    if (!isActive || key === null) {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
    return () => {
      toolHintOverrideStore.setOverride(null);
    };
  }, [isActive, key]);
}
