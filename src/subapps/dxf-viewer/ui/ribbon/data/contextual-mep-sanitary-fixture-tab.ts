/**
 * ADR-408 Φ14 — Contextual ribbon tab για τα είδη υγιεινής (WC/νιπτήρας/ντουζιέρα/
 * μπανιέρα/μπιντές — Revit Plumbing Fixtures).
 *
 * Trigger: `mep-sanitary-fixture-selected` (dispatched από `resolveContextualTrigger`
 * στο `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-fixture` με `kind` ∈ SANITARY_KINDS).
 *
 * SSoT — ΜΗΔΕΝ νέος bridge: το είδος υγιεινής ΕΙΝΑΙ `mep-fixture`, οπότε
 * επαναχρησιμοποιεί αυτούσια τα `MEP_FIXTURE_RIBBON_KEYS` + τον υπάρχοντα
 * `useRibbonMepFixtureBridge` (resolves το selected fixture, dispatch μέσω
 * `UpdateMepFixtureParamsCommand`, undoable + geometry recompute, debounced
 * auto-save). Διαφέρει μόνο σε labels + presets· περιλαμβάνει rotation (τα είδη
 * υγιεινής ΔΕΝ είναι τετράγωνα — ο προσανατολισμός στον τοίχο έχει σημασία).
 *
 * Panels:
 *   Geometry → width + length + rotation + body height + mounting elevation
 *   Actions  → close + delete
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
} from '../hooks/bridge/mep-fixture-command-keys';

export const MEP_SANITARY_FIXTURE_CONTEXTUAL_TRIGGER = 'mep-sanitary-fixture-selected';

// ─── Combobox options (mm / deg presets) ─────────────────────────────────────

// Footprint width/length (mm) — covers typical sanitary plan sizes (WC 380×680,
// basin 600×460, shower 900×900, tub 1700×750, bidet 360×560).
const DIMENSION_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '360', labelKey: '360', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '460', labelKey: '460', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '560', labelKey: '560', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '680', labelKey: '680', isLiteralLabel: true },
  { value: '750', labelKey: '750', isLiteralLabel: true },
  { value: '900', labelKey: '900', isLiteralLabel: true },
  { value: '1200', labelKey: '1200', isLiteralLabel: true },
  { value: '1700', labelKey: '1700', isLiteralLabel: true },
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

// Body height (mm) — representative fixture solid heights.
const BODY_HEIGHT_MM_OPTIONS = [
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '850', labelKey: '850', isLiteralLabel: true },
] as const;

// Floor-relative mounting elevation (mm) — 0 = floor-standing (FFL).
const MOUNTING_ELEVATION_MM_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_MEP_SANITARY_FIXTURE_TAB: RibbonTab = {
  id: 'mep-sanitary-fixture-editor',
  labelKey: 'ribbon.tabs.mepSanitaryFixtureProperties',
  isContextual: true,
  contextualTrigger: MEP_SANITARY_FIXTURE_CONTEXTUAL_TRIGGER,
  panels: [
    {
      id: 'mep-sanitary-fixture-geometry',
      labelKey: 'ribbon.panels.mepSanitaryFixtureGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'mepSanitaryFixture.width',
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
                id: 'mepSanitaryFixture.length',
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
                id: 'mepSanitaryFixture.rotation',
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
                id: 'mepSanitaryFixture.bodyHeight',
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
                id: 'mepSanitaryFixture.mountingElevation',
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
      id: 'mep-sanitary-fixture-actions',
      labelKey: 'ribbon.panels.mepSanitaryFixtureActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'mepSanitaryFixture.close',
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
                id: 'mepSanitaryFixture.delete',
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
