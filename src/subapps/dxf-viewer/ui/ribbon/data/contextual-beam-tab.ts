/**
 * ADR-363 Phase 5 — Contextual ribbon tab για beam editor.
 *
 * Trigger: `beam-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν primary-selected entity έχει
 * `type === 'beam'`, OR activeTool === 'beam').
 *
 * Panels (Phase 5 — minimal):
 *   Kind     → kind combobox (3 τύποι) + supportType (3 options)
 *   Geometry → width + depth + elevation (mm)
 *   Actions  → close + delete
 *
 * Live behavior: bridge (`useRibbonBeamBridge`) dispatches updates σε κάθε
 * combobox change. Auto-save 500ms debounce via `useBeamPersistence`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type { RibbonTab, RibbonComboboxOption } from '../types/ribbon-types';
import {
  BEAM_RIBBON_KEYS,
  BEAM_RIBBON_KEYS_ACTIONS,
  BEAM_RIBBON_BADGE_KEYS,
  BEAM_RIBBON_VISIBILITY_KEYS,
} from '../hooks/bridge/beam-command-keys';
import { ENVELOPE_FUNCTION_OPTIONS } from '../hooks/bridge/envelope-function-param';
import { PSET_RIBBON_ACTION } from '../hooks/bridge/pset-action-keys';
import {
  CATALOG_CUSTOM_SENTINEL,
  ISHAPE_CATALOG,
  formatIShapePresetLabel,
} from '../../../bim/columns/section-catalog';

export const BEAM_CONTEXTUAL_TRIGGER = 'beam-selected';

// ─── Combobox options ────────────────────────────────────────────────────────

const BEAM_KIND_OPTIONS = [
  { value: 'straight',   labelKey: 'ribbon.commands.beamEditor.kind.straight',   isLiteralLabel: false },
  { value: 'curved',     labelKey: 'ribbon.commands.beamEditor.kind.curved',     isLiteralLabel: false },
  { value: 'cantilever', labelKey: 'ribbon.commands.beamEditor.kind.cantilever', isLiteralLabel: false },
] as const;

const BEAM_SUPPORT_TYPE_OPTIONS = [
  { value: 'simple',     labelKey: 'ribbon.commands.beamEditor.supportType.simple',     isLiteralLabel: false },
  { value: 'fixed',      labelKey: 'ribbon.commands.beamEditor.supportType.fixed',      isLiteralLabel: false },
  { value: 'cantilever', labelKey: 'ribbon.commands.beamEditor.supportType.cantilever', isLiteralLabel: false },
] as const;

const WIDTH_MM_OPTIONS = [
  { value: '150', labelKey: '150', isLiteralLabel: true },
  { value: '200', labelKey: '200', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
] as const;

const DEPTH_MM_OPTIONS = [
  { value: '300', labelKey: '300', isLiteralLabel: true },
  { value: '400', labelKey: '400', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '600', labelKey: '600', isLiteralLabel: true },
  { value: '800', labelKey: '800', isLiteralLabel: true },
] as const;

// ADR-363 Phase 5.5c — material picker (ENABLED). 3 options matching
// `BeamMaterialKey` union από `beam-hatch-patterns.ts` (rc/steel/glulam).
// Bridge wiring routes patch through `UpdateBeamParamsCommand` (mirror του
// column-material path Phase 4.5d) ⇒ undoable, atomic recompute, isDragging=false.
const BEAM_MATERIAL_OPTIONS = [
  { value: 'rc',     labelKey: 'ribbon.commands.beamEditor.material.rc',     isLiteralLabel: false },
  { value: 'steel',  labelKey: 'ribbon.commands.beamEditor.material.steel',  isLiteralLabel: false },
  { value: 'glulam', labelKey: 'ribbon.commands.beamEditor.material.glulam', isLiteralLabel: false },
] as const;

// ADR-363 Phase 5.5i+ — steel section type (I / H). Hint για το 2D glyph όταν
// δεν υπάρχουν catalog ishape params (manual I-shape). Στο ishape-params panel.
const BEAM_SECTION_TYPE_OPTIONS = [
  { value: 'I', labelKey: 'ribbon.commands.beamEditor.sectionType.I', isLiteralLabel: false },
  { value: 'H', labelKey: 'ribbon.commands.beamEditor.sectionType.H', isLiteralLabel: false },
] as const;

// ADR-363 Φ2 — σχήμα διατομής (ορθογώνιο RC vs μεταλλικό Ι). Πάντα ορατό· η
// επιλογή 'I-shape' εμφανίζει τα catalog + flange/web panels (bridge visibility).
const BEAM_SECTION_KIND_OPTIONS = [
  { value: 'rectangular', labelKey: 'ribbon.commands.beamEditor.sectionKind.rectangular', isLiteralLabel: false },
  { value: 'I-shape',     labelKey: 'ribbon.commands.beamEditor.sectionKind.iShape',      isLiteralLabel: false },
] as const;

// ADR-363 Φ2 — I-shape flange/web thickness presets (IPE/HEA typical range,
// ίδιες τιμές με την κολώνα). Manual fine-tune· catalog τις γράφει αυτόματα.
const I_FLANGE_THICKNESS_OPTIONS = [
  { value: '8',  labelKey: '8',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
  { value: '30', labelKey: '30', isLiteralLabel: true },
] as const;

const I_WEB_THICKNESS_OPTIONS = [
  { value: '6',  labelKey: '6',  isLiteralLabel: true },
  { value: '8',  labelKey: '8',  isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '15', labelKey: '15', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
] as const;

// ADR-363 Φ2 — custom sentinel (Revit-style: «user deviated from standard»).
// Translatable label (έχει κείμενο). FULL SSOT: τα options παράγονται από το
// `ISHAPE_CATALOG` — προσθήκη preset εκεί εμφανίζεται εδώ αυτόματα.
const CATALOG_CUSTOM_OPTION: RibbonComboboxOption = {
  value: CATALOG_CUSTOM_SENTINEL,
  labelKey: 'ribbon.commands.beamEditor.catalogProfile.custom',
  isLiteralLabel: false,
};

// EN 10365 IPE/HEA/HEB/HEM — literal labels derived από τα δεδομένα (code+dims,
// μη μεταφράσιμα). ΙΔΙΟΣ κατάλογος με την κολώνα (κοινό SSoT).
const ISHAPE_CATALOG_OPTIONS: readonly RibbonComboboxOption[] = [
  CATALOG_CUSTOM_OPTION,
  ...ISHAPE_CATALOG.map((p) => ({ value: p.id, labelKey: formatIShapePresetLabel(p), isLiteralLabel: true })),
];

const ELEVATION_MM_OPTIONS = [
  { value: '2400', labelKey: '2400', isLiteralLabel: true },
  { value: '2700', labelKey: '2700', isLiteralLabel: true },
  { value: '3000', labelKey: '3000', isLiteralLabel: true },
  { value: '3300', labelKey: '3300', isLiteralLabel: true },
  { value: '3600', labelKey: '3600', isLiteralLabel: true },
  { value: '4000', labelKey: '4000', isLiteralLabel: true },
] as const;

// ─── Tab definition ──────────────────────────────────────────────────────────

export const CONTEXTUAL_BEAM_TAB: RibbonTab = {
  id: 'beam-editor',
  labelKey: 'ribbon.tabs.beamProperties',
  isContextual: true,
  contextualTrigger: BEAM_CONTEXTUAL_TRIGGER,
  badgeKey: BEAM_RIBBON_BADGE_KEYS.violations,
  panels: [
    {
      id: 'beam-kind',
      labelKey: 'ribbon.panels.beamKind',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.kind',
                labelKey: 'ribbon.commands.beamEditor.kind.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.kind,
                comboboxWidthPx: 140,
                options: BEAM_KIND_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.supportType',
                labelKey: 'ribbon.commands.beamEditor.supportType.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.supportType,
                comboboxWidthPx: 130,
                options: BEAM_SUPPORT_TYPE_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'beam-geometry',
      labelKey: 'ribbon.panels.beamGeometry',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.width',
                labelKey: 'ribbon.commands.beamEditor.width',
                commandKey: BEAM_RIBBON_KEYS.params.width,
                comboboxWidthPx: 80,
                options: WIDTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.depth',
                labelKey: 'ribbon.commands.beamEditor.depth',
                commandKey: BEAM_RIBBON_KEYS.params.depth,
                comboboxWidthPx: 80,
                options: DEPTH_MM_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.topElevation',
                labelKey: 'ribbon.commands.beamEditor.topElevation',
                commandKey: BEAM_RIBBON_KEYS.params.topElevation,
                comboboxWidthPx: 80,
                options: ELEVATION_MM_OPTIONS,
              },
            },
            {
              // ADR-401 Phase E.2 — στάθμη άνω παρειάς στο τέλος (mm). Διαφορετική
              // από topElevation → κεκλιμένη δοκός (Revit sloped beam). Free entry
              // (ίδια elevation presets) — η διάχυση (applyBeamSlope/2D/BOQ/attach)
              // είναι έτοιμη από Phase E(β).
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.topElevationEnd',
                labelKey: 'ribbon.commands.beamEditor.topElevationEnd',
                tooltipKey: 'ribbon.commands.beamEditor.topElevationEndTooltip',
                commandKey: BEAM_RIBBON_KEYS.params.topElevationEnd,
                comboboxWidthPx: 80,
                options: ELEVATION_MM_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Phase 5.5c + 5.5i+ — material picker + section type + designation.
      // Visual grouping: kind → geometry → material → actions.
      id: 'beam-material',
      labelKey: 'ribbon.panels.beamMaterial',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.material',
                labelKey: 'ribbon.commands.beamEditor.material.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.material,
                comboboxWidthPx: 180,
                options: BEAM_MATERIAL_OPTIONS,
              },
            },
          ],
        },
        {
          // ADR-363 Φ2 — σχήμα διατομής (ορθογώνιο RC ↔ μεταλλικό Ι). Η επιλογή
          // 'I-shape' εμφανίζει τα catalog + flange/web panels (bridge visibility).
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.sectionKind',
                labelKey: 'ribbon.commands.beamEditor.sectionKind.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.sectionKind,
                comboboxWidthPx: 150,
                options: BEAM_SECTION_KIND_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Φ2 — EN 10365 IPE/HEA/HEB/HEM profile catalog. Ορατό iff
      // `params.sectionKind === 'I-shape'` via bridge.getPanelVisibility.
      id: 'beam-ishape-catalog',
      labelKey: 'ribbon.panels.beamIshapeCatalog',
      visibilityKey: BEAM_RIBBON_VISIBILITY_KEYS.ishapeCatalog,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.ishapeCatalog',
                labelKey: 'ribbon.commands.beamEditor.catalogProfile.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.catalogProfile,
                comboboxWidthPx: 190,
                options: ISHAPE_CATALOG_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-363 Φ2 — I-shape variant inputs (section type hint + flange tf + web
      // tw). Ορατό iff `params.sectionKind === 'I-shape'` via bridge.getPanelVisibility.
      id: 'beam-ishape-params',
      labelKey: 'ribbon.panels.beamIshape',
      visibilityKey: BEAM_RIBBON_VISIBILITY_KEYS.ishapeParams,
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.sectionType',
                labelKey: 'ribbon.commands.beamEditor.sectionType.section.title',
                commandKey: BEAM_RIBBON_KEYS.stringParams.sectionType,
                comboboxWidthPx: 80,
                options: BEAM_SECTION_TYPE_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.flangeThickness',
                labelKey: 'ribbon.commands.beamEditor.flangeThickness',
                commandKey: BEAM_RIBBON_KEYS.params.flangeThickness,
                comboboxWidthPx: 80,
                options: I_FLANGE_THICKNESS_OPTIONS,
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.webThickness',
                labelKey: 'ribbon.commands.beamEditor.webThickness',
                commandKey: BEAM_RIBBON_KEYS.params.webThickness,
                comboboxWidthPx: 80,
                options: I_WEB_THICKNESS_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      // ADR-396 v2 Φ6a — ETICS θερμοπρόσοψη: per-element override της αυτόματης
      // ταξινόμησης κελύφους (auto / εξωτερικό / εσωτερικό), Revit Wall-Function.
      id: 'beam-envelope',
      labelKey: 'ribbon.panels.envelopeFunction',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'beam.envelopeFunction',
                labelKey: 'ribbon.commands.envelopeFunction.section.title',
                tooltipKey: 'ribbon.commands.envelopeFunction.tooltip',
                commandKey: BEAM_RIBBON_KEYS.stringParams.envelopeFunction,
                comboboxWidthPx: 150,
                options: ENVELOPE_FUNCTION_OPTIONS,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'beam-ifc',
      labelKey: 'ribbon.panels.ifcProperties',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'beam.pset.open',
                labelKey: 'ribbon.commands.psetEditor.open',
                icon: 'ifc-pset',
                commandKey: 'beam.pset.open',
                action: PSET_RIBBON_ACTION,
              },
            },
          ],
        },
      ],
    },
    {
      id: 'beam-actions',
      labelKey: 'ribbon.panels.beamActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'beam.close',
                labelKey: 'ribbon.commands.beamEditor.close',
                icon: 'select',
                commandKey: BEAM_RIBBON_KEYS_ACTIONS.close,
                action: BEAM_RIBBON_KEYS_ACTIONS.close,
              },
            },
            {
              type: 'simple',
              size: 'small',
              command: {
                id: 'beam.delete',
                labelKey: 'ribbon.commands.beamEditor.delete',
                icon: 'trash',
                commandKey: BEAM_RIBBON_KEYS_ACTIONS.delete,
                action: BEAM_RIBBON_KEYS_ACTIONS.delete,
              },
            },
          ],
        },
      ],
    },
  ],
};
