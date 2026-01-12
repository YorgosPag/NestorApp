import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isBuildingFeatureKey, type BuildingFeatureKey } from '@/types/building/features';

/**
 * ============================================================================
 * REMOVE AFTER MIGRATION - ONE-TIME SERVER-ONLY MIGRATION SCRIPT
 * ============================================================================
 *
 * @purpose Migrate legacy Greek building feature strings to BuildingFeatureKey
 * @author Enterprise Architecture Team
 * @date 2026-01-12
 *
 * This script converts legacy Greek labels stored in Firestore to type-safe
 * BuildingFeatureKey values. The mapping below is ONLY for server-side migration
 * and MUST NOT be imported in UI/runtime components.
 *
 * @method GET - Dry run / Preview (shows what would be migrated)
 * @method POST - Execute migration (updates Firestore documents)
 *
 * IMPORTANT: Delete this file after successful migration!
 * ============================================================================
 */

// ============================================================================
// LEGACY MAPPING - REMOVE AFTER MIGRATION - DO NOT IMPORT IN UI
// ============================================================================

/**
 * Maps legacy Greek labels to BuildingFeatureKey.
 *
 * @serverOnly This mapping is ONLY for migration purposes.
 * @deprecated Delete after migration is complete.
 */
const LEGACY_GREEK_TO_KEY: Record<string, BuildingFeatureKey> = {
  // Heating & Climate
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

  // Ventilation
  'Αυτόματος Εξαερισμός': 'automaticVentilation',
  'Αυτόματος εξαερισμός': 'automaticVentilation',
  'Φυσικός Αερισμός': 'naturalVentilation',
  'Φυσικός αερισμός': 'naturalVentilation',

  // Parking & Transport
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

  // Elevators & Access
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

  // Security
  'Κάμερες Ασφαλείας 24/7': 'securityCameras247',
  'Κάμερες ασφαλείας 24/7': 'securityCameras247',
  'Συστήματα Ασφαλείας': 'securitySystems',
  'Συστήματα ασφαλείας': 'securitySystems',
  'Μηχανική Ασφάλεια': 'mechanicalSecurity',
  'Μηχανική ασφάλεια': 'mechanicalSecurity',
  'Έξοδοι Κινδύνου': 'emergencyExits',
  'Έξοδοι κινδύνου': 'emergencyExits',

  // Fire Safety
  'Πυρόσβεση': 'fireSuppression',
  'Σύστημα πυρόσβεσης': 'fireSuppression',
  'Πυρόσβεση Αερίου': 'gasFireSuppression',
  'Πυρόσβεση αερίου': 'gasFireSuppression',

  // Energy & Power
  'Ενεργειακή Κλάση Α+': 'energyClassAPlus',
  'Ενεργειακή κλάση Α+': 'energyClassAPlus',
  'Παροχή Ρεύματος 1000kW': 'powerSupply1000kw',
  'Παροχή ρεύματος 1000kW': 'powerSupply1000kw',

  // Architecture & Design
  'Μπαλκόνια με Θέα': 'balconiesWithView',
  'Μπαλκόνια με θέα': 'balconiesWithView',
  'Βιτρίνες Καταστημάτων': 'shopWindows',
  'Βιτρίνες καταστημάτων': 'shopWindows',
  'Φυσικός Φωτισμός Atrium': 'naturalLightingAtrium',
  'Φυσικός φωτισμός atrium': 'naturalLightingAtrium',
  'Υψηλή Ακουστική': 'highQualityAcoustics',
  'Υψηλή ακουστική': 'highQualityAcoustics',

  // Industrial & Warehouse
  'Γερανογέφυρα 20 Τόνων': 'craneBridge20Tons',
  'Γερανογέφυρα 20 τόνων': 'craneBridge20Tons',
  'Συστήματα Αποκονίωσης': 'dustRemovalSystems',
  'Συστήματα αποκονίωσης': 'dustRemovalSystems',
  'Ράφια Ύψους 12μ': 'highShelving12m',
  'Ράφια ύψους 12μ': 'highShelving12m',
  'RFID Παρακολούθηση': 'rfidTracking',
  'RFID παρακολούθηση': 'rfidTracking',

  // Automation & Technology
  'Συστήματα Αυτοματισμού': 'automationSystems',
  'Συστήματα αυτοματισμού': 'automationSystems',
  'Συστήματα Παρακολούθησης': 'monitoringSystems',
  'Συστήματα παρακολούθησης': 'monitoringSystems',
  'Video Conferencing σε Όλες τις Αίθουσες': 'videoConferencingAllRooms',
  'Video conferencing σε όλες τις αίθουσες': 'videoConferencingAllRooms',
  'Σύστημα Διαχείρισης Καταστημάτων': 'shopManagementSystem',
  'Σύστημα διαχείρισης καταστημάτων': 'shopManagementSystem',

  // Amenities
  'Καφετέρια Προσωπικού': 'staffCafeteria',
  'Καφετέρια προσωπικού': 'staffCafeteria',
  'Food Court 800 Θέσεων': 'foodCourt800Seats',
  'Food court 800 θέσεων': 'foodCourt800Seats',
  'Κινηματογράφος 8 Αιθουσών': 'cinema8Rooms',
  'Κινηματογράφος 8 αιθουσών': 'cinema8Rooms',
  'Παιδότοπος 300τμ': 'playground300sqm',
  'Παιδότοπος 300 τμ': 'playground300sqm',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface BuildingDoc {
  id: string;
  name: string;
  features?: string[];
}

interface MigrationPreview {
  id: string;
  name: string;
  currentFeatures: string[];
  migratedFeatures: BuildingFeatureKey[];
  unmappedFeatures: string[];
  alreadyMigrated: string[];
  needsMigration: boolean;
}

/**
 * Migrate a single feature string to BuildingFeatureKey.
 * Returns the key if valid, or null if unmapped.
 */
function migrateFeature(feature: string): { key: BuildingFeatureKey | null; status: 'migrated' | 'already_key' | 'unmapped' } {
  // Already a valid key? Return as-is
  if (isBuildingFeatureKey(feature)) {
    return { key: feature, status: 'already_key' };
  }

  // Try legacy mapping
  const mappedKey = LEGACY_GREEK_TO_KEY[feature];
  if (mappedKey) {
    return { key: mappedKey, status: 'migrated' };
  }

  // Try trimmed version
  const trimmed = feature.trim();
  if (LEGACY_GREEK_TO_KEY[trimmed]) {
    return { key: LEGACY_GREEK_TO_KEY[trimmed], status: 'migrated' };
  }

  // Unmapped
  return { key: null, status: 'unmapped' };
}

/**
 * Analyze a building's features for migration.
 */
function analyzeBuilding(building: BuildingDoc): MigrationPreview {
  const currentFeatures = building.features || [];
  const migratedFeatures: BuildingFeatureKey[] = [];
  const unmappedFeatures: string[] = [];
  const alreadyMigrated: string[] = [];

  for (const feature of currentFeatures) {
    const result = migrateFeature(feature);

    if (result.status === 'already_key' && result.key) {
      alreadyMigrated.push(result.key);
      migratedFeatures.push(result.key);
    } else if (result.status === 'migrated' && result.key) {
      migratedFeatures.push(result.key);
    } else {
      unmappedFeatures.push(feature);
    }
  }

  // Deduplicate
  const uniqueMigrated = [...new Set(migratedFeatures)];

  return {
    id: building.id,
    name: building.name,
    currentFeatures,
    migratedFeatures: uniqueMigrated,
    unmappedFeatures,
    alreadyMigrated,
    needsMigration: uniqueMigrated.length !== currentFeatures.length || unmappedFeatures.length > 0 || alreadyMigrated.length !== currentFeatures.length,
  };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET - Dry run / Preview mode
 * Shows what would be migrated without making changes.
 */
export async function GET() {
  try {
    console.log('[MIGRATE] Analyzing buildings for feature migration...');

    const buildingsQuery = query(collection(db, COLLECTIONS.BUILDINGS));
    const snapshot = await getDocs(buildingsQuery);

    const buildings: BuildingDoc[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      buildings.push({
        id: docSnap.id,
        name: data.name || 'UNNAMED',
        features: data.features || [],
      });
    });

    const previews = buildings.map(analyzeBuilding);
    const needsMigration = previews.filter(p => p.needsMigration);
    const alreadyCorrect = previews.filter(p => !p.needsMigration);

    // Collect all unmapped features
    const allUnmapped = new Set<string>();
    previews.forEach(p => p.unmappedFeatures.forEach(f => allUnmapped.add(f)));

    return NextResponse.json({
      success: true,
      mode: 'preview',
      summary: {
        totalBuildings: buildings.length,
        needsMigration: needsMigration.length,
        alreadyCorrect: alreadyCorrect.length,
        totalUnmappedFeatures: allUnmapped.size,
      },
      unmappedFeatures: Array.from(allUnmapped),
      buildingPreviews: previews,
      message: `Found ${needsMigration.length} buildings that need migration. Use POST to execute.`,
      warning: allUnmapped.size > 0
        ? `WARNING: ${allUnmapped.size} features could not be mapped. Add them to LEGACY_GREEK_TO_KEY before migration.`
        : undefined,
    });
  } catch (error) {
    console.error('[MIGRATE] Error analyzing buildings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze buildings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Execute migration
 * Converts legacy Greek labels to BuildingFeatureKey in Firestore.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[MIGRATE] Starting building features migration...');

    // Check for force flag (migrates even with unmapped features)
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const buildingsQuery = query(collection(db, COLLECTIONS.BUILDINGS));
    const snapshot = await getDocs(buildingsQuery);

    const buildings: BuildingDoc[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      buildings.push({
        id: docSnap.id,
        name: data.name || 'UNNAMED',
        features: data.features || [],
      });
    });

    const previews = buildings.map(analyzeBuilding);

    // Collect all unmapped features
    const allUnmapped = new Set<string>();
    previews.forEach(p => p.unmappedFeatures.forEach(f => allUnmapped.add(f)));

    // Safety check: Don't migrate if there are unmapped features (unless force=true)
    if (allUnmapped.size > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          error: 'Migration blocked: unmapped features found',
          unmappedFeatures: Array.from(allUnmapped),
          message: 'Add missing features to LEGACY_GREEK_TO_KEY mapping, or use POST?force=true to migrate anyway (unmapped features will be dropped).',
        },
        { status: 400 }
      );
    }

    // Execute migration
    const results: Array<{ id: string; name: string; status: 'updated' | 'skipped' | 'error'; oldFeatures?: string[]; newFeatures?: BuildingFeatureKey[]; error?: string }> = [];

    for (const preview of previews) {
      if (!preview.needsMigration) {
        results.push({
          id: preview.id,
          name: preview.name,
          status: 'skipped',
        });
        continue;
      }

      try {
        await updateDoc(doc(db, COLLECTIONS.BUILDINGS, preview.id), {
          features: preview.migratedFeatures,
          updatedAt: new Date().toISOString(),
          _featuresMigratedAt: new Date().toISOString(),
        });

        results.push({
          id: preview.id,
          name: preview.name,
          status: 'updated',
          oldFeatures: preview.currentFeatures,
          newFeatures: preview.migratedFeatures,
        });

        console.log(`[MIGRATE] Migrated: ${preview.id} (${preview.name}) - ${preview.migratedFeatures.length} features`);
      } catch (err) {
        console.error(`[MIGRATE] Failed to migrate ${preview.id}:`, err);
        results.push({
          id: preview.id,
          name: preview.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: errors === 0,
      message: `Migration complete! Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      summary: {
        total: results.length,
        updated,
        skipped,
        errors,
        droppedUnmapped: allUnmapped.size,
      },
      results,
      warning: allUnmapped.size > 0
        ? `WARNING: ${allUnmapped.size} unmapped features were dropped: ${Array.from(allUnmapped).join(', ')}`
        : undefined,
    });
  } catch (error) {
    console.error('[MIGRATE] Error during migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to migrate building features',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
