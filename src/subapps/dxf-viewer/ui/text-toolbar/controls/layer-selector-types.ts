/**
 * ADR-344 Phase 5.C / ADR-557 Tier-2 — Layer-picker entry shape (SSoT).
 *
 * Extracted from the retired `LayerSelectorDropdown.tsx` component (the ribbon,
 * ADR-345, superseded that UI). The TYPE survives because it is the contract the
 * live Ribbon layer combobox reads: `ui/ribbon/hooks/bridge/combobox-handlers.ts`
 * and `ui/text-toolbar/hooks/useTextPanelLayers.ts` both consume it via the
 * `controls` barrel. Types file — no logic (N.7.1 size-exempt).
 */

export interface LayerSelectorEntry {
  readonly id: string;
  readonly name: string;
  readonly locked: boolean;
  readonly frozen: boolean;
}
