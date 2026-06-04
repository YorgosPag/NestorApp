/**
 * ADR-408 Φ8 — Contextual ribbon tab για το MEP segment (σωλήνας / αεραγωγός).
 *
 * ΕΝΑ tab για ΚΑΙ τα δύο domains (duct + pipe). Trigger: `mep-segment-selected`
 * (dispatched από `resolveContextualTrigger` όταν το primary-selected entity έχει
 * `type === 'mep-segment'`). Mirror του «Ιδιότητες Φωτιστικού» (ADR-406).
 *
 * Panels:
 *   Διατομή    → section-kind selector (rectangular / round) — self-hides για
 *                pipe (πάντα round, καμία επιλογή).
 *   Διαστάσεις → width + height (visible iff rectangular) | diameter (iff round)
 *   Γεωμετρία  → centreline elevation (Revit "Middle Elevation")
 *   Actions    → close + delete
 *
 * Live behavior: ο bridge (`useRibbonMepSegmentBridge`) dispatch-άρει updates μέσω
 * `UpdateMepSegmentParamsCommand` (undoable + geometry recompute atomically). Το
 * `domain` δεν είναι editable (αλλάζει discipline/IFC/BOQ) — μόνο gate-άρει το
 * section-kind selector.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_SEGMENT_RIBBON_KEYS,
  MEP_SEGMENT_RIBBON_KEYS_ACTIONS,
  MEP_SEGMENT_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/mep-segment-command-keys';

export const MEP_SEGMENT_CONTEXTUAL_TRIGGER = 'mep-segment-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const MEP_SEGMENT_SECTION_OPTIONS = [
  { value: 'rectangular', labelKey: 'ribbon.commands.mepSegmentEditor.sectionKind.rectangular', isLiteralLabel: false },
  { value: 'round',       labelKey: 'ribbon.commands.mepSegmentEditor.sectionKind.round',       isLiteralLabel: false },
] as const;

// Rectangular duct width (mm).
const WIDTH_MM_OPTIONS = [
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '800', labelKey: '800', isLiteralLabel: true },
] as const;

// Rectangular duct height (mm).
const HEIGHT_MM_OPTIONS = [
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
] as const;

// Round duct / pipe outer diameter (mm) — DN + round-duct presets.
const DIAMETER_MM_OPTIONS = [
  { value: '32',  labelKey: '32',  isLiteralLabel: true },
  { value: '40',  labelKey: '40',  isLiteralLabel: true },
  { value: '50',  labelKey: '50',  isLiteralLabel: true },
  { value: '63',  labelKey: '63',  isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '160', labelKey: '160', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
] as const;

// Centreline elevation (mm) — plenum above a typical ceiling, or below-floor pipe.
const CENTERLINE_ELEVATION_MM_OPTIONS = [
  { value: '-300', labelKey: '-300', isLiteralLabel: true },
  { value: '0',    labelKey: '0',    isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
  { value: '2800', labelKey: '2800', isLiteralLabel: true },
  { value: '3200', labelKey: '3200', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_SEGMENT_TAB: RibbonTab = {
  id: 'mep-segment-editor',
  labelKey: 'ribbon.tabs.mepSegmentProperties',
  isContextual: true,
  contextualTrigger: MEP_SEGMENT_CONTEXTUAL_TRIGGER,
  panels: [
    {
      // Visible iff domain === 'duct' (a pipe is always round — no choice).
      id: 'mep-segment-section',
      labelKey: 'ribbon.panels.mepSegmentSection',
      visibilityKey: MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.domainAllowsSectionChoice,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSegment.sectionKind',
                labelKey: 'ribbon.commands.mepSegmentEditor.sectionKind.section.title',
                commandKey: MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind,
                comboboxWidthPx: 130,
                options: MEP_SEGMENT_SECTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // Width + height — visible iff effective section is rectangular.
      id: 'mep-segment-rect-dims',
      labelKey: 'ribbon.panels.mepSegmentDimensions',
      visibilityKey: MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.rectangularSection,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSegment.width',
                labelKey: 'ribbon.commands.mepSegmentEditor.width',
                commandKey: MEP_SEGMENT_RIBBON_KEYS.params.width,
                comboboxWidthPx: 90,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSegment.height',
                labelKey: 'ribbon.commands.mepSegmentEditor.height',
                commandKey: MEP_SEGMENT_RIBBON_KEYS.params.height,
                comboboxWidthPx: 90,
                options: HEIGHT_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // Diameter — visible iff effective section is round.
      id: 'mep-segment-round-dims',
      labelKey: 'ribbon.panels.mepSegmentDimensions',
      visibilityKey: MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.roundSection,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSegment.diameter',
                labelKey: 'ribbon.commands.mepSegmentEditor.diameter',
                commandKey: MEP_SEGMENT_RIBBON_KEYS.params.diameter,
                comboboxWidthPx: 90,
                options: DIAMETER_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-segment-geometry',
      labelKey: 'ribbon.panels.mepSegmentGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSegment.centerlineElevation',
                labelKey: 'ribbon.commands.mepSegmentEditor.centerlineElevation',
                commandKey: MEP_SEGMENT_RIBBON_KEYS.params.centerlineElevation,
                comboboxWidthPx: 90,
                options: CENTERLINE_ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-segment-actions',
      labelKey: 'ribbon.panels.mepSegmentActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepSegment.close',
                labelKey: 'ribbon.commands.mepSegmentEditor.close',
                icon: 'select',
                commandKey: MEP_SEGMENT_RIBBON_KEYS_ACTIONS.close,
                action: MEP_SEGMENT_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepSegment.delete',
                labelKey: 'ribbon.commands.mepSegmentEditor.delete',
                icon: 'trash',
                commandKey: MEP_SEGMENT_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_SEGMENT_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
