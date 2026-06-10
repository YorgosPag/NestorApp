/**
 * ADR-431 — Contextual ribbon tab για την πρίζα δικτύου (data outlet / RJ45
 * structured-cabling — Revit "Communication Devices", IfcOutlet DATAOUTLET).
 *
 * Trigger: `mep-data-outlet-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-fixture` με `kind === 'data-outlet'`).
 *
 * SSoT — ΜΗΔΕΝ νέος bridge: η πρίζα δικτύου ΕΙΝΑΙ `mep-fixture`, οπότε επαναχρησιμοποιεί
 * αυτούσια τα `MEP_FIXTURE_RIBBON_KEYS` + τον `useRibbonMepFixtureBridge`. Thin copy
 * του socket tab — διαφέρει μόνο σε labels (panels/tab) + trigger· πανομοιότυπη
 * γεωμετρία κουτιού (και τα δύο μικρά επιτοίχια ηλεκτρικά κουτιά ~80×80).
 *
 * Revit-true: η πρίζα δικτύου (ασθενή ρεύματα) είναι ξεχωριστή category από την πρίζα
 * ρεύματος (Electrical Fixtures) → ξεχωριστό contextual tab το καθένα, παρότι
 * μοιράζονται IfcOutlet βάση + πανομοιότυπη γεωμετρία.
 *
 * @see ./contextual-mep-socket-tab.ts — the power (strong-current) counterpart
 * @see docs/centralized-systems/reference/adrs/ADR-431-electrical-weak-auto-design.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
} from '../hooks/bridge/mep-fixture-command-keys';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

export const MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER = 'mep-data-outlet-selected';

// ─── Combobox options (mm / deg presets) ─────────────────────────────────────

// Footprint width/length (mm) — typical flush wall-box plan sizes (single gang
// ≈ 80×80, double gang up to ~120).
const DIMENSION_MM_OPTIONS = [
  { value: '60', labelKey: '60', isLiteralLabel: true },
  { value: '70', labelKey: '70', isLiteralLabel: true },
  { value: '80', labelKey: '80', isLiteralLabel: true },
  { value: '85', labelKey: '85', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '120', labelKey: '120', isLiteralLabel: true },
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

// Body height (mm) — the wall-box depth proud of the wall.
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '30', labelKey: '30', isLiteralLabel: true },
  { value: '40', labelKey: '40', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '60', labelKey: '60', isLiteralLabel: true },
] as const;

// Wall-mount elevation above FFL (mm) — 150 skirting, 300 general outlet,
// 1100/1200 above-worktop (structured-cabling outlet mounting heights).
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '1100', labelKey: '1100', isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
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

export const CONTEXTUAL_MEP_DATA_OUTLET_TAB: RibbonTab = {
  id: 'mep-data-outlet-editor',
  labelKey: 'ribbon.tabs.mepDataOutletProperties',
  isContextual: true,
  contextualTrigger: MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-data-outlet-geometry',
      labelKey: 'ribbon.panels.mepDataOutletGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepDataOutlet.width',
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
                id: 'mepDataOutlet.length',
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
                id: 'mepDataOutlet.rotation',
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
                id: 'mepDataOutlet.bodyHeight',
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
                id: 'mepDataOutlet.mountingElevation',
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
      id: 'mep-data-outlet-3d-view',
      labelKey: 'ribbon.panels.mepDataOutlet3dView',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepDataOutlet.threeDView',
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
      id: 'mep-data-outlet-actions',
      labelKey: 'ribbon.panels.mepDataOutletActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepDataOutlet.close',
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
                id: 'mepDataOutlet.delete',
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
