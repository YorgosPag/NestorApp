/**
 * ADR-363/583 — the core member shape EVERY contextual ribbon bridge exposes.
 *
 * Combobox read/write, toggle read/write and simple-button action are identical across the
 * opening / scale-bar / wall / … bridges; each family bridge `extends RibbonBridgeCore` and adds
 * ONLY its family-specific members (e.g. `getBadgeState`, `getPanelVisibility`). The shared shape
 * lives ONCE here instead of being copy-pasted per bridge interface (N.18).
 */

import type { RibbonComboboxState, RibbonToggleState } from '../../context/RibbonCommandContext';

export interface RibbonBridgeCore {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
}
