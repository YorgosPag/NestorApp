/**
 * ADR-407 Φ9 — Contextual ribbon tab for the Railing editor.
 *
 * Trigger: `railing-selected` (dispatched by `resolveContextualTrigger` in
 * `app/resolve-contextual-trigger.ts` when the primary-selected entity has
 * `type === 'railing'`).
 *
 * Mirror of `contextual-stair-tab.ts` (ADR-358 Phase 7a): a flat set of
 * combobox panels reading/writing `RailingParams` through the ONE shared
 * SSoT (`bim/railings/railing-param-{keys,access}.ts`) — no per-file key
 * duplication, no per-file read/patch logic.
 *
 * Panels:
 *   Γεωμετρία  → predefinedType / totalHeight / baseElevation
 *   Κάγκελα    → balusterShape / balusterWidth / balusterSpacing / balusterJustification
 *   Ορθοστάτες → postsEnabled / postsWidth / postsAtStart / postsAtCorners / postsAtEnd
 *   Κουπαστές  → topRailEnabled / topRailWidth / topRailHeight / handrailEnabled / handrailHeight
 *   Πλήρωση    → infillKind
 *
 * Live behavior: `useRibbonRailingBridge` dispatches `UpdateRailingParamsCommand`
 * on each combobox change (commit-on-select, one undo step per edit). No badge,
 * no panel visibility — every field is always relevant (unlike the stair's
 * shape-dependent sub-panels).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  RAILING_RIBBON_KEYS,
  RAILING_LABEL_KEYS,
  RAILING_PREDEFINED_TYPE_OPTIONS,
  RAILING_SHAPE_OPTIONS,
  RAILING_JUSTIFICATION_OPTIONS,
  RAILING_ON_OFF_OPTIONS,
  RAILING_INFILL_OPTIONS,
  RAILING_TOTAL_HEIGHT_OPTIONS,
  RAILING_BASE_ELEVATION_OPTIONS,
  RAILING_BALUSTER_WIDTH_OPTIONS,
  RAILING_BALUSTER_SPACING_OPTIONS,
  RAILING_POST_WIDTH_OPTIONS,
  RAILING_TOP_RAIL_WIDTH_OPTIONS,
  RAILING_TOP_RAIL_HEIGHT_OPTIONS,
  RAILING_HANDRAIL_HEIGHT_OPTIONS,
} from '../../bim/railings/railing-param-keys';

export const RAILING_CONTEXTUAL_TRIGGER = 'railing-selected';

export const CONTEXTUAL_RAILING_TAB: RibbonTab = {
  id: 'railing-editor',
  labelKey: 'ribbon.tabs.railingProperties',
  isContextual: true,
  contextualTrigger: RAILING_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'railing-geometry',
      labelKey: 'ribbon.panels.railingGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.predefinedType',
                labelKey: RAILING_LABEL_KEYS.predefinedType,
                commandKey: RAILING_RIBBON_KEYS.stringParams.predefinedType,
                comboboxWidthPx: 130,
                options: RAILING_PREDEFINED_TYPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.totalHeight',
                labelKey: RAILING_LABEL_KEYS.totalHeight,
                commandKey: RAILING_RIBBON_KEYS.params.totalHeight,
                comboboxWidthPx: 90,
                options: RAILING_TOTAL_HEIGHT_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.baseElevation',
                labelKey: RAILING_LABEL_KEYS.baseElevation,
                commandKey: RAILING_RIBBON_KEYS.params.baseElevation,
                comboboxWidthPx: 90,
                options: RAILING_BASE_ELEVATION_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'railing-baluster',
      labelKey: 'ribbon.panels.railingBaluster',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.balusterShape',
                labelKey: RAILING_LABEL_KEYS.balusterShape,
                commandKey: RAILING_RIBBON_KEYS.stringParams.balusterShape,
                comboboxWidthPx: 110,
                options: RAILING_SHAPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.balusterWidth',
                labelKey: RAILING_LABEL_KEYS.balusterWidth,
                commandKey: RAILING_RIBBON_KEYS.params.balusterWidth,
                comboboxWidthPx: 80,
                options: RAILING_BALUSTER_WIDTH_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.balusterSpacing',
                labelKey: RAILING_LABEL_KEYS.balusterSpacing,
                commandKey: RAILING_RIBBON_KEYS.params.balusterSpacing,
                comboboxWidthPx: 80,
                options: RAILING_BALUSTER_SPACING_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.balusterJustification',
                labelKey: RAILING_LABEL_KEYS.balusterJustification,
                commandKey: RAILING_RIBBON_KEYS.stringParams.balusterJustification,
                comboboxWidthPx: 110,
                options: RAILING_JUSTIFICATION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'railing-posts',
      labelKey: 'ribbon.panels.railingPosts',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.postsEnabled',
                labelKey: RAILING_LABEL_KEYS.postsEnabled,
                commandKey: RAILING_RIBBON_KEYS.stringParams.postsEnabled,
                comboboxWidthPx: 90,
                options: RAILING_ON_OFF_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.postsWidth',
                labelKey: RAILING_LABEL_KEYS.postsWidth,
                commandKey: RAILING_RIBBON_KEYS.params.postsWidth,
                comboboxWidthPx: 80,
                options: RAILING_POST_WIDTH_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.postsAtStart',
                labelKey: RAILING_LABEL_KEYS.postsAtStart,
                commandKey: RAILING_RIBBON_KEYS.stringParams.postsAtStart,
                comboboxWidthPx: 90,
                options: RAILING_ON_OFF_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.postsAtCorners',
                labelKey: RAILING_LABEL_KEYS.postsAtCorners,
                commandKey: RAILING_RIBBON_KEYS.stringParams.postsAtCorners,
                comboboxWidthPx: 90,
                options: RAILING_ON_OFF_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.postsAtEnd',
                labelKey: RAILING_LABEL_KEYS.postsAtEnd,
                commandKey: RAILING_RIBBON_KEYS.stringParams.postsAtEnd,
                comboboxWidthPx: 90,
                options: RAILING_ON_OFF_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'railing-rails',
      labelKey: 'ribbon.panels.railingRails',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.topRailEnabled',
                labelKey: RAILING_LABEL_KEYS.topRailEnabled,
                commandKey: RAILING_RIBBON_KEYS.stringParams.topRailEnabled,
                comboboxWidthPx: 90,
                options: RAILING_ON_OFF_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.topRailWidth',
                labelKey: RAILING_LABEL_KEYS.topRailWidth,
                commandKey: RAILING_RIBBON_KEYS.params.topRailWidth,
                comboboxWidthPx: 80,
                options: RAILING_TOP_RAIL_WIDTH_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.topRailHeight',
                labelKey: RAILING_LABEL_KEYS.topRailHeight,
                commandKey: RAILING_RIBBON_KEYS.params.topRailHeight,
                comboboxWidthPx: 90,
                options: RAILING_TOP_RAIL_HEIGHT_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.handrailEnabled',
                labelKey: RAILING_LABEL_KEYS.handrailEnabled,
                commandKey: RAILING_RIBBON_KEYS.stringParams.handrailEnabled,
                comboboxWidthPx: 90,
                options: RAILING_ON_OFF_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.handrailHeight',
                labelKey: RAILING_LABEL_KEYS.handrailHeight,
                commandKey: RAILING_RIBBON_KEYS.params.handrailHeight,
                comboboxWidthPx: 90,
                options: RAILING_HANDRAIL_HEIGHT_OPTIONS,
                numericInput: { quantityKind: 'model-length' },
              },
            },
          ],
        },
      ],
    },
    {
      id: 'railing-infill',
      labelKey: 'ribbon.panels.railingInfill',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'railing.infillKind',
                labelKey: RAILING_LABEL_KEYS.infillKind,
                commandKey: RAILING_RIBBON_KEYS.stringParams.infillKind,
                comboboxWidthPx: 110,
                options: RAILING_INFILL_OPTIONS,
              },
            },
          ],
        },
      ],
    },
  ],
};
