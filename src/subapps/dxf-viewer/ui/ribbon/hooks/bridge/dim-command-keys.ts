/**
 * ADR-362 Phase E2 — DIM ribbon command-key registry.
 * Mirrors `stair-command-keys.ts` pattern (ADR-358 Phase 7a).
 *
 * ADR-562 Φ3 — the per-part styling keys under `override` are now LIVE (wired
 * through `useRibbonDimBridge` → `entity.overrides` via `UpdateEntityCommand`),
 * no longer E2 stubs. The rest (style chooser / modify / properties) stay routed
 * through the action fallthrough.
 */

export const DIM_RIBBON_KEYS = {
  style: {
    chooser:      'dim.style.chooser',
    applyStyle:   'dim.style.apply',
    editStyle:    'dim.style.edit',
  },
  override: {
    // Dim line (ADR-562 Φ3 — dimclrd/dimlwd/dimltype).
    color:          'dim.override.color',       // dimclrd (existing key, now wired)
    lineWeight:     'dim.override.lineWeight',   // dimlwd
    lineType:       'dim.override.lineType',     // dimltype
    // ADR-362 — per-style linetype DENSITY (dimltscale, Path A). Numeric override,
    // mirror of arrowSize; scales the dashed pattern (dashes/gaps/dots) ×value.
    lineTypeScale:  'dim.override.lineTypeScale', // dimltscale
    // ADR-362 — «Νέος τύπος γραμμής» launcher (Path B). Self-contained widget
    // (opens LinePatternEditorDialog); no bridge handler — key is for the tab only.
    newLineType:    'dim.override.newLineType',
    // Extension lines (dimclre/dimlwe/dimltex1+2 unified).
    extColor:       'dim.override.extColor',     // dimclre
    extWeight:      'dim.override.extWeight',     // dimlwe
    extType:        'dim.override.extType',       // dimltex1 (+dimltex2 mirror)
    extTypeScale:   'dim.override.extTypeScale',  // dimltexscale (ext-line density)
    // Arrowheads (dimblk unified / arrowColor separate channel / dimasz).
    arrowStyle:     'dim.override.arrowStyle',   // dimblk (existing key, now wired)
    arrowColor:     'dim.override.arrowColor',    // arrowColor
    arrowSize:      'dim.override.arrowSize',     // dimasz
    // Text (dimclrt / textFontFamily).
    textColor:      'dim.override.textColor',     // dimclrt
    textFont:       'dim.override.textFont',      // textFontFamily
    resetOverrides: 'dim.override.reset',
  },
  text: {
    height:        'dim.text.height',
    position:      'dim.text.position',
    rotation:      'dim.text.rotation',
    resetPosition: 'dim.text.resetPosition',
    override:      'dim.text.override',
    // ADR-362 Phase K3 — DIMTFILL text-background mask. `tfill` = 3-way mode
    // (none / backgroundColor / customColor), wired as an `enum` combobox;
    // `tfillColor` = DIMTFILLCLR (ACI), wired as a `color` combobox (used when
    // mode === 'customColor'). Both route through `useRibbonDimBridge`.
    tfill:         'dim.text.tfill',
    tfillColor:    'dim.text.tfillColor',
  },
  modify: {
    dimBreak:   'dim.modify.dimBreak',
    dimSpace:   'dim.modify.dimSpace',
    selectRow:  'dim.select.row',
    // ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» toggle (row-handle mode).
    rowHandles: 'dim.rowHandles.toggle',
  },
  // ADR-362 Round 36 — per-part VISIBILITY toggles (show/hide each dimension part
  // independently). Each is an on/off `type:'toggle'` button; the bridge maps
  // «visible» ⇄ the `suppress*` DIMSTYLE overrides on the selected dim. The
  // endpoint marker (arrow/tick) is ONE toggle per side — its shape stays on the
  // «Στυλ Βέλους» dropdown (AutoCAD/Revit model). @see ADR-362 §7.
  visibility: {
    extLine1: 'dim.visibility.extLine1',
    extLine2: 'dim.visibility.extLine2',
    dimLine:  'dim.visibility.dimLine',
    arrow1:   'dim.visibility.arrow1',
    arrow2:   'dim.visibility.arrow2',
  },
  properties: {
    layer:           'dim.properties.layer',
    annotationScale: 'dim.properties.annotationScale',
    openPanel:       'dim.properties.openPanel',
  },
  // 2026-07-04 — «Ενέργειες» panel (mirror of the BIM contextual tabs).
  //   · close  → matched by the central `isContextualTabCloseAction`
  //     (`/\.actions?\.close$/`) → `closeContextualTab` (clearAll + tool→select),
  //     so it dismisses BOTH the edit tab and the composite creation tab.
  //   · delete → routed via `dispatchDxfSpecialAction` → `dim:delete-requested`
  //     → `useDimensionModify` deletes the selected dims through the canonical
  //     `deleteEntitiesById` SSoT (undoable + cascades), mirror of the columns.
  actions: {
    close:  'dim.actions.close',
    delete: 'dim.actions.delete',
  },
} as const;

const ALL_DIM_KEYS: ReadonlySet<string> = new Set(
  (Object.values(DIM_RIBBON_KEYS) as Record<string, string>[]).flatMap(
    (group) => Object.values(group),
  ),
);

export function isDimRibbonKey(key: string): boolean {
  return ALL_DIM_KEYS.has(key);
}

const DIM_VISIBILITY_KEYS: ReadonlySet<string> = new Set(
  Object.values(DIM_RIBBON_KEYS.visibility),
);

/**
 * ADR-362 Round 36 — true only for the per-part visibility toggle keys. The
 * ribbon composer (`useRibbonCommands`) routes `onToggle`/`getToggleState` for
 * these to `useRibbonDimBridge`; the broader `isDimRibbonKey` also matches them
 * (they live under `DIM_RIBBON_KEYS`) but the combobox path ignores toggles.
 */
export function isDimVisibilityKey(key: string): boolean {
  return DIM_VISIBILITY_KEYS.has(key);
}
