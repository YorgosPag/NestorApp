/**
 * ADR-408 Δρόμος B — Contextual ribbon tab για τις συσκευές (πλυντήριο, … — Revit
 * IfcElectricAppliance).
 *
 * Trigger: `mep-appliance-fixture-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-fixture` με `kind` ∈ APPLIANCE_KINDS).
 *
 * SSoT — ΜΗΔΕΝ νέος bridge: η συσκευή ΕΙΝΑΙ `mep-fixture`, οπότε επαναχρησιμοποιεί
 * αυτούσια τα `MEP_FIXTURE_RIBBON_KEYS` + τον `useRibbonMepFixtureBridge`. Thin copy
 * του sanitary tab — διαφέρει μόνο σε labels (panels/tab) + trigger· τα geometry
 * command labels είναι γενικά (Πλάτος/Μήκος/…) και επαναχρησιμοποιούνται.
 *
 * Panels:
 *   Geometry → width + length + rotation + body height + mounting elevation
 *   3D View  → mesh picker (parametric-only static fallback· τα appliance presets
 *              έρχονται DYNAMICALLY από το bridge `fixtureMeshPresetsForKind`)
 *   Actions  → close + delete
 *
 * @see ./contextual-mep-sanitary-fixture-tab.ts — the mirrored sanitary tab
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
} from '../hooks/bridge/mep-fixture-command-keys';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

export const MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER = 'mep-appliance-fixture-selected';

// ─── Combobox options (mm / deg presets) ─────────────────────────────────────

// Footprint width/length (mm) — covers typical appliance plan sizes (washing
// machine ≈ 600×600).
const DIMENSION_MM_OPTIONS = [
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '450', labelKey: '450', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '550', labelKey: '550', isLiteralLabel: true },
  { value: '587', labelKey: '587', isLiteralLabel: true },
  { value: '597', labelKey: '597', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '700', labelKey: '700', isLiteralLabel: true },
] as const;

const ROTATION_DEG_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '45', labelKey: '45', isLiteralLabel: true },
  { value: '90', labelKey: '90', isLiteralLabel: true },
  { value: '135', labelKey: '135', isLiteralLabel: true },
  { value: '180', labelKey: '180', isLiteralLabel: true },
  { value: '225', labelKey: '225', isLiteralLabel: true },
  { value: '270', labelKey: '270', isLiteralLabel: true },
  { value: '315', labelKey: '315', isLiteralLabel: true },
] as const;

// Body height (mm) — representative appliance solid heights.
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '700', labelKey: '700', isLiteralLabel: true },
  { value: '850', labelKey: '850', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
] as const;

// Floor-relative mounting elevation (mm) — 0 = floor-standing (FFL).
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
] as const;

// ADR-411 — 3D representation: parametric box (default) vs a realistic glTF mesh.
// The kind-specific mesh list is supplied DYNAMICALLY per selected fixture by
// `useRibbonMepFixtureBridge.getComboboxState` (Revit-correct). This static list is
// only the kind-blind fallback when no fixture is selected — hence parametric-only.
const THREE_D_VIEW_OPTIONS = [
  {
    value: SELECT_CLEAR_VALUE,
    labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.threeDViewParametric',
    isLiteralLabel: false,
  },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_APPLIANCE_FIXTURE_TAB: RibbonTab = {
  id: 'mep-appliance-fixture-editor',
  labelKey: 'ribbon.tabs.mepApplianceFixtureProperties',
  isContextual: true,
  contextualTrigger: MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-appliance-fixture-geometry',
      labelKey: 'ribbon.panels.mepApplianceFixtureGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.width',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.width',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.width,
                comboboxWidthPx: 80,
                options: DIMENSION_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.length',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.length',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.length,
                comboboxWidthPx: 80,
                options: DIMENSION_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.rotation',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.rotation',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.rotation,
                comboboxWidthPx: 80,
                options: ROTATION_DEG_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.bodyHeight',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.bodyHeight',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.bodyHeight,
                comboboxWidthPx: 80,
                options: BODY_HEIGHT_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.mountingElevation',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.mountingElevation',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.params.mountingElevation,
                comboboxWidthPx: 90,
                options: MOUNTING_ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-appliance-fixture-3d-view',
      labelKey: 'ribbon.panels.mepApplianceFixture3dView',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.threeDView',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.threeDView',
                commandKey: MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId,
                comboboxWidthPx: 150,
                options: THREE_D_VIEW_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'mep-appliance-fixture-actions',
      labelKey: 'ribbon.panels.mepApplianceFixtureActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.close',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.close',
                icon: 'select',
                commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
                action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepApplianceFixture.delete',
                labelKey: 'ribbon.commands.mepSanitaryFixtureEditor.delete',
                icon: 'trash',
                commandKey: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete,
                action: MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
