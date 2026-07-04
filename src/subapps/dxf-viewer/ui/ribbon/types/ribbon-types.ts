/**
 * ADR-345 §9 — Ribbon data model.
 * Phase 1 scaffold: command/button shapes are declared for future use
 * but panels are intentionally empty (no buttons wired).
 */

export type ButtonSize = 'large' | 'small';
export type ButtonType = 'simple' | 'split' | 'toggle' | 'dropdown' | 'combobox' | 'widget' | 'color-swatch';

/**
 * ADR-345 §4.5 Fase 5.5 — One option entry for a RibbonCombobox button.
 * Static option lists (e.g. lineSpacing 1.0/1.5/2.0) live on the data
 * declaration. Dynamic option lists (fonts, layers, scales) come from
 * the bridge via `getComboboxState(commandKey).options` and override
 * the static list at runtime.
 */
/**
 * ADR-562 Φ8 — Inline-SVG preview descriptor για ένα combobox option (linetype
 * μοτίβο / arrowhead σχήμα). Rendered από το `RibbonComboboxThumbnail` με
 * `currentColor` (theme-correct). Η γεωμετρία αντλείται live από τα SSoT builders.
 */
export type RibbonComboboxThumbnailDescriptor =
  | { readonly kind: 'linetype'; readonly name: string }
  | { readonly kind: 'arrowhead'; readonly name: string }
  // ADR-570 Φ1b — a named «Στυλ Γραμμής» preview: dash pattern (reuses the linetype
  // SSoT) enriched with the style's lineweight + pen color (Revit/Figma-grade swatch).
  | {
      readonly kind: 'line-style';
      readonly pattern: string;
      readonly lineweight: number;
      readonly penColor: string;
    };

export interface RibbonComboboxOption {
  /** Stable value passed through onComboboxChange. */
  value: string;
  /** i18n key OR ready-to-render label (used for dynamic options like font names). */
  labelKey: string;
  /** When true, `labelKey` is already a literal — do NOT pass through t(). */
  isLiteralLabel?: boolean;
  /** Optional preview thumbnail URL (ADR-410 furniture library picker). */
  imageUrl?: string;
  /**
   * ADR-562 Φ8 — optional inline-SVG preview (linetype dash / arrowhead shape),
   * rendered theme-correct via `currentColor`. Preferred over `imageUrl` for
   * vector previews (proper aspect ratio + light/dark). @see RibbonComboboxThumbnail
   */
  thumbnail?: RibbonComboboxThumbnailDescriptor;
}

/**
 * ADR-345 §4.5 — Editable numeric combobox override (Revit type-to-enter).
 * RibbonCombobox auto-renders an EDITABLE field for any all-numeric option list
 * (presets in the dropdown + free typing). This config overrides the inferred
 * behaviour for a specific field. All fields optional → zero breaking change.
 */
export interface RibbonNumericInputConfig {
  /** `true` forces editing even without a numeric preset list; `false` forces a plain Select. */
  editable?: boolean;
  /** Allow a leading minus. Default: inferred (true when any preset is negative). */
  allowNegative?: boolean;
  /** Allow a decimal separator. Default: inferred (true when any preset is non-integer). */
  allowDecimal?: boolean;
  /** Reject committed values below this (typed input reverts). */
  min?: number;
  /** Reject committed values above this (typed input reverts). */
  max?: number;
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
  /**
   * ADR-345 §4.5 — Per-field override for the editable numeric combobox. When
   * omitted, RibbonCombobox infers everything from the option list (numeric
   * presets → editable; negative preset → allow minus; decimal preset → allow
   * dot). Set this only to override (e.g. allow negative rotation/offset whose
   * presets happen to be all-positive). @see ribbon-combobox-numeric.ts
   */
  numericInput?: RibbonNumericInputConfig;
  /**
   * ADR-507 Φ2 — Specialised combobox renderer. When set, RibbonCombobox
   * delegates to a dedicated control instead of the plain Radix Select:
   *   - `'hatch-pattern'` → searchable popover with pattern thumbnails
   *     (HatchPatternPicker). Reuses `options` + the bridge value/onChange.
   *   - `'dxf-color'` → unified DXF color picker (RibbonDxfColorPickerWidget).
   *     Hex in/out via the bridge value/onChange; renders the SSoT
   *     `ColorPickerPopover` (true-color via EnterpriseColorPicker + ACI),
   *     the same rich picker as text/dimension (ADR-344). Used for hatch fill
   *     + gradient color1/2 (ADR-507 Φ2/Φ5).
   * Omitted ⇒ standard Select / editable-numeric behaviour (zero change).
   */
  comboboxVariant?: 'hatch-pattern' | 'dxf-color';
  /**
   * ADR-419 §ribbon-hierarchy (Revit-style cascading menu) — When present,
   * this command is a SUBMENU HEADER (not a leaf tool). The split dropdown
   * renders it as a hover-expandable item that opens `subVariants` to the
   * right. Header commands never fire a tool / never become last-used; only
   * leaf commands (no `subVariants`) dispatch via commandKey / action.
   */
  subVariants?: readonly RibbonCommand[];
}

export interface RibbonButton {
  type: ButtonType;
  size: ButtonSize;
  command: RibbonCommand;
  variants?: RibbonCommand[];
  lastVariantId?: string;
  isActive?: boolean;
  /** Only used when type === 'widget'. Identifies which inline widget to render. */
  widgetId?: string;
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
  /**
   * ADR-358 Phase 7b2b-β Stream F — context-aware panel visibility. When set,
   * the panel is rendered only when
   * `RibbonCommandsApi.getPanelVisibility(visibilityKey)` returns `true`.
   * Owner bridge (e.g. `useRibbonStairBridge`) maps visibility keys to domain
   * predicates (e.g. `variant.kind ∈ {l-shape, u-shape, gamma}`). Mirrors the
   * `badgeKey` pattern from Phase 7b1. Default `undefined` = always visible
   * (zero breaking change for existing tabs).
   */
  visibilityKey?: string;
}

export interface RibbonTab {
  id: string;
  labelKey: string;
  panels: RibbonPanelDef[];
  isContextual?: boolean;
  contextualTrigger?: string;
  /**
   * ADR-358 Phase 7b1 — Validation badge surfacing. When set, the tab
   * button renders a red "!" badge in the top-right corner whenever
   * `RibbonCommandsApi.getBadgeState(badgeKey)` returns `true`. Owner
   * bridge decides what `true` means (e.g. stair bridge maps it to
   * `StairEntity.validation.hasCodeViolations`).
   */
  badgeKey?: string;
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
