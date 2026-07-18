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
import { literalNumberOptions, MEP_FIXTURE_PARAMETRIC_3D_VIEW_OPTIONS } from './ribbon-numeric-options';

export const MEP_APPLIANCE_FIXTURE_CONTEXTUAL_TRIGGER = 'mep-appliance-fixture-selected';

// ─── Combobox options (mm / deg presets) ─────────────────────────────────────

// Footprint width/length (mm) — covers typical appliance plan sizes (washing
// machine ≈ 600×600).
const DIMENSION_MM_OPTIONS = literalNumberOptions([400, 450, 500, 550, 587, 597, 600, 700]);

const ROTATION_DEG_OPTIONS = literalNumberOptions([0, 45, 90, 135, 180, 225, 270, 315]);

// Body height (mm) — representative appliance solid heights.
const BODY_HEIGHT_MM_OPTIONS = literalNumberOptions([600, 700, 850, 900]);

// Floor-relative mounting elevation (mm) — 0 = floor-standing (FFL).
const MOUNTING_ELEVATION_MM_OPTIONS = literalNumberOptions([0, 100, 200]);

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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'angle' },
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
                numericInput: { quantityKind: 'model-length' },
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
                numericInput: { quantityKind: 'model-length' },
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
                options: MEP_FIXTURE_PARAMETRIC_3D_VIEW_OPTIONS,
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
