/**
 * ADR-654 — descriptor SSoT για τα per-object πεδία ενός επιλεγμένου entourage
 * `ImageEntity` (έπιπλο/άνθρωπος/όχημα/φυτό) στο ΑΡΙΣΤΕΡΟ Properties palette
 * (mirror του `block-property-fields.ts`).
 *
 * Δηλώνει ΩΣ DATA τα groups (Γενικά / Γεωμετρία) με τα πεδία τους: `commandKey`
 * (κοινό με το `useImagePropertyBridge`) + `labelKey` + `control` (readout/select/
 * numeric) + numericInput. Read/write γίνεται από το bridge — εδώ ΜΟΝΟ η δομή.
 * Καθαρά data — zero React/DOM.
 *
 * Big-player split (Revit «Modify | …» / ArchiCAD / C4D / Figma): το contextual
 * ribbon tab κρατά ΜΟΝΟ ενέργειες· ΟΛΕΣ οι ιδιότητες (πηγή + γεωμετρία) ζουν εδώ,
 * στο object inspector.
 */

import { IMAGE_PROPERTY_KEYS as K } from '../ribbon/hooks/bridge/image-command-keys';
import type {
  EntityPropertyField,
  EntityPropertyGroup,
} from '../entity-properties/entity-property-fields';
import type { RibbonNumericInputConfig } from '../ribbon/types/ribbon-types';

/** Editable signed display-unit coordinate (mirror του block COORD_INPUT). */
const COORD_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };
/** Editable positive length (0/negative απαγορεύεται — degenerate πλαίσιο). */
const SIZE_INPUT: RibbonNumericInputConfig = { editable: true, min: 0.0001, allowDecimal: true };
/** Editable rotation in degrees (signed). */
const ANGLE_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };

const field = (
  commandKey: string,
  labelKey: string,
  control: EntityPropertyField['control'],
  numericInput?: RibbonNumericInputConfig,
): EntityPropertyField => ({ commandKey, labelKey, control, options: [], numericInput });

export const IMAGE_PROPERTY_GROUPS: readonly EntityPropertyGroup[] = [
  {
    // Ταυτότητα + εμφάνιση (AutoCAD «General»). Πηγή read-only.
    id: 'general',
    titleKey: 'imageAdvancedPanel.sections.general',
    fields: [
      field(K.source, 'imageAdvancedPanel.fields.source', 'readout'),
      field(K.layer, 'imageAdvancedPanel.fields.layer', 'select'),
    ],
  },
  {
    // Rectangle transform (AutoCAD «Geometry»): κάτω-αριστερή γωνία + διαστάσεις + γωνία.
    id: 'geometry',
    titleKey: 'imageAdvancedPanel.sections.geometry',
    fields: [
      field(K.posX, 'imageAdvancedPanel.fields.posX', 'numeric', COORD_INPUT),
      field(K.posY, 'imageAdvancedPanel.fields.posY', 'numeric', COORD_INPUT),
      field(K.width, 'imageAdvancedPanel.fields.width', 'numeric', SIZE_INPUT),
      field(K.height, 'imageAdvancedPanel.fields.height', 'numeric', SIZE_INPUT),
      field(K.rotation, 'imageAdvancedPanel.fields.rotation', 'numeric', ANGLE_INPUT),
    ],
  },
];
