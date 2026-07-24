/**
 * ADR-407 Φ9 — Railing Properties-palette descriptors (SSoT data).
 *
 * The section/field layout rendered by `RailingAdvancedPanel` via the generic
 * `BimPropertyRow`. Pure data — the `commandKey`s, options and labels all come
 * from the shared `railing-param-keys` SSoT, so the ribbon tab and this panel
 * stay byte-identical in meaning (a field edited here reads/writes the exact
 * same param as its ribbon combobox twin).
 *
 * @see ./railing-param-keys.ts
 * @see ../../ui/bim-properties/BimPropertyRow.tsx
 */

import type { BimPropertyGroup } from '../../ui/bim-properties/bim-property-types';
import {
  RAILING_STRING_KEYS as S,
  RAILING_NUMBER_KEYS as N,
  RAILING_LABEL_KEYS as L,
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
} from './railing-param-keys';

/** The Properties-palette sections for a selected railing. */
export const RAILING_PROPERTY_GROUPS: readonly BimPropertyGroup[] = [
  {
    id: 'railing-geometry',
    titleKey: 'railingAdvancedPanel.sections.geometry.title',
    fields: [
      { commandKey: S.predefinedType, labelKey: L.predefinedType, options: RAILING_PREDEFINED_TYPE_OPTIONS },
      { commandKey: N.totalHeight, labelKey: L.totalHeight, options: RAILING_TOTAL_HEIGHT_OPTIONS },
      { commandKey: N.baseElevation, labelKey: L.baseElevation, options: RAILING_BASE_ELEVATION_OPTIONS },
    ],
  },
  {
    id: 'railing-baluster',
    titleKey: 'railingAdvancedPanel.sections.baluster.title',
    fields: [
      { commandKey: S.balusterShape, labelKey: L.balusterShape, options: RAILING_SHAPE_OPTIONS },
      { commandKey: N.balusterWidth, labelKey: L.balusterWidth, options: RAILING_BALUSTER_WIDTH_OPTIONS },
      { commandKey: N.balusterSpacing, labelKey: L.balusterSpacing, options: RAILING_BALUSTER_SPACING_OPTIONS },
      { commandKey: S.balusterJustification, labelKey: L.balusterJustification, options: RAILING_JUSTIFICATION_OPTIONS },
    ],
  },
  {
    id: 'railing-posts',
    titleKey: 'railingAdvancedPanel.sections.posts.title',
    fields: [
      { commandKey: S.postsEnabled, labelKey: L.postsEnabled, options: RAILING_ON_OFF_OPTIONS },
      { commandKey: N.postsWidth, labelKey: L.postsWidth, options: RAILING_POST_WIDTH_OPTIONS },
      { commandKey: S.postsAtStart, labelKey: L.postsAtStart, options: RAILING_ON_OFF_OPTIONS },
      { commandKey: S.postsAtCorners, labelKey: L.postsAtCorners, options: RAILING_ON_OFF_OPTIONS },
      { commandKey: S.postsAtEnd, labelKey: L.postsAtEnd, options: RAILING_ON_OFF_OPTIONS },
    ],
  },
  {
    id: 'railing-rails',
    titleKey: 'railingAdvancedPanel.sections.rails.title',
    fields: [
      { commandKey: S.topRailEnabled, labelKey: L.topRailEnabled, options: RAILING_ON_OFF_OPTIONS },
      { commandKey: N.topRailWidth, labelKey: L.topRailWidth, options: RAILING_TOP_RAIL_WIDTH_OPTIONS },
      { commandKey: N.topRailHeight, labelKey: L.topRailHeight, options: RAILING_TOP_RAIL_HEIGHT_OPTIONS },
      { commandKey: S.handrailEnabled, labelKey: L.handrailEnabled, options: RAILING_ON_OFF_OPTIONS },
      { commandKey: N.handrailHeight, labelKey: L.handrailHeight, options: RAILING_HANDRAIL_HEIGHT_OPTIONS },
    ],
  },
  {
    id: 'railing-infill',
    titleKey: 'railingAdvancedPanel.sections.infill.title',
    fields: [
      { commandKey: S.infillKind, labelKey: L.infillKind, options: RAILING_INFILL_OPTIONS },
    ],
  },
];
