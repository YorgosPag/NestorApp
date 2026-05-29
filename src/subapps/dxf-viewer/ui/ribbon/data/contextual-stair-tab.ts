/**
 * ADR-358 Phase 7a — Contextual ribbon tab for the Stair editor.
 *
 * Trigger: `stair-selected` (dispatched by `resolveContextualTrigger` in
 * `app/ribbon-contextual-config.ts` when the primary-selected entity has
 * `type === 'stair'`).
 *
 * Panels:
 *   Structure  → structureType (8 enterprise types) + riserType
 *   Geometry   → rise / tread / width / stepCount
 *   Multi-Story → storyCount / storyHeight (writes StairParams.multiStoryConfig)
 *   Actions    → close
 *
 * Live behavior: bridge dispatches `UpdateStairParamsCommand` on each combobox
 * change (`isDragging=false`, commit-on-select). Smart defaults: structureType
 * change auto-updates riserType (Q20) + nosingSide (Q34) in the same command.
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  STAIR_RIBBON_KEYS,
  STAIR_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/stair-command-keys';
import { STAIR_RIBBON_BADGE_KEYS } from '../../../bim/hooks/use-ribbon-stair-bridge';

export const STAIR_CONTEXTUAL_TRIGGER = 'stair-selected';

// ADR-358 Phase 3d — discriminated `StairVariantParams.kind` selector. Labels
// route through i18n (`ribbon.commands.stairEditor.variantKind.<key>`) — no
// literal text per SOS N.11. Order = type-system union order in `types/stair.ts`.
const VARIANT_KIND_OPTIONS = [
  { value: 'straight', labelKey: 'ribbon.commands.stairEditor.variantKind.straight', isLiteralLabel: false },
  { value: 'l-shape', labelKey: 'ribbon.commands.stairEditor.variantKind.lShape', isLiteralLabel: false },
  { value: 'u-shape', labelKey: 'ribbon.commands.stairEditor.variantKind.uShape', isLiteralLabel: false },
  { value: 'gamma', labelKey: 'ribbon.commands.stairEditor.variantKind.gamma', isLiteralLabel: false },
  { value: 'v-shape', labelKey: 'ribbon.commands.stairEditor.variantKind.vShape', isLiteralLabel: false },
  { value: 'spiral', labelKey: 'ribbon.commands.stairEditor.variantKind.spiral', isLiteralLabel: false },
  { value: 'helical', labelKey: 'ribbon.commands.stairEditor.variantKind.helical', isLiteralLabel: false },
  { value: 'elliptical', labelKey: 'ribbon.commands.stairEditor.variantKind.elliptical', isLiteralLabel: false },
  { value: 'winder', labelKey: 'ribbon.commands.stairEditor.variantKind.winder', isLiteralLabel: false },
  { value: 'triangular-fan', labelKey: 'ribbon.commands.stairEditor.variantKind.triangularFan', isLiteralLabel: false },
  { value: 'triangular-outline', labelKey: 'ribbon.commands.stairEditor.variantKind.triangularOutline', isLiteralLabel: false },
  { value: 'sketch', labelKey: 'ribbon.commands.stairEditor.variantKind.sketch', isLiteralLabel: false },
] as const;

// ADR-358 Phase 3f — L-shape corner sub-style options.
const CORNER_STYLE_OPTIONS = [
  { value: 'landing', labelKey: 'ribbon.commands.stairEditor.cornerStyle.landing', isLiteralLabel: false },
  { value: 'winders', labelKey: 'ribbon.commands.stairEditor.cornerStyle.winders', isLiteralLabel: false },
] as const;

const WINDER_METHOD_OPTIONS = [
  { value: 'equal-going', labelKey: 'ribbon.commands.stairEditor.winderMethod.equalGoing', isLiteralLabel: false },
  { value: 'pie', labelKey: 'ribbon.commands.stairEditor.winderMethod.pie', isLiteralLabel: false },
] as const;

const WINDER_COUNT_OPTIONS = [
  { value: '1', labelKey: '1', isLiteralLabel: true },
  { value: '2', labelKey: '2', isLiteralLabel: true },
  { value: '3', labelKey: '3', isLiteralLabel: true },
  { value: '4', labelKey: '4', isLiteralLabel: true },
  { value: '5', labelKey: '5', isLiteralLabel: true },
] as const;

// ADR-358 Phase 7c — structureType + riserType options route through i18n.
// Keys live under `ribbon.commands.stairEditor.structureType.*` /
// `ribbon.commands.stairEditor.riserType.*` in `dxf-viewer-shell.json`
// (el+en). Param `value` literals stay hyphenated (StairStructureType
// union); i18n key suffixes are camelCase for JSON-friendliness.
const STRUCTURE_TYPE_OPTIONS = [
  { value: 'monolithic', labelKey: 'ribbon.commands.stairEditor.structureType.monolithic', isLiteralLabel: false },
  { value: 'stringer-1side', labelKey: 'ribbon.commands.stairEditor.structureType.stringer1side', isLiteralLabel: false },
  { value: 'stringer-2side', labelKey: 'ribbon.commands.stairEditor.structureType.stringer2side', isLiteralLabel: false },
  { value: 'central-stringer', labelKey: 'ribbon.commands.stairEditor.structureType.centralStringer', isLiteralLabel: false },
  { value: 'cantilever', labelKey: 'ribbon.commands.stairEditor.structureType.cantilever', isLiteralLabel: false },
  { value: 'suspended', labelKey: 'ribbon.commands.stairEditor.structureType.suspended', isLiteralLabel: false },
  { value: 'glass-tread', labelKey: 'ribbon.commands.stairEditor.structureType.glassTread', isLiteralLabel: false },
  { value: 'steel-grating', labelKey: 'ribbon.commands.stairEditor.structureType.steelGrating', isLiteralLabel: false },
] as const;

const RISER_TYPE_OPTIONS = [
  { value: 'closed', labelKey: 'ribbon.commands.stairEditor.riserType.closed', isLiteralLabel: false },
  { value: 'open', labelKey: 'ribbon.commands.stairEditor.riserType.open', isLiteralLabel: false },
] as const;

// ADR-358 Phase 3g — NOK stair scope selector (Άρθρο 13 Κτιριοδομικού).
// Drives legal + comfort width minima in `gateStairChecker.checkNOK`.
// Industry pattern: Revit "Stair Usage", ArchiCAD "Stair Function",
// AutoCAD Architecture "Stair Classification".
const NOK_SUB_TYPE_OPTIONS = [
  { value: 'main', labelKey: 'ribbon.commands.stairEditor.nokSubType.main', isLiteralLabel: false },
  { value: 'low-rise', labelKey: 'ribbon.commands.stairEditor.nokSubType.lowRise', isLiteralLabel: false },
  { value: 'internal', labelKey: 'ribbon.commands.stairEditor.nokSubType.internal', isLiteralLabel: false },
  { value: 'auxiliary', labelKey: 'ribbon.commands.stairEditor.nokSubType.auxiliary', isLiteralLabel: false },
] as const;

const RISE_MM_OPTIONS = [
  { value: '140', labelKey: '140', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '160', labelKey: '160', isLiteralLabel: true },
  { value: '170', labelKey: '170', isLiteralLabel: true },
  { value: '175', labelKey: '175', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '185', labelKey: '185', isLiteralLabel: true },
  { value: '190', labelKey: '190', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '210', labelKey: '210', isLiteralLabel: true },
  { value: '220', labelKey: '220', isLiteralLabel: true },
] as const;

const TREAD_MM_OPTIONS = [
  { value: '220', labelKey: '220', isLiteralLabel: true },
  { value: '240', labelKey: '240', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '260', labelKey: '260', isLiteralLabel: true },
  { value: '270', labelKey: '270', isLiteralLabel: true },
  { value: '280', labelKey: '280', isLiteralLabel: true },
  { value: '290', labelKey: '290', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '320', labelKey: '320', isLiteralLabel: true },
  { value: '350', labelKey: '350', isLiteralLabel: true },
] as const;

const WIDTH_MM_OPTIONS = [
  { value: '800', labelKey: '800', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
  { value: '1100', labelKey: '1100', isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1400', labelKey: '1400', isLiteralLabel: true },
  { value: '1600', labelKey: '1600', isLiteralLabel: true },
  { value: '1800', labelKey: '1800', isLiteralLabel: true },
  { value: '2000', labelKey: '2000', isLiteralLabel: true },
] as const;

const STEP_COUNT_OPTIONS = [
  { value: '3', labelKey: '3', isLiteralLabel: true },
  { value: '4', labelKey: '4', isLiteralLabel: true },
  { value: '5', labelKey: '5', isLiteralLabel: true },
  { value: '6', labelKey: '6', isLiteralLabel: true },
  { value: '7', labelKey: '7', isLiteralLabel: true },
  { value: '8', labelKey: '8', isLiteralLabel: true },
  { value: '9', labelKey: '9', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '11', labelKey: '11', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '13', labelKey: '13', isLiteralLabel: true },
  { value: '14', labelKey: '14', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '16', labelKey: '16', isLiteralLabel: true },
  { value: '18', labelKey: '18', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
] as const;

// ADR-395 G1 — RC waist-slab thickness (mm) options feeding the concrete BOQ
// row. Industry-typical residential/commercial RC flight thicknesses; default
// 150 mm (`DEFAULT_WAIST_SLAB_THICKNESS_MM`). Plain mm (not scene-scaled).
const WAIST_THICKNESS_MM_OPTIONS = [
  { value: '120', labelKey: '120', isLiteralLabel: true },
  { value: '140', labelKey: '140', isLiteralLabel: true },
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '160', labelKey: '160', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '220', labelKey: '220', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
] as const;

const STORY_COUNT_OPTIONS = [
  { value: '1', labelKey: '1', isLiteralLabel: true },
  { value: '2', labelKey: '2', isLiteralLabel: true },
  { value: '3', labelKey: '3', isLiteralLabel: true },
  { value: '4', labelKey: '4', isLiteralLabel: true },
  { value: '5', labelKey: '5', isLiteralLabel: true },
  { value: '6', labelKey: '6', isLiteralLabel: true },
  { value: '7', labelKey: '7', isLiteralLabel: true },
  { value: '8', labelKey: '8', isLiteralLabel: true },
  { value: '9', labelKey: '9', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
] as const;

// ADR-358 Phase 7b2b-β Stream F — turn direction options for flight2/3.
const TURN_DIRECTION_OPTIONS = [
  { value: 'left', labelKey: 'ribbon.commands.stairEditor.turnDirectionLeft', isLiteralLabel: false },
  { value: 'right', labelKey: 'ribbon.commands.stairEditor.turnDirectionRight', isLiteralLabel: false },
] as const;

const STORY_HEIGHT_MM_OPTIONS = [
  { value: '2400', labelKey: '2400', isLiteralLabel: true },
  { value: '2500', labelKey: '2500', isLiteralLabel: true },
  { value: '2600', labelKey: '2600', isLiteralLabel: true },
  { value: '2700', labelKey: '2700', isLiteralLabel: true },
  { value: '2800', labelKey: '2800', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3200', labelKey: '3200', isLiteralLabel: true },
  { value: '3500', labelKey: '3500', isLiteralLabel: true },
] as const;

export const CONTEXTUAL_STAIR_TAB: RibbonTab = {
  id: 'stair-editor',
  labelKey: 'ribbon.tabs.stairProperties',
  isContextual: true,
  contextualTrigger: STAIR_CONTEXTUAL_TRIGGER,
  // ADR-358 Phase 7b1 — Red "!" badge when validation.hasCodeViolations === true.
  badgeKey: STAIR_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      // ADR-358 Phase 9 — Floor link panel. Renders read-only floor metadata
      // (number/name/elevation/end/height) + 🔗/⚠️ link badge + Reset button.
      // Widget self-gates: returns null when no floor in scope or no stair
      // selected, so the panel collapses gracefully outside the floor-linked
      // workflow. Mounted first so the floor context anchors the tab.
      id: 'stair-floor',
      labelKey: 'ribbon.panels.stairFloor',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'large',
              widgetId: 'stair-floor-info',
              command: {
                id: 'stair.floorInfo',
                labelKey: 'ribbon.commands.stairEditor.floor.section.title',
                commandKey: 'stair.floorInfo',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-358 Phase 3d hotfix-2 — Variant kind selector inlined as FIRST
      // combobox of the Δομή panel (instead of its own column). Eliminates
      // the extra panel header + vertical separator that pushed total
      // ribbon width past viewport on 80% browser zoom + standard layouts.
      // Industry convergence: Revit "Type Selector" + Family Type Properties
      // share the same Properties palette section; ArchiCAD groups Stair
      // Type + Structure in one Info Box row; AutoCAD Architecture combines
      // Shape + Style in one Properties palette group.
      id: 'stair-structure',
      labelKey: 'ribbon.panels.stairStructure',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.variantKind',
                labelKey: 'ribbon.commands.stairEditor.variantKind.section.title',
                commandKey: STAIR_RIBBON_KEYS.stringParams.variantKind,
                comboboxWidthPx: 130,
                options: VARIANT_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.structureType',
                labelKey: 'ribbon.commands.stairEditor.structureType.section.title',
                commandKey: STAIR_RIBBON_KEYS.stringParams.structureType,
                comboboxWidthPx: 150,
                options: STRUCTURE_TYPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.riserType',
                labelKey: 'ribbon.commands.stairEditor.riserType.section.title',
                commandKey: STAIR_RIBBON_KEYS.stringParams.riserType,
                comboboxWidthPx: 90,
                options: RISER_TYPE_OPTIONS,
              },
            },
            {
              // ADR-358 Phase 3g — NOK scope selector (Q3 user choice Β:
              // inside Δομή/Σχήμα panel, 4 categories per Άρθρο 13 παρ. 2-4).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.nokSubType',
                labelKey: 'ribbon.commands.stairEditor.nokSubType.section.title',
                commandKey: STAIR_RIBBON_KEYS.stringParams.nokSubType,
                comboboxWidthPx: 180,
                options: NOK_SUB_TYPE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-358 Phase 3f — Γωνία (Corner) panel for L-shape sub-options.
      // Visible only when variant.kind === 'l-shape'. Industry convergence:
      // Revit "Run Type" sub-selector / ArchiCAD "Winder Method" / AutoCAD
      // Architecture "Winders" toggle — all surface the corner choice as
      // a contextual L-shape sub-option, not a separate kind.
      id: 'stair-corner',
      labelKey: 'ribbon.panels.stairCorner',
      visibilityKey: STAIR_RIBBON_VISIBILITY_KEYS.lShapeCorner,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.cornerStyle',
                labelKey: 'ribbon.commands.stairEditor.cornerStyle.section.title',
                commandKey: STAIR_RIBBON_KEYS.stringParams.cornerStyle,
                comboboxWidthPx: 130,
                options: CORNER_STYLE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-358 Phase 3f — Winders editor (visible only when l-shape +
      // cornerStyle='winders'). Separate panel because RibbonPanelDef
      // visibilityKey is panel-scoped, not button-scoped.
      id: 'stair-corner-winders',
      labelKey: 'ribbon.panels.stairCornerWinders',
      visibilityKey: STAIR_RIBBON_VISIBILITY_KEYS.lShapeWindersParams,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.winderCount',
                labelKey: 'ribbon.commands.stairEditor.winderCount.section.title',
                commandKey: STAIR_RIBBON_KEYS.params.winderCount,
                comboboxWidthPx: 70,
                options: WINDER_COUNT_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.winderMethod',
                labelKey: 'ribbon.commands.stairEditor.winderMethod.section.title',
                commandKey: STAIR_RIBBON_KEYS.stringParams.winderMethod,
                comboboxWidthPx: 140,
                options: WINDER_METHOD_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'stair-geometry',
      labelKey: 'ribbon.panels.stairGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.rise',
                labelKey: 'ribbon.commands.stairEditor.rise',
                commandKey: STAIR_RIBBON_KEYS.params.rise,
                comboboxWidthPx: 70,
                options: RISE_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.tread',
                labelKey: 'ribbon.commands.stairEditor.tread',
                commandKey: STAIR_RIBBON_KEYS.params.tread,
                comboboxWidthPx: 70,
                options: TREAD_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.width',
                labelKey: 'ribbon.commands.stairEditor.width',
                commandKey: STAIR_RIBBON_KEYS.params.width,
                comboboxWidthPx: 80,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.stepCount',
                labelKey: 'ribbon.commands.stairEditor.stepCount',
                commandKey: STAIR_RIBBON_KEYS.params.stepCount,
                comboboxWidthPx: 70,
                options: STEP_COUNT_OPTIONS,
              },
            },
            {
              // ADR-395 G1 — RC waist-slab thickness (mm). Feeds the concrete
              // BOQ row (όγκος σκυροδέματος); irrelevant for steel/glass
              // structures (concrete = 0) but kept always-visible for
              // simplicity. Default 150 mm.
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.waistThickness',
                labelKey: 'ribbon.commands.stairEditor.waistThickness',
                commandKey: STAIR_RIBBON_KEYS.params.waistThickness,
                comboboxWidthPx: 70,
                options: WAIST_THICKNESS_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-358 Phase Q17 9B-4 — read-only Dimensions widget. Surfaces
      // `totalRun` (μήκος, planar length) + `totalRise` (συνολικό ύψος) in
      // meters so the engineer can verify the derived stair envelope inline
      // alongside the editable rise/tread/width/stepCount inputs. Industry:
      // Revit "Dimensions" Properties section + ArchiCAD Stair settings.
      id: 'stair-dimensions',
      labelKey: 'ribbon.panels.stairDimensions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'widget',
              size: 'large',
              widgetId: 'stair-dimensions',
              command: {
                id: 'stair.dimensions',
                labelKey: 'ribbon.commands.stairEditor.dimensions.section.title',
                commandKey: 'stair.dimensions',
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-358 Phase 9B-3 — split out the storyCount editor from the
      // storyHeight editor so the latter can be gated by `visibilityKey`
      // (hidden when linked to a floor — the floor governs the height).
      id: 'stair-multistory',
      labelKey: 'ribbon.panels.stairMultiStory',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.storyCount',
                labelKey: 'ribbon.commands.stairEditor.storyCount',
                commandKey: STAIR_RIBBON_KEYS.params.storyCount,
                comboboxWidthPx: 70,
                options: STORY_COUNT_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-358 Phase 9B-3 — storyHeight editor (free mode only). When
      // linked to a floor the height is read-only via the floor info widget
      // in the "Στάθμη" panel, so showing an editable combobox here would
      // duplicate the surface and let the user drift the two apart.
      id: 'stair-multistory-height',
      labelKey: 'ribbon.panels.stairMultiStoryHeight',
      visibilityKey: STAIR_RIBBON_VISIBILITY_KEYS.multiStoryHeightEditor,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.storyHeight',
                labelKey: 'ribbon.commands.stairEditor.storyHeight',
                commandKey: STAIR_RIBBON_KEYS.params.storyHeight,
                comboboxWidthPx: 80,
                options: STORY_HEIGHT_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-358 Phase 7b2b-β Stream F — Multi-Flight panel. Visible only for
      // variant.kind ∈ {l-shape, u-shape, gamma} via `visibilityKey` framework.
      // flight3 combobox is shown but no-ops for l-shape/u-shape (gamma-only).
      id: 'stair-multi-flight',
      labelKey: 'ribbon.panels.stairMultiFlight',
      visibilityKey: STAIR_RIBBON_VISIBILITY_KEYS.multiFlight,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.flight2TurnDirection',
                labelKey: 'ribbon.commands.stairEditor.flight2TurnDirection',
                commandKey: STAIR_RIBBON_KEYS.stringParams.flight2TurnDirection,
                comboboxWidthPx: 110,
                options: TURN_DIRECTION_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'stair.flight3TurnDirection',
                labelKey: 'ribbon.commands.stairEditor.flight3TurnDirection',
                commandKey: STAIR_RIBBON_KEYS.stringParams.flight3TurnDirection,
                comboboxWidthPx: 110,
                options: TURN_DIRECTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'stair-actions',
      labelKey: 'ribbon.panels.stairActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'stair.close',
                labelKey: 'ribbon.commands.stairEditor.close',
                icon: 'select',
                commandKey: STAIR_RIBBON_KEYS.actions.close,
                action: STAIR_RIBBON_KEYS.actions.close,
              },
            },
          ],
        },
      ],
    },
  ],
};
