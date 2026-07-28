/**
 * ADR-510 Φ2E — SSoT για τα «γενικά γεωμετρικά primitives» των οποίων το στυλ
 * (linetype / lineweight / color) επεξεργάζεται μέσω του ΕΝΟΣ Line-Tool
 * contextual tab — και στη σχεδίαση (draw-defaults) και στην επιλογή (selected).
 *
 * ΕΝΑ σημείο ορισμού του συνόλου: το χρησιμοποιεί ΚΑΙ ο `resolveContextualTrigger`
 * (για να εμφανίσει το tab σε selection) ΚΑΙ ο `useRibbonLineToolBridge` (για να
 * αποφασίσει αν θα γράψει στην επιλεγμένη οντότητα ή στα draw-defaults). Έτσι οι
 * δύο πλευρές δεν αποκλίνουν ποτέ (κλασικό SSoT, μηδέν διπλότυπη λίστα).
 *
 * Σκόπιμα ΕΚΤΟΣ: BIM/structural/MEP/annotation entities — αυτά έχουν δικά τους
 * πλούσια contextual tabs (wall/beam/column/dimension/text/hatch...). Εδώ μένουν
 * μόνο τα «καθαρά» DXF γεωμετρικά στοιχεία που φέρουν generic γραμμικό στυλ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ2E
 */

import type { EntityType } from './base-entity';

/** Generic geometric primitives editable via the Line-Tool style tab. */
export const STYLE_EDITABLE_PRIMITIVE_TYPES: ReadonlySet<EntityType> = new Set<EntityType>([
  'line',
  'polyline',
  'lwpolyline',
  'circle',
  'arc',
  'ellipse',
  'spline',
  'rectangle',
  'rect',
]);

/** True when the entity type carries generic linetype/lineweight/color editable via the Line-Tool tab. */
export function isStyleEditablePrimitiveType(type: string): boolean {
  return STYLE_EDITABLE_PRIMITIVE_TYPES.has(type as EntityType);
}

/**
 * Η ίδια ερώτηση με φύλακα τύπου, για καταναλωτές που κρατούν **οντότητα** αντί
 * για σκέτο `type` — π.χ. το SSoT `useResolveSelectedEntity`, που δέχεται
 * `(entity) => entity is T`.
 *
 * Είναι generic πάνω στο δομικό σχήμα (`{ type: string }`) ώστε να μη σύρει εδώ
 * την εξάρτηση από το `types/entities`: το σύνολο των τύπων ορίζεται σε αυτό το
 * αρχείο, και ένα αρχείο ορισμού συνόλου δεν χρειάζεται να ξέρει την πλήρη ένωση
 * οντοτήτων για να απαντήσει «ανήκει;».
 */
export function isStyleEditablePrimitive<T extends { type: string }>(entity: T): entity is T {
  return isStyleEditablePrimitiveType(entity.type);
}
