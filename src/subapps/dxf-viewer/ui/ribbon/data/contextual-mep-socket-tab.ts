/**
 * ADR-430 — Contextual ribbon tab για την πρίζα ρεύματος (power socket / ρευματοδότης
 * — Revit "Electrical Fixtures", IfcOutlet).
 *
 * Trigger: `mep-socket-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-fixture` με `kind === 'socket'`).
 *
 * SSoT — ΜΗΔΕΝ νέος bridge: η πρίζα ΕΙΝΑΙ `mep-fixture`, οπότε επαναχρησιμοποιεί
 * αυτούσια τα `MEP_FIXTURE_RIBBON_KEYS` + τον `useRibbonMepFixtureBridge`. Thin copy
 * του appliance tab — διαφέρει μόνο σε labels (panels/tab) + trigger + τα geometry
 * presets (μικρό επιτοίχιο κουτί ~80×80· τα geometry command labels είναι γενικά
 * Πλάτος/Μήκος/… και επαναχρησιμοποιούνται).
 *
 * Revit-true: η πρίζα ρεύματος είναι ξεχωριστή category από την πρίζα δικτύου
 * (Communication Devices) → ξεχωριστό contextual tab το καθένα, παρότι μοιράζονται
 * IfcOutlet βάση + πανομοιότυπη γεωμετρία κουτιού.
 *
 * @see ./contextual-mep-data-outlet-tab.ts — the weak-current (data) counterpart
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
} from '../hooks/bridge/mep-fixture-command-keys';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

export const MEP_SOCKET_CONTEXTUAL_TRIGGER = 'mep-socket-selected';

// ─── Combobox options (mm / deg presets) ─────────────────────────────────────

// Footprint width/length (mm) — covers typical flush wall-box plan sizes (single
// gang ≈ 80×80, double gang up to ~120).
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
// 1100/1200 above-worktop (Revit electrical mounting heights).
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

export const CONTEXTUAL_MEP_SOCKET_TAB: RibbonTab = {
  id: 'mep-socket-editor',
  labelKey: 'ribbon.tabs.mepSocketProperties',
  isContextual: true,
  contextualTrigger: MEP_SOCKET_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-socket-geometry',
      labelKey: 'ribbon.panels.mepSocketGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSocket.width',
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
                id: 'mepSocket.length',
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
                id: 'mepSocket.rotation',
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
                id: 'mepSocket.bodyHeight',
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
                id: 'mepSocket.mountingElevation',
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
      id: 'mep-socket-3d-view',
      labelKey: 'ribbon.panels.mepSocket3dView',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSocket.threeDView',
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
      id: 'mep-socket-actions',
      labelKey: 'ribbon.panels.mepSocketActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepSocket.close',
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
                id: 'mepSocket.delete',
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
