/**
 * ADR-345 §9 — Ribbon data model.
 * Phase 1 scaffold: command/button shapes are declared for future use
 * but panels are intentionally empty (no buttons wired).
 */

export type ButtonSize = 'large' | 'small';
export type ButtonType = 'simple' | 'split' | 'toggle' | 'dropdown' | 'combobox';

export interface RibbonCommand {
  id: string;
  labelKey: string;
  icon?: string;
  iconSmall?: string;
  commandKey: string;
  shortcut?: string;
  tooltipKey?: string;
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
