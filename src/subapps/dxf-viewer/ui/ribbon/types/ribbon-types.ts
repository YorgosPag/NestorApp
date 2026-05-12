/**
 * ADR-345 §9 — Ribbon data model.
 * Phase 1 scaffold: command/button shapes are declared for future use
 * but panels are intentionally empty (no buttons wired).
 */

export type ButtonSize = 'large' | 'small';
export type ButtonType = 'simple' | 'split' | 'toggle' | 'dropdown' | 'combobox';

/**
 * ADR-345 §4.5 Fase 5.5 — One option entry for a RibbonCombobox button.
 * Static option lists (e.g. lineSpacing 1.0/1.5/2.0) live on the data
 * declaration. Dynamic option lists (fonts, layers, scales) come from
 * the bridge via `getComboboxState(commandKey).options` and override
 * the static list at runtime.
 */
export interface RibbonComboboxOption {
  /** Stable value passed through onComboboxChange. */
  value: string;
  /** i18n key OR ready-to-render label (used for dynamic options like font names). */
  labelKey: string;
  /** When true, `labelKey` is already a literal — do NOT pass through t(). */
  isLiteralLabel?: boolean;
}

export interface RibbonCommand {
  id: string;
  labelKey: string;
  icon?: string;
  iconSmall?: string;
  commandKey: string;
  shortcut?: string;
  tooltipKey?: string;
  /**
   * ADR-345 §3.2 Fase 4 — Tool listed in ADR but underlying ToolType /
   * DXF command not yet implemented. Click shows a "Coming Soon" toast
   * instead of dispatching the tool.
   */
  comingSoon?: boolean;
  /**
   * ADR-345 Fase 5 — Non-ToolType action (e.g. 'zoom-extents', 'undo',
   * 'redo'). When present, the button fires `onAction(action, data)`
   * instead of `onToolChange(commandKey)`. `data` is an optional payload
   * forwarded to handleAction.
   */
  action?: string;
  actionData?: number | string | Record<string, unknown>;
  /**
   * ADR-345 §4.5 Fase 5.5 — Static option list for a combobox button.
   * Used when options are known at data-declaration time (e.g. line
   * spacing presets). For dynamic lists (fonts, layers, scales) leave
   * undefined and rely on the bridge's getComboboxState().options.
   */
  options?: readonly RibbonComboboxOption[];
  /**
   * ADR-345 §4.5 Fase 5.5 — Trigger width in px for a combobox button.
   * Applied as a CSS variable on the trigger element. Defaults to 140.
   */
  comboboxWidthPx?: number;
}

export interface RibbonButton {
  type: ButtonType;
  size: ButtonSize;
  command: RibbonCommand;
  variants?: RibbonCommand[];
  lastVariantId?: string;
  isActive?: boolean;
}

export interface RibbonRow {
  buttons: RibbonButton[];
  isInFlyout: boolean;
}

export interface RibbonPanelDef {
  id: string;
  labelKey: string;
  rows: RibbonRow[];
  isPinned?: boolean;
}

export interface RibbonTab {
  id: string;
  labelKey: string;
  panels: RibbonPanelDef[];
  isContextual?: boolean;
  contextualTrigger?: string;
}

export type RibbonMinimizeState =
  | 'full'
  | 'panel-buttons'
  | 'panel-titles'
  | 'tab-names';

export interface RibbonPersistedState {
  activeTabId: string;
  minimizeState: RibbonMinimizeState;
  tabOrder: string[];
  pinnedPanelIds: string[];
  splitLastUsed: Record<string, string>;
}

export const RIBBON_MINIMIZE_CYCLE: readonly RibbonMinimizeState[] = [
  'full',
  'panel-buttons',
  'panel-titles',
  'tab-names',
] as const;

export const RIBBON_LS_KEYS = {
  activeTabId: 'dxf-ribbon:activeTabId',
  minimizeState: 'dxf-ribbon:minimizeState',
  tabOrder: 'dxf-ribbon:tabOrder',
  pinnedPanelIds: 'dxf-ribbon:pinnedPanelIds',
  splitLastUsed: 'dxf-ribbon:splitLastUsed',
} as const;

export const RIBBON_NARROW_BREAKPOINT_PX = 900;
