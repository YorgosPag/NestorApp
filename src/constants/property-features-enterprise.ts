/**
 * 🏢 ENTERPRISE PROPERTY FEATURES SYSTEM
 *
 * Enterprise-class κεντρικοποιημένο σύστημα για property features και lookups
 * Self-contained αρχείο με όλα τα property feature definitions
 * Following the pattern of property-statuses-enterprise.ts
 *
 * @created 2026-01-23
 * @author Claude AI Assistant
 * @version 1.0.5
 * @enterprise Production-ready property features management system
 */


// =============================================================================
// 🏢 REUSE EXISTING PROPERTY TYPE (from src/types/property.ts)
// =============================================================================

export type { PropertyType } from '@/types/property';

// =============================================================================
// 🏢 ORIENTATION CONSTANTS (STORED VALUES = FULL NAMES)
// =============================================================================

/**
 * ORIENTATION ENCODING DECISION: Stored values are FULL NAMES (not abbreviations)
 * Example usage: orientations: ['north', 'east'] NOT ['N', 'E']
 */
export const Orientation = {
  N: 'north',
  NE: 'northeast',
  E: 'east',
  SE: 'southeast',
  S: 'south',
  SW: 'southwest',
  W: 'west',
  NW: 'northwest'
} as const;

// =============================================================================
// 🏢 VIEW TYPE CONSTANTS
// =============================================================================

export const ViewType = {
  SEA: 'sea',
  MOUNTAIN: 'mountain',
  CITY: 'city',
  PARK: 'park',
  GARDEN: 'garden',
  COURTYARD: 'courtyard'
} as const;

// =============================================================================
// 🏢 INTERIOR FEATURE CODES
// =============================================================================

export const InteriorFeatureCode = {
  FIREPLACE: 'fireplace',
  JACUZZI: 'jacuzzi',
  SAUNA: 'sauna',
  SMART_HOME: 'smart-home',
  SOLAR_PANELS: 'solar-panels',
  UNDERFLOOR_HEATING: 'underfloor-heating',
  AIR_CONDITIONING: 'air-conditioning',
} as const;

// =============================================================================
// 🏢 SECURITY FEATURE CODES
// =============================================================================

export const SecurityFeatureCode = {
  ALARM: 'alarm',
  SECURITY_DOOR: 'security-door',
  CCTV: 'cctv',
  ACCESS_CONTROL: 'access-control',
  INTERCOM: 'intercom',
  MOTION_SENSORS: 'motion-sensors'
} as const;

// =============================================================================
// 🏢 AMENITY CODES
// =============================================================================

export const AmenityCode = {
  POOL: 'pool',
  ELEVATOR: 'elevator',
  GYM: 'gym',
  DOORMAN: 'doorman',
  GARDEN: 'garden',
  PLAYGROUND: 'playground',
  PARKING_GARAGE: 'parking-garage'
} as const;

// =============================================================================
// 🏢 ENERGY CLASS CONSTANTS
// =============================================================================

export const EnergyClass = {
  A_PLUS: 'A+',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G'
} as const;

// =============================================================================
// 🏢 TYPE EXPORTS (Following XType pattern from property-statuses-enterprise.ts)
// =============================================================================

/**
 * ENTERPRISE PATTERN: All types use consistent XType naming
 * Following the existing pattern from property-statuses-enterprise.ts
 */

export type OrientationType = typeof Orientation[keyof typeof Orientation];
export type ViewTypeValue = typeof ViewType[keyof typeof ViewType];
export type InteriorFeatureCodeType = typeof InteriorFeatureCode[keyof typeof InteriorFeatureCode];
export type SecurityFeatureCodeType = typeof SecurityFeatureCode[keyof typeof SecurityFeatureCode];
export type AmenityCodeType = typeof AmenityCode[keyof typeof AmenityCode];
export type EnergyClassType = typeof EnergyClass[keyof typeof EnergyClass];

// =============================================================================
// 🏢 ΛΕΞΙΛΟΓΙΑ ΤΙΜΩΝ — Η ΛΙΣΤΑ ΕΙΝΑΙ Η ΠΗΓΗ, Ο ΤΥΠΟΣ ΠΑΡΑΓΕΤΑΙ
// =============================================================================

/**
 * 🔴 **ΗΤΑΝ ΟΚΤΩ ΓΥΜΝΟΙ ΤΥΠΟΙ ΕΝΩΣΗΣ, ΚΑΙ ΤΟ DROPDOWN ΤΟΥΣ ΞΑΝΑΕΓΡΑΦΕ ΜΕ ΤΟ ΧΕΡΙ**
 * *(ADR-842 Α4, κανόνας N.0.2 — διορθώθηκε 2026-09-02)*.
 *
 * Μέχρι σήμερα το λεξιλόγιο ζούσε σε **δύο** τόπους: εδώ ως `type X = 'a' | 'b'`, και
 * στο `features/property-details/components/property-fields-constants.ts` ως
 * `X_OPTIONS: XType[] = ['a', 'b']` — **χειρόγραφη επανάληψη των ίδιων τιμών**.
 *
 * ⚠️ **ΚΑΙ ΟΙ ΔΥΟ ΣΥΜΦΩΝΟΥΣΑΝ — ΜΕΤΡΗΘΗΚΕ, 10 ΣΤΑ 10.** Δεν διορθώνεται επειδή
 * **έσπασε**· διορθώνεται επειδή **δεν μπορούσε να σπάσει θορυβωδώς**: ο τύπος
 * `XType[]` δέχεται **υποσύνολο**, άρα μια τιμή που προστίθεται στην ένωση **δεν
 * φτάνει ποτέ στο dropdown** και **κανένας μεταγλωττιστής δεν παραπονιέται**. Ο
 * χρήστης απλώς δεν βλέπει την επιλογή. Σιωπηλά.
 *
 * 🔑 Είναι το **ίδιο σχήμα** που το `lib/listings/listing-disclosure.ts` έχει ήδη
 * καταγράψει ως περιστατικό: *«δύο ελλιπείς λίστες που συμφωνούν μεταξύ τους»* —
 * βρέθηκε μόνο όταν κάτι τις έκανε να **διαφωνήσουν**.
 *
 * ⚠️ **ΜΗΝ ξαναγράψεις καμία από αυτές τις τιμές αλλού.** Πρόσθεσε στη λίστα εδώ και
 * ο τύπος, το dropdown και κάθε καταναλωτής τη μαθαίνουν **στην ίδια στιγμή**.
 */
export const VIEW_QUALITIES = ['full', 'partial', 'distant'] as const;
export const CONDITIONS = ['new', 'excellent', 'good', 'needs-renovation'] as const;
export const HEATING_TYPES = ['central', 'autonomous', 'heat-pump', 'solar', 'none'] as const;
export const FUEL_TYPES = ['natural-gas', 'oil', 'electricity', 'solar', 'heat-pump'] as const;
export const COOLING_TYPES = ['central-air', 'split-units', 'fan-coil', 'none'] as const;
export const WATER_HEATING_TYPES = ['electric', 'gas', 'solar', 'heat-pump'] as const;
export const FLOORINGS = ['tiles', 'wood', 'laminate', 'marble', 'carpet'] as const;
export const FRAMES = ['aluminum', 'pvc', 'wood'] as const;
export const GLAZINGS = ['single', 'double', 'triple', 'energy'] as const;

/**
 * 🔴 **ΟΝΟΜΑΣΤΗΚΕ `BUILDING_FORMS`, ΚΑΙ ΤΟ ΖΗΤΗΣΕ Η ΠΥΛΗ** *(CHECK 3.7, 2026-09-02)*.
 *
 * Ως τις 02/09 αυτό ήταν γυμνός τύπος `BuildingType` — **ομώνυμος** με το
 * {@link module:constants/building-types}, που είναι **άλλο λεξιλόγιο**:
 * `residential · commercial · industrial · mixed · office · warehouse` *(τύπος
 * κτιρίου της κατασκευής, ADR-287 Batch 9)*. Η ομωνυμία ζούσε **αόρατη** όσο εδώ
 * υπήρχε μόνο ένωση· τη στιγμή που η Α4 την έκανε **πίνακα**, ο φρουρός του module
 * `building-types` την ονόμασε.
 *
 * 🔑 **Η θεραπεία ΔΕΝ είναι συγχώνευση** — είναι **ομωνυμία, όχι διπλότυπο**
 * *(ADR-806 §7 #2)*: εδώ απαντάμε *«τι **μορφή κτίσματος** είναι το ακίνητο της
 * αγγελίας;»* *(πολυκατοικία · μονοκατοικία · μεζονέτα · εμπορικό)*, εκεί *«τι
 * **είδους κτίριο** κατασκευάζεται;»*. Ίδιο όνομα, δύο ερωτήματα — ένα όνομα, ένα
 * σπίτι *(η αρχή του CHECK 3.59)*.
 */
export const BUILDING_FORMS = ['apartment-complex', 'villa', 'maisonette', 'commercial'] as const;

export type ViewQuality = (typeof VIEW_QUALITIES)[number];
export type ConditionType = (typeof CONDITIONS)[number];
export type HeatingType = (typeof HEATING_TYPES)[number];
export type FuelType = (typeof FUEL_TYPES)[number];
export type CoolingType = (typeof COOLING_TYPES)[number];
export type WaterHeatingType = (typeof WATER_HEATING_TYPES)[number];
export type FlooringType = (typeof FLOORINGS)[number];
export type FrameType = (typeof FRAMES)[number];
export type GlazingType = (typeof GLAZINGS)[number];
export type BuildingForm = (typeof BUILDING_FORMS)[number];

/**
 * Οι **παραγόμενες** λίστες των λεξιλογίων που δηλώνονται ως αντικείμενα-σταθερές
 * παραπάνω (`Orientation`, `EnergyClass`, `InteriorFeatureCode`, `SecurityFeatureCode`,
 * `AmenityCode`, `ViewType`).
 *
 * ⚠️ `Object.values` πάνω σε `as const` **διατηρεί τη σειρά δήλωσης**
 * (ECMAScript `OrdinaryOwnPropertyKeys`) — η σειρά του αντικειμένου **είναι** η σειρά
 * της οθόνης, όπως και στο `LISTING_DISCLOSURE`. Αλλαγή σειράς εκεί = αλλαγή οθόνης,
 * και διαβάζεται ως τέτοια στο diff.
 *
 * 🔴 **ΤΟ `readonly` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ — ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ Η SSoT ΜΕΝΕΙ SSoT.**
 * Το `Object.values()` τρέχει **μία φορά** στη φόρτωση του module, άρα υπάρχει **ένας**
 * πίνακας. Αν μια όψη τον μοιραζόταν με αναφορά (`= ORIENTATIONS` αντί
 * `= [...ORIENTATIONS]`), τότε ένα `.sort()` ή `.push()` σε **οποιοδήποτε** dropdown θα
 * **μετέβαλλε το ίδιο το λεξιλόγιο** για ολόκληρη την εφαρμογή, για όλους τους
 * καταναλωτές, μέχρι το επόμενο reload — και η αιτία θα ήταν αόρατη στο σημείο του
 * σφάλματος. Ο τύπος `readonly` το κάνει **σφάλμα μεταγλώττισης** αντί για περιστατικό.
 */
export const ORIENTATIONS: readonly OrientationType[] = Object.values(Orientation);
export const ENERGY_CLASSES: readonly EnergyClassType[] = Object.values(EnergyClass);
export const INTERIOR_FEATURES: readonly InteriorFeatureCodeType[] =
  Object.values(InteriorFeatureCode);
export const SECURITY_FEATURES: readonly SecurityFeatureCodeType[] =
  Object.values(SecurityFeatureCode);
export const AMENITIES: readonly AmenityCodeType[] = Object.values(AmenityCode);
export const VIEW_TYPES: readonly ViewTypeValue[] = Object.values(ViewType);
// =============================================================================
// 🏢 I18N KEY MAPPINGS (for translation)
// =============================================================================

/**
 * i18n keys for orientation labels
 * Components use these with useTranslation hook
 */
export const ORIENTATION_LABELS: Record<OrientationType, string> = {
  'north': 'units.orientation.north',
  'northeast': 'units.orientation.northeast',
  'east': 'units.orientation.east',
  'southeast': 'units.orientation.southeast',
  'south': 'units.orientation.south',
  'southwest': 'units.orientation.southwest',
  'west': 'units.orientation.west',
  'northwest': 'units.orientation.northwest'
};
