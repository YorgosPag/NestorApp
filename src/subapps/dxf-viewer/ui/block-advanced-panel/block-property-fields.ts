/**
 * ADR-641 (single-click selection surface) — descriptor SSoT για τα per-object
 * πεδία ενός επιλεγμένου BLOCK (INSERT) στο ΑΡΙΣΤΕΡΟ Properties palette (mirror του
 * `line-property-fields.ts` / `column-property-fields.ts`).
 *
 * Δηλώνει ΩΣ DATA τα groups (Γενικά / Γεωμετρία) με τα πεδία τους: `commandKey`
 * (κοινό με το `useBlockPropertyBridge`) + `labelKey` + `control` (readout/select/
 * color/numeric) + numericInput. Read/write γίνεται από το bridge (get/onComboboxChange)
 * — εδώ ΜΟΝΟ η δομή/κατανομή. Καθαρά data — zero React/DOM.
 *
 * Big-player split (Revit/ArchiCAD/C4D/Figma· Giorgio 2026-07-13): το contextual
 * ribbon tab κρατά ΜΟΝΟ ενέργειες (Επεξεργασία Μπλοκ / Διάλυση)· ΟΛΕΣ οι ιδιότητες
 * (ταυτότητα + εμφάνιση + γεωμετρία) ζουν εδώ, στο object inspector.
 */

import { BLOCK_PROPERTY_KEYS as K } from '../ribbon/hooks/bridge/block-command-keys';
import type {
  EntityPropertyField,
  EntityPropertyGroup,
} from '../entity-properties/entity-property-fields';
import type { RibbonNumericInputConfig } from '../ribbon/types/ribbon-types';

/** Editable signed display-unit coordinate (mirror του line COORD_INPUT). */
const COORD_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };
/** Editable positive scale ratio (0 απαγορεύεται — degenerate INSERT). */
const SCALE_INPUT: RibbonNumericInputConfig = { editable: true, min: 0.0001, allowDecimal: true };
/** Editable rotation in degrees (signed). */
const ANGLE_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };

const field = (
  commandKey: string,
  labelKey: string,
  control: EntityPropertyField['control'],
  numericInput?: RibbonNumericInputConfig,
): EntityPropertyField => ({ commandKey, labelKey, control, options: [], numericInput });

export const BLOCK_PROPERTY_GROUPS: readonly EntityPropertyGroup[] = [
  {
    // Ταυτότητα + εμφάνιση (AutoCAD «General»). Όνομα/Πλήθος read-only.
    id: 'general',
    titleKey: 'blockAdvancedPanel.sections.general',
    fields: [
      field(K.name, 'blockAdvancedPanel.fields.name', 'readout'),
      field(K.count, 'blockAdvancedPanel.fields.count', 'readout'),
      field(K.layer, 'blockAdvancedPanel.fields.layer', 'select'),
      field(K.color, 'blockAdvancedPanel.fields.color', 'color'),
      field(K.transparency, 'blockAdvancedPanel.fields.transparency', 'numeric', {
        editable: true, min: 0, max: 90, allowDecimal: false,
      }),
    ],
  },
  {
    // INSERT transform (AutoCAD «Geometry»): σημείο εισαγωγής + κλίμακα + γωνία.
    id: 'geometry',
    titleKey: 'blockAdvancedPanel.sections.geometry',
    fields: [
      field(K.posX, 'blockAdvancedPanel.fields.posX', 'numeric', COORD_INPUT),
      field(K.posY, 'blockAdvancedPanel.fields.posY', 'numeric', COORD_INPUT),
      field(K.scaleX, 'blockAdvancedPanel.fields.scaleX', 'numeric', SCALE_INPUT),
      field(K.scaleY, 'blockAdvancedPanel.fields.scaleY', 'numeric', SCALE_INPUT),
      field(K.rotation, 'blockAdvancedPanel.fields.rotation', 'numeric', ANGLE_INPUT),
    ],
  },
];
