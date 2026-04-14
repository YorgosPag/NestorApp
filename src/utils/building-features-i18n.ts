/**
 * 🏢 ENTERPRISE: Building Features i18n Utility
 *
 * Centralized reverse lookup for translating Greek building feature strings
 * stored in the database to i18n keys for proper localization.
 *
 * This is the SINGLE SOURCE OF TRUTH for Greek-to-key mappings.
 * Use translateBuildingFeature() instead of maintaining separate lookup maps.
 *
 * @module utils/building-features-i18n
 * @enterprise Fortune 500 compliant - Zero duplicated lookup maps
 */

// ============================================================================
// REVERSE LOOKUP MAP - Greek strings to i18n feature keys
// ============================================================================

/**
 * Maps Greek strings (as stored in database) to building feature keys.
 * Multiple variations are included to handle different capitalizations and phrasings.
 */
export const FEATURE_GREEK_TO_KEY: Record<string, string> = {
  // === HEATING & CLIMATE ===
  'Αυτόνομη Θέρμανση': 'autonomousHeating',
  'Αυτόνομη θέρμανση': 'autonomousHeating',
  'Θερμαντικά Αυτονομίας': 'autonomousHeating',
  'Θέρμανση Αυτονομίας': 'autonomousHeating',
  'Θέρμανση αυτονομίας': 'autonomousHeating',
  'Ηλιακή Θέρμανση': 'solarHeating',
  'Ηλιακή θέρμανση': 'solarHeating',
  'Ηλιακός θερμοσίφωνας': 'solarHeating',
  'Κλιματισμός VRV': 'vrvClimate',
  'VRV Climate System': 'vrvClimate',
  'Έξυπνος Κλιματισμός': 'smartClimate',
  'Εξυπνος κλιματισμός': 'smartClimate',
  'Έξυπνος κλιματισμός': 'smartClimate',
  'Smart Climate Control': 'smartClimate',
  'Κλιματισμός Αποθήκης': 'warehouseClimate',
  'Κλιματισμένες αποθήκες': 'warehouseClimate',
  'Κλιματισμός αποθηκών': 'warehouseClimate',
  'Warehouse Climate Control': 'warehouseClimate',

  // === VENTILATION ===
  'Αυτόματος Εξαερισμός': 'automaticVentilation',
  'Αυτόματη εξαερισμός': 'automaticVentilation',
  'Αυτόματος εξαερισμός': 'automaticVentilation',
  'Φυσικός Αερισμός': 'naturalVentilation',
  'Φυσικός αερισμός': 'naturalVentilation',

  // === PARKING & TRANSPORT ===
  'Θέσεις Στάθμευσης': 'parkingSpaces',
  'Θέσεις στάθμευσης': 'parkingSpaces',
  'Θέσεις σταθμεύσεις': 'parkingSpaces',
  'Υπόγειο Πάρκινγκ': 'parkingSpaces',
  'Υπόγειο πάρκινγκ': 'parkingSpaces',
  'Φόρτιση Ηλεκτρικών Οχημάτων': 'electricVehicleCharging',
  'Ηλεκτρική φόρτιση οχημάτων': 'electricVehicleCharging',
  'Φόρτιση Tesla/VW': 'teslaVwCharging',
  'Ηλεκτρική φόρτιση Tesla/VW': 'teslaVwCharging',
  'Σύστημα Καθοδήγησης Στάθμευσης': 'parkingGuidanceSystem',
  'Σύστημα καθοδήγησης parking': 'parkingGuidanceSystem',
  'Σύστημα καθοδήγησης στάθμευσης': 'parkingGuidanceSystem',
  'Πλυντήριο Αυτοκινήτων': 'carWash',
  'Πλυντήρια Αυτοκινήτων': 'carWashPlural',
  'Πλυντήρια αυτοκινήτων': 'carWashPlural',

  // === ELEVATORS & ACCESS ===
  'Ανελκυστήρας': 'elevator',
  'Ασανσέρ': 'elevator',
  'Ασανσερ': 'elevator',
  'Elevator': 'elevator',
  'Κυλιόμενες Σκάλες σε όλους τους ορόφους': 'escalatorsAllFloors',
  'Σκάλες κυλιόμενες σε όλους τους ορόφους': 'escalatorsAllFloors',
  'Κυλιόμενες σκάλες σε όλους τους ορόφους': 'escalatorsAllFloors',
  'σκάλες κυλιόμενες σε όλους τους ορόφους': 'escalatorsAllFloors',
  'Escalators on All Floors': 'escalatorsAllFloors',
  'Πρόσβαση ΑμεΑ': 'disabilityAccess',
  'Πρόσβαση Φορτηγών': 'loadingAccess',
  'Πρόσβαση φορτηγών': 'loadingAccess',
  'Ράμπες Φόρτωσης': 'loadingRamps',
  'Ράμπες φόρτωσης': 'loadingRamps',
  'Έλεγχος Πρόσβασης': 'accessControl',
  'Έλεγχος πρόσβασης': 'accessControl',

  // === SECURITY ===
  'Κάμερες Ασφαλείας 24/7': 'securityCameras247',
  'Κάμερες ασφαλείας 24/7': 'securityCameras247',
  'Συστήματα Ασφαλείας': 'securitySystems',
  'Συστήματα ασφαλείας': 'securitySystems',
  'Μηχανική Ασφάλεια': 'mechanicalSecurity',
  'Μηχανική ασφάλεια': 'mechanicalSecurity',
  'Έξοδοι Κινδύνου': 'emergencyExits',
  'Έξοδοι κινδύνου': 'emergencyExits',

  // === FIRE SAFETY ===
  'Πυρόσβεση': 'fireSuppression',
  'Πυροσβεστικό σύστημα': 'fireSuppression',
  'Πυροσβεστικό Σύστημα': 'fireSuppression',
  'Fire Suppression': 'fireSuppression',
  'Πυρόσβεση Αερίου': 'gasFireSuppression',
  'Πυρόσβεση αερίου': 'gasFireSuppression',
  'Περιβαλλοντικό σύστημα': 'gasFireSuppression', // Environmental system

  // === ENERGY & POWER ===
  'Ενεργειακή Κλάση Α+': 'energyClassAPlus',
  'Ενεργειακή κλάση Α+': 'energyClassAPlus',
  'Παροχή Ρεύματος 1000kW': 'powerSupply1000kw',
  'Παροχή ρεύματος 1000kw': 'powerSupply1000kw',
  'Παροχή ρεύματος 1000kW': 'powerSupply1000kw',
  'Ηλεκτροδότηση 1000kW': 'powerSupply1000kw',
  'Ηλεκτροδότηση 1000kw': 'powerSupply1000kw',
  'Ηλεκτροδότηση 1000KW': 'powerSupply1000kw',
  'Ηλεκτροδότηση 1000 kW': 'powerSupply1000kw',
  'Ηλεκτροδότηση 1000 kw': 'powerSupply1000kw',
  'ηλεκτροδότηση 1000kw': 'powerSupply1000kw',
  'ηλεκτροδότηση 1000 kw': 'powerSupply1000kw',
  'Ανάκτηση θερμότη': 'solarHeating', // Heat recovery

  // === ARCHITECTURE & DESIGN ===
  'Μπαλκόνια με Θέα': 'balconiesWithView',
  'Μπαλκόνια': 'balconiesWithView',
  'Βιτρίνες Καταστημάτων': 'shopWindows',
  'Βιτρίνες καταστημάτων': 'shopWindows',
  'Φυσικός Φωτισμός Atrium': 'naturalLightingAtrium',
  'Κεντρικό άτομο με φυσικό φωτισμό': 'naturalLightingAtrium',
  'Κεντρικό atrium με φυσικό φωτισμό': 'naturalLightingAtrium',
  'Κεντρικό άτριο με φυσικό φωτισμό': 'naturalLightingAtrium',
  'κεντρικό άτριο με φυσικό φωτισμό': 'naturalLightingAtrium',
  'Υψηλής Ποιότητας Ακουστική': 'highQualityAcoustics',
  'Υψηλής ποιότητας ακουστική': 'highQualityAcoustics',

  // === INDUSTRIAL & WAREHOUSE ===
  'Γερανογέφυρα 20 Τόνων': 'craneBridge20Tons',
  'Γερανογέφυρες 20 τόνων': 'craneBridge20Tons',
  'Συστήματα Αποκονίωσης': 'dustRemovalSystems',
  'Συστήματα αφαίρεσης σκόνης': 'dustRemovalSystems',
  'Ράφια Ύψους 12μ': 'highShelving12m',
  'Ψηλά ράφια 12 μέτρων': 'highShelving12m',
  'Ψηλά ρεύμα 12 μέτρων': 'highShelving12m',
  'Σύστημα RFID': 'rfidTracking',

  // === AUTOMATION & TECHNOLOGY ===
  'Συστήματα Αυτοματισμού': 'automationSystems',
  'Συστήματα αυτοματισμού': 'automationSystems',
  'Συστήματα Παρακολούθησης': 'monitoringSystems',
  'Συστήματα παρακολούθησης': 'monitoringSystems',
  'Τηλεδιάσκεψη σε όλες τις αίθουσες': 'videoConferencingAllRooms',
  'Video Conferencing in All Rooms': 'videoConferencingAllRooms',
  'Σύστημα Διαχείρισης Καταστημάτων': 'shopManagementSystem',
  'Σύστημα διαχείρισης καταστημάτων': 'shopManagementSystem',

  // === AMENITIES ===
  'Κυλικείο Προσωπικού': 'staffCafeteria',
  'Κυλικείο προσωπικού': 'staffCafeteria',
  'Ιατρείο καταστημάτων': 'staffCafeteria',
  'Food Court 800 θέσεων': 'foodCourt800Seats',
  'Σινεμά 8 Αιθουσών': 'cinema8Rooms',
  'Σινεμά 8 αιθουσών': 'cinema8Rooms',
  'Παιδότοπος 300τ.μ.': 'playground300sqm',

  // === STORAGE ===
  'Αποθήκες': 'warehouseClimate',
  'Χώροι Κοινής Ωφέλειας': 'staffCafeteria',
  'Χώροι κοινής ωφέλειας': 'staffCafeteria',
  'Χώρος Κοινής Ωφέλειας': 'staffCafeteria',
  'Χώρος κοινής ωφέλειας': 'staffCafeteria',

  // === ADDITIONAL VARIATIONS (Database typos/OCR errors) ===
  'Κεντρικό άτμιο με φυσικό φωτισμό': 'naturalLightingAtrium',
  'Κεντρικο ατμιο με φυσικο φωτισμο': 'naturalLightingAtrium',
};

// Case-insensitive lookup map (generated from main map)
const FEATURE_GREEK_TO_KEY_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(FEATURE_GREEK_TO_KEY).map(([k, v]) => [k.toLowerCase(), v])
);

// ============================================================================
// TRANSLATION FUNCTION
// ============================================================================

/**
 * Get the i18n key for a Greek building feature string.
 * Uses case-insensitive matching to handle database variations.
 *
 * @param feature - The Greek feature string from the database
 * @returns The i18n key (e.g., 'autonomousHeating') or null if not found
 *
 * @example
 * getBuildingFeatureKey('Σύστημα καθοδήγησης parking') // 'parkingGuidanceSystem'
 * getBuildingFeatureKey('Unknown Feature') // null
 */
export function getBuildingFeatureKey(feature: string): string | null {
  // Try exact match first
  let key = FEATURE_GREEK_TO_KEY[feature];
  // Try case-insensitive match
  if (!key) {
    key = FEATURE_GREEK_TO_KEY_LOWER[feature.toLowerCase()];
  }
  return key || null;
}

/**
 * Translate a building feature using i18n.
 * This is the main function to use in components.
 *
 * @param feature - The Greek feature string from the database
 * @param t - The translation function from useTranslation
 * @param isNamespaceReady - Whether the namespace is loaded (optional, defaults to true)
 * @returns The translated feature label or the original string if not found
 *
 * @example
 * // In a component:
 * const { t, isNamespaceReady } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
 * const label = translateBuildingFeature('Σύστημα καθοδήγησης parking', t, isNamespaceReady);
 * // Returns: "Parking Guidance System" (if locale is en)
 */
export function translateBuildingFeature(
  feature: string,
  t: (key: string, options?: { defaultValue?: string }) => string,
  isNamespaceReady: boolean = true
): string {
  // Fallback to original when namespace not ready
  if (!isNamespaceReady) {
    return feature;
  }

  const key = getBuildingFeatureKey(feature);
  if (key) {
    return t(`storageForm.features.building.${key}`, { defaultValue: feature });
  }

  // Fallback: return original if no mapping found
  return feature;
}
