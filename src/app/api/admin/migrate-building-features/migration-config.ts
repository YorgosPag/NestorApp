import type { BuildingFeatureKey } from '@/types/building/features';

export interface BuildingDoc {
  id: string;
  name: string;
  features?: string[];
}

export interface MigrationPreview {
  id: string;
  name: string;
  currentFeatures: string[];
  migratedFeatures: BuildingFeatureKey[];
  unmappedFeatures: string[];
  alreadyMigrated: string[];
  needsMigration: boolean;
}

export interface MigrationResultEntry {
  id: string;
  name: string;
  status: 'updated' | 'skipped' | 'error';
  oldFeatures?: string[];
  newFeatures?: BuildingFeatureKey[];
  error?: string;
}

export const MIGRATION_OPERATION_NAME = 'migrate-building-features';
export const MIGRATION_AUDIT_KEY = 'migrate_building_features_greek_to_keys';
export const SUPER_ADMIN_REQUIRED_ERROR = 'Forbidden: This operation requires super_admin role';
export const SUPER_ADMIN_REQUIRED_CODE = 'SUPER_ADMIN_REQUIRED';
export const FALLBACK_BUILDING_NAME = 'UNNAMED';
export const MIGRATION_TIMESTAMP_FIELD = '_featuresMigratedAt';

export const LEGACY_GREEK_TO_KEY: Record<string, BuildingFeatureKey> = {
  'Θέρμανση Αυτονομίας': 'autonomousHeating',
  'Αυτόνομη θέρμανση': 'autonomousHeating',
  'Ηλιακή Θέρμανση': 'solarHeating',
  'Ηλιακή θέρμανση': 'solarHeating',
  'VRV Κλιματισμός': 'vrvClimate',
  'VRV κλιματισμός': 'vrvClimate',
  'Έξυπνος Κλιματισμός': 'smartClimate',
  'Έξυπνος κλιματισμός': 'smartClimate',
  'Κλιματισμός Αποθηκών': 'warehouseClimate',
  'Κλιματισμός αποθηκών': 'warehouseClimate',
  'Αυτόματος Εξαερισμός': 'automaticVentilation',
  'Αυτόματος εξαερισμός': 'automaticVentilation',
  'Φυσικός Αερισμός': 'naturalVentilation',
  'Φυσικός αερισμός': 'naturalVentilation',
  'Θέσεις Στάθμευσης': 'parkingSpaces',
  'Θέσεις στάθμευσης': 'parkingSpaces',
  'Χώροι στάθμευσης': 'parkingSpaces',
  'Φόρτιση Ηλεκτρικών Οχημάτων': 'electricVehicleCharging',
  'Φόρτιση ηλεκτρικών οχημάτων': 'electricVehicleCharging',
  'Σταθμοί φόρτισης Tesla/VW': 'teslaVwCharging',
  'Tesla/VW Φόρτιση': 'teslaVwCharging',
  'Σύστημα Καθοδήγησης Στάθμευσης': 'parkingGuidanceSystem',
  'Σύστημα καθοδήγησης στάθμευσης': 'parkingGuidanceSystem',
  'Πλυντήριο αυτοκινήτων': 'carWash',
  'Πλυντήρια αυτοκινήτων': 'carWashPlural',
  'Ασανσέρ': 'elevator',
  'Ανελκυστήρας': 'elevator',
  'Κυλιόμενες Σκάλες σε Όλους τους Ορόφους': 'escalatorsAllFloors',
  'Κυλιόμενες σκάλες': 'escalatorsAllFloors',
  'Πρόσβαση ΑμεΑ': 'disabilityAccess',
  'Πρόσβαση ΑΜΕΑ': 'disabilityAccess',
  'Πρόσβαση Φόρτωσης': 'loadingAccess',
  'Πρόσβαση φόρτωσης': 'loadingAccess',
  'Ράμπες Φόρτωσης': 'loadingRamps',
  'Ράμπες φόρτωσης': 'loadingRamps',
  'Έλεγχος Πρόσβασης': 'accessControl',
  'Έλεγχος πρόσβασης': 'accessControl',
  'Κάμερες Ασφαλείας 24/7': 'securityCameras247',
  'Κάμερες ασφαλείας 24/7': 'securityCameras247',
  'Συστήματα Ασφαλείας': 'securitySystems',
  'Συστήματα ασφαλείας': 'securitySystems',
  'Μηχανική Ασφάλεια': 'mechanicalSecurity',
  'Μηχανική ασφάλεια': 'mechanicalSecurity',
  'Έξοδοι Κινδύνου': 'emergencyExits',
  'Έξοδοι κινδύνου': 'emergencyExits',
  'Πυρόσβεση': 'fireSuppression',
  'Σύστημα πυρόσβεσης': 'fireSuppression',
  'Πυρόσβεση Αερίου': 'gasFireSuppression',
  'Πυρόσβεση αερίου': 'gasFireSuppression',
  'Ενεργειακή Κλάση Α+': 'energyClassAPlus',
  'Ενεργειακή κλάση Α+': 'energyClassAPlus',
  'Παροχή Ρεύματος 1000kW': 'powerSupply1000kw',
  'Παροχή ρεύματος 1000kW': 'powerSupply1000kw',
  'Μπαλκόνια με Θέα': 'balconiesWithView',
  'Μπαλκόνια με θέα': 'balconiesWithView',
  'Βιτρίνες Καταστημάτων': 'shopWindows',
  'Βιτρίνες καταστημάτων': 'shopWindows',
  'Φυσικός Φωτισμός Atrium': 'naturalLightingAtrium',
  'Φυσικός φωτισμός atrium': 'naturalLightingAtrium',
  'Υψηλή Ακουστική': 'highQualityAcoustics',
  'Υψηλή ακουστική': 'highQualityAcoustics',
  'Γερανογέφυρα 20 Τόνων': 'craneBridge20Tons',
  'Γερανογέφυρα 20 τόνων': 'craneBridge20Tons',
  'Συστήματα Αποκονίωσης': 'dustRemovalSystems',
  'Συστήματα αποκονίωσης': 'dustRemovalSystems',
  'Ράφια Ύψους 12μ': 'highShelving12m',
  'Ράφια ύψους 12μ': 'highShelving12m',
  'RFID Παρακολούθηση': 'rfidTracking',
  'RFID παρακολούθηση': 'rfidTracking',
  'Συστήματα Αυτοματισμού': 'automationSystems',
  'Συστήματα αυτοματισμού': 'automationSystems',
  'Συστήματα Παρακολούθησης': 'monitoringSystems',
  'Συστήματα παρακολούθησης': 'monitoringSystems',
  'Video Conferencing σε Όλες τις Αίθουσες': 'videoConferencingAllRooms',
  'Video conferencing σε όλες τις αίθουσες': 'videoConferencingAllRooms',
  'Σύστημα Διαχείρισης Καταστημάτων': 'shopManagementSystem',
  'Σύστημα διαχείρισης καταστημάτων': 'shopManagementSystem',
  'Καφετέρια Προσωπικού': 'staffCafeteria',
  'Καφετέρια προσωπικού': 'staffCafeteria',
  'Food Court 800 Θέσεων': 'foodCourt800Seats',
  'Food court 800 θέσεων': 'foodCourt800Seats',
  'Κινηματογράφος 8 Αιθουσών': 'cinema8Rooms',
  'Κινηματογράφος 8 αιθουσών': 'cinema8Rooms',
  'Παιδότοπος 300τμ': 'playground300sqm',
  'Παιδότοπος 300 τμ': 'playground300sqm',
};
