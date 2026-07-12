/**
 * ADR-507 — descriptor SSoT για τα per-object πεδία της επιλεγμένης ΓΡΑΜΜΟΣΚΙΑΣΗΣ
 * στο ΑΡΙΣΤΕΡΟ Properties palette (mirror του `line-property-fields.ts`).
 *
 * Δηλώνει ΩΣ DATA τα groups (Γενικά / Μοτίβο / Διαβάθμιση / Πληροφορίες) με τα πεδία
 * τους: `commandKey` (κοινό με το `useRibbonHatchBridge`) + `labelKey` (τα ΥΠΑΡΧΟΝΤΑ
 * `ribbon.commands.hatchEditor.*`, μηδέν νέα) + `control` (select/color/numeric/toggle/
 * readout). Read/write γίνεται από το ΙΔΙΟ hatch bridge (get/onComboboxChange +
 * get/onToggle) — εδώ ΜΟΝΟ η δομή/κατανομή. Οι select option-lists ζουν ΕΔΩ (panel-only
 * μετά το ribbon-slim), μεταφερμένες από το `contextual-hatch-tab.ts` — μηδέν διπλότυπο.
 *
 * Καθαρά data types — zero React/DOM.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { HATCH_RIBBON_KEYS } from '../ribbon/hooks/bridge/hatch-command-keys';
import { listHatchPatterns } from '../../data/hatch-pattern-catalog';
import { LINEWEIGHT_RIBBON_OPTIONS } from '../ribbon/data/lineweight-ribbon-options';
import type {
  EntityPropertyControl,
  EntityPropertyField,
  EntityPropertyGroup,
} from '../entity-properties/entity-property-fields';
import type { BimPropertyOption } from '../bim-properties/bim-property-types';
import type { RibbonNumericInputConfig } from '../ribbon/types/ribbon-types';

// ── Select option lists (μεταφορά από contextual-hatch-tab μετά το ribbon-slim) ──

const FILL_TYPE_OPTIONS: readonly BimPropertyOption[] = [
  { value: 'solid', labelKey: 'ribbon.commands.hatchEditor.fillTypeSolid' },
  { value: 'user-defined', labelKey: 'ribbon.commands.hatchEditor.fillTypeUserDefined' },
  { value: 'predefined', labelKey: 'ribbon.commands.hatchEditor.fillTypePredefined' },
  { value: 'gradient', labelKey: 'ribbon.commands.hatchEditor.fillTypeGradient' },
  // ADR-643 — γέμισμα με εικόνα υλικού (μοντέλο ArchiCAD «Image Fill»).
  { value: 'image', labelKey: 'ribbon.commands.hatchEditor.fillTypeImage' },
];

const ISLAND_STYLE_OPTIONS: readonly BimPropertyOption[] = [
  { value: 'normal', labelKey: 'ribbon.commands.hatchEditor.islandNormal' },
  { value: 'outer', labelKey: 'ribbon.commands.hatchEditor.islandOuter' },
  { value: 'ignore', labelKey: 'ribbon.commands.hatchEditor.islandIgnore' },
];

const GRADIENT_TYPE_OPTIONS: readonly BimPropertyOption[] = [
  { value: 'linear', labelKey: 'ribbon.commands.hatchEditor.gradientTypes.linear' },
  { value: 'cylinder', labelKey: 'ribbon.commands.hatchEditor.gradientTypes.cylinder' },
  { value: 'invcylinder', labelKey: 'ribbon.commands.hatchEditor.gradientTypes.invcylinder' },
  { value: 'spherical', labelKey: 'ribbon.commands.hatchEditor.gradientTypes.spherical' },
  { value: 'invspherical', labelKey: 'ribbon.commands.hatchEditor.gradientTypes.invspherical' },
  { value: 'hemispherical', labelKey: 'ribbon.commands.hatchEditor.gradientTypes.hemispherical' },
  { value: 'curved', labelKey: 'ribbon.commands.hatchEditor.gradientTypes.curved' },
];

/** Predefined μοτίβα — options από τον PAT catalog (SSoT), label μέσω i18n key. */
const PATTERN_NAME_OPTIONS: readonly BimPropertyOption[] = listHatchPatterns().map((p) => ({
  value: p.name, labelKey: p.labelKey,
}));

// ── Numeric constraints (mirror των πρώην ribbon numericInput specs) ────────────

const SCALE_INPUT: RibbonNumericInputConfig = { editable: true, min: 0.01 };
const ANGLE_INPUT: RibbonNumericInputConfig = { editable: true, min: 0, max: 360 };
// ADR-643 Φ3 — πραγματική διάσταση tile εικόνας (mm)· ≥1 mm.
const TILE_INPUT: RibbonNumericInputConfig = { editable: true, min: 1 };
const SPACING_INPUT: RibbonNumericInputConfig = { editable: true, min: 1 };
const TRANSPARENCY_INPUT: RibbonNumericInputConfig = { editable: true, min: 0, max: 90, allowDecimal: false };
const SHIFT_INPUT: RibbonNumericInputConfig = { editable: true, min: 0, max: 1 };

const H = (
  commandKey: string,
  labelKey: string,
  control: EntityPropertyControl,
  extra: Partial<EntityPropertyField> = {},
): EntityPropertyField => ({ commandKey, labelKey, control, options: [], ...extra });

const K = HATCH_RIBBON_KEYS;
const lbl = (k: string): string => `ribbon.commands.hatchEditor.${k}`;

/**
 * Πεδία που ισχύουν ΜΟΝΟ για επιλεγμένη γραμμοσκίαση (ιδιότητες οντότητας)· κρύβονται
 * στο draft mode (εργαλείο ενεργό χωρίς επιλογή → ρύθμιση draw-defaults).
 */
export const HATCH_SELECTION_ONLY_KEYS: ReadonlySet<string> = new Set([
  K.params.transparency,
  K.toggles.sendToBack,
  K.readouts.area,
]);

// ── Groups (κατανομή: full appearance + pattern + gradient + info → panel) ───────

export const HATCH_PROPERTY_GROUPS: readonly EntityPropertyGroup[] = [
  {
    id: 'general',
    titleKey: 'hatchAdvancedPanel.sections.general.title',
    fields: [
      H(K.stringParams.layer, lbl('layer'), 'select'),
      H(K.stringParams.fillColor, lbl('fillColor'), 'color'),
      H(K.stringParams.lineweight, lbl('lineweight'), 'select', { options: LINEWEIGHT_RIBBON_OPTIONS }),
      H(K.params.transparency, lbl('transparency'), 'numeric', { numericInput: TRANSPARENCY_INPUT }),
      H(K.toggles.sendToBack, lbl('sendToBack'), 'toggle'),
    ],
  },
  {
    id: 'pattern',
    titleKey: 'hatchAdvancedPanel.sections.pattern.title',
    fields: [
      H(K.stringParams.fillType, lbl('fillType'), 'select', { options: FILL_TYPE_OPTIONS }),
      H(K.stringParams.patternName, lbl('patternName'), 'select', { options: PATTERN_NAME_OPTIONS }),
      H(K.params.patternScale, lbl('patternScale'), 'numeric', { numericInput: SCALE_INPUT }),
      H(K.params.lineAngle, lbl('lineAngle'), 'numeric', { numericInput: ANGLE_INPUT }),
      H(K.params.lineSpacing, lbl('lineSpacing'), 'numeric', { numericInput: SPACING_INPUT }),
      H(K.toggles.doubleCrossHatch, lbl('doubleCrossHatch'), 'toggle'),
      H(K.stringParams.islandStyle, lbl('islandStyle'), 'select', { options: ISLAND_STYLE_OPTIONS }),
    ],
  },
  {
    // Revit-style contextual: ορατό μόνο όταν fillType='gradient' (bridge.getPanelVisibility).
    id: 'gradient',
    titleKey: 'hatchAdvancedPanel.sections.gradient.title',
    visibilityKey: K.visibility.gradient,
    fields: [
      H(K.stringParams.gradientType, lbl('gradientType'), 'select', { options: GRADIENT_TYPE_OPTIONS }),
      H(K.params.gradientAngle, lbl('gradientAngle'), 'numeric', { numericInput: ANGLE_INPUT }),
      H(K.params.gradientShift, lbl('gradientShift'), 'numeric', { numericInput: SHIFT_INPUT }),
      H(K.stringParams.gradientColor1, lbl('gradientColor1'), 'color'),
      H(K.stringParams.gradientColor2, lbl('gradientColor2'), 'color'),
      H(K.toggles.gradientSingleColor, lbl('gradientSingleColor'), 'toggle'),
    ],
  },
  {
    // ADR-643 — Revit/ArchiCAD-style contextual: ορατό μόνο όταν fillType='image'
    // (bridge.getPanelVisibility). Το visual swatch grid (επιλογή υλικού) το ζωγραφίζει
    // bespoke ο `HatchPropertiesTab` πάνω από αυτά τα πεδία (reuse ADR-413 thumbnails).
    id: 'image',
    titleKey: 'hatchAdvancedPanel.sections.image.title',
    visibilityKey: K.visibility.image,
    fields: [
      H(K.params.imageTileWidth, lbl('imageTileWidth'), 'numeric', { numericInput: TILE_INPUT }),
      H(K.params.imageTileHeight, lbl('imageTileHeight'), 'numeric', { numericInput: TILE_INPUT }),
      H(K.params.imageAngle, lbl('imageAngle'), 'numeric', { numericInput: ANGLE_INPUT }),
    ],
  },
  {
    id: 'info',
    titleKey: 'hatchAdvancedPanel.sections.info.title',
    fields: [
      H(K.readouts.area, lbl('area'), 'readout'),
    ],
  },
];
