/**
 * =============================================================================
 * SSoT: Το λεξιλόγιο των ΚΟΙΝΟΧΡΗΣΤΩΝ ΧΩΡΩΝ ενός κτιρίου (ADR-931)
 * =============================================================================
 *
 * Κάθε κατηγορία κουβαλά **ταυτόχρονα** τις τρεις γλώσσες που μιλούν οι μεγάλοι —
 * εκεί όπου ο καθένας τους κρατά μόνο τη δική του:
 *
 * | Άξονας | Πηγή | Τι απαντά |
 * |---|---|---|
 * | `group` | ΝΕΣΤΩΡ | πώς ομαδοποιείται στην οθόνη |
 * | `ipmsComponent` | **IPMS Residential** (IPMSC 2016) | σε ποιο Component της μέτρησης ανήκει |
 * | `revitAreaType` | **Revit** Rentable Area Scheme (BOMA) | ποιος Area Type θα του έδινε η Revit |
 * | `ifcPredefinedType` | **IFC 4.3** `IfcSpaceTypeEnum` | πώς εξάγεται ως `IfcSpace` |
 *
 * ⚖️ **Νομική φύση** (ΑΚ 1117 · ν. 3741/1929): τα κοινόχρηστα **δεν μεταβιβάζονται αυτοτελώς**
 * και ο καθορισμός τους ανήκει στη **σύσταση οριζόντιας ιδιοκτησίας**. Γι' αυτό η φύση
 * (`common_use` / `exclusive_use`) είναι **πεδίο του χώρου**, όχι ιδιότητα της κατηγορίας:
 * ένα δώμα μπορεί να είναι κοινόχρηστο σε μία πολυκατοικία και αποκλειστικής χρήσης του
 * ρετιρέ σε άλλη — το αποφασίζει ο τίτλος, όχι το λεξικό.
 *
 * 🔑 Νέα κατηγορία = **μία** γραμμή στο `COMMON_SPACE_CATEGORIES` + **μία** στο
 * `COMMON_SPACE_CATEGORY_DEFS` (ο τύπος `Record<CommonSpaceCategory, …>` την **απαιτεί**) +
 * κλειδί i18n `commonSpaces.categories.<κατηγορία>` (το φυλάει το jest anchor).
 *
 * @module constants/common-space-categories
 * @see docs/centralized-systems/reference/adrs/ADR-931-common-spaces-entity.md
 */

// =============================================================================
// ΟΜΑΔΕΣ
// =============================================================================

/** Οι ομάδες, **σε σειρά εμφάνισης** — η σελίδα και η καρτέλα τις αποδίδουν με αυτή τη σειρά. */
export const COMMON_SPACE_GROUPS = [
  'circulation',
  'vertical',
  'technical',
  'outdoor',
  'amenity',
] as const;

export type CommonSpaceGroup = (typeof COMMON_SPACE_GROUPS)[number];

// =============================================================================
// ΚΑΤΗΓΟΡΙΕΣ
// =============================================================================

/** Οι κατηγορίες, **σε σειρά εμφάνισης** (μέσα σε κάθε ομάδα). Τα νέα μπαίνουν στο τέλος της ομάδας τους. */
export const COMMON_SPACE_CATEGORIES = [
  // circulation — οριζόντια κυκλοφορία
  'entrance_lobby',
  'corridor',
  'ramp',
  // vertical — κατακόρυφες διεισδύσεις (Revit «Major Vertical Penetration»)
  'stairwell',
  'elevator',
  'shaft',
  // technical — εγκαταστάσεις
  'boiler_room',
  'electrical_room',
  'pump_room',
  'elevator_machine_room',
  'waste_room',
  // outdoor — υπαίθριοι / ημιυπαίθριοι
  'pilotis',
  'roof_terrace',
  'garden',
  'light_well',
  // amenity — παροχές
  'gym',
  'pool',
  'lounge',
  'playroom',
  'bicycle_room',
  'concierge',
  'other',
] as const;

export type CommonSpaceCategory = (typeof COMMON_SPACE_CATEGORIES)[number];

// =============================================================================
// ΝΟΜΙΚΗ ΦΥΣΗ
// =============================================================================

/**
 * ΑΚ 1117: `common_use` = κοινή χρήση όλων των συνιδιοκτητών · `exclusive_use` = κοινόκτητο
 * με **αποκλειστική χρήση** συγκεκριμένων ιδιοκτησιών (π.χ. δώμα → ρετιρέ), όπως το ορίζει η σύσταση.
 */
export const COMMON_SPACE_LEGAL_NATURES = ['common_use', 'exclusive_use'] as const;

export type CommonSpaceLegalNature = (typeof COMMON_SPACE_LEGAL_NATURES)[number];

/** Η φύση στη γέννηση όταν δεν δηλωθεί — ο κανόνας του ΑΚ 1117 χωρίς ειδική συμφωνία. */
export const DEFAULT_COMMON_SPACE_LEGAL_NATURE: CommonSpaceLegalNature = 'common_use';

// =============================================================================
// ΟΡΙΣΜΟΙ
// =============================================================================

/** IPMS Residential Components: A κατακόρυφες διεισδύσεις · C τεχνικές υπηρεσίες · E κυκλοφορία · F παροχές · H λοιπά. */
export type IpmsComponent = 'A' | 'C' | 'E' | 'F' | 'H';

/** Revit Rentable Area Scheme — οι Area Types που αφορούν κοινόχρηστα. */
export type RevitAreaType = 'building_common_area' | 'major_vertical_penetration' | 'exterior_area';

/** IFC 4.3 `IfcSpaceTypeEnum` — εσωτερικός ή εξωτερικός χώρος. */
export type IfcSpacePredefinedType = 'INTERNAL' | 'EXTERNAL';

export interface CommonSpaceCategoryDef {
  readonly group: CommonSpaceGroup;
  readonly ipmsComponent: IpmsComponent;
  readonly revitAreaType: RevitAreaType;
  readonly ifcPredefinedType: IfcSpacePredefinedType;
}

const circulation = { group: 'circulation', ipmsComponent: 'E', revitAreaType: 'building_common_area', ifcPredefinedType: 'INTERNAL' } as const;
const vertical = { group: 'vertical', ipmsComponent: 'A', revitAreaType: 'major_vertical_penetration', ifcPredefinedType: 'INTERNAL' } as const;
const technical = { group: 'technical', ipmsComponent: 'C', revitAreaType: 'building_common_area', ifcPredefinedType: 'INTERNAL' } as const;
const outdoor = { group: 'outdoor', ipmsComponent: 'H', revitAreaType: 'exterior_area', ifcPredefinedType: 'EXTERNAL' } as const;
const amenity = { group: 'amenity', ipmsComponent: 'F', revitAreaType: 'building_common_area', ifcPredefinedType: 'INTERNAL' } as const;

/** Ο ορισμός κάθε κατηγορίας — **ολικός** πάνω στη ρίζα: κατηγορία χωρίς ορισμό δεν μεταγλωττίζεται. */
export const COMMON_SPACE_CATEGORY_DEFS: Readonly<Record<CommonSpaceCategory, CommonSpaceCategoryDef>> = {
  entrance_lobby: circulation,
  corridor: circulation,
  ramp: circulation,
  stairwell: vertical,
  elevator: vertical,
  shaft: vertical,
  boiler_room: technical,
  electrical_room: technical,
  pump_room: technical,
  elevator_machine_room: technical,
  waste_room: technical,
  pilotis: outdoor,
  roof_terrace: outdoor,
  garden: outdoor,
  light_well: outdoor,
  gym: amenity,
  pool: { ...amenity, ifcPredefinedType: 'EXTERNAL' },
  lounge: amenity,
  playroom: amenity,
  bicycle_room: amenity,
  concierge: amenity,
  other: amenity,
};

// =============================================================================
// HELPERS
// =============================================================================

const CATEGORY_SET: ReadonlySet<string> = new Set(COMMON_SPACE_CATEGORIES);
const LEGAL_NATURE_SET: ReadonlySet<string> = new Set(COMMON_SPACE_LEGAL_NATURES);

export function isCommonSpaceCategory(value: unknown): value is CommonSpaceCategory {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

export function isCommonSpaceLegalNature(value: unknown): value is CommonSpaceLegalNature {
  return typeof value === 'string' && LEGAL_NATURE_SET.has(value);
}

/** Η ομάδα μιας κατηγορίας. */
export function commonSpaceGroupOf(category: CommonSpaceCategory): CommonSpaceGroup {
  return COMMON_SPACE_CATEGORY_DEFS[category].group;
}

/** Οι κατηγορίες μιας ομάδας, στη σειρά του λεξιλογίου. */
export function commonSpaceCategoriesOf(group: CommonSpaceGroup): readonly CommonSpaceCategory[] {
  return COMMON_SPACE_CATEGORIES.filter((category) => COMMON_SPACE_CATEGORY_DEFS[category].group === group);
}
