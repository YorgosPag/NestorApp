import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// ENTERPRISE: Import centralized building features registry (keys only, no labels)
import type { BuildingFeatureKey } from '@/types/building/features';
import {
  getBuildingDescriptions,
  getBuildingTechnicalTerms
} from '@/subapps/dxf-viewer/config/modal-select';

// ENTERPRISE: Use centralized company service (NO local duplicates)
import { getCompanyByName } from '@/services/companies.service';

// ENTERPRISE: Use centralized admin env config (NO local helpers)
import { getRequiredAdminCompanyName } from '@/config/admin-env';

/**
 * ENTERPRISE DATABASE POPULATION: Real Buildings Data
 *
 * API endpoint that adds building records to the database.
 * Company ID is loaded dynamically from database (zero hardcoded values).
 *
 * PROBLEM SOLVED:
 * - All projects showed the same 2 buildings (mockdata)
 * - Need unique buildings for each project
 * - Comprehensive building data based on complete schema research
 *
 * @method POST - Populate buildings
 * @method GET - Verify buildings
 *
 * @requires ADMIN_COMPANY_NAME - Server-only env var (required, no default)
 *
 * @author George Pagonis + Claude Code (Anthropic AI)
 * @date 2025-12-21
 */

// ENTERPRISE: Get centralized building descriptions (features use keys directly)
const buildingDescriptions = getBuildingDescriptions();
const buildingTechnicalTerms = getBuildingTechnicalTerms();

// ENTERPRISE: COMPREHENSIVE BUILDING DATA - Based on Complete Schema Research
const BUILDING_COLLECTIONS = {

  // ===== PROJECT 1: Πολυκατοικία Παλαιολόγου =====
  project_1_palaiologou: [
    {
      id: 'building_1_palaiologou_luxury_apartments',
      name: 'ΚΤΙΡΙΟ Α - Διαμερίσματα Παλαιολόγου',
      description: `${buildingDescriptions.luxury_apartments_main} στην οδό Παλαιολόγου`,
      address: 'Παλαιολόγου 156, Πυλαία',
      city: 'Θεσσαλονίκη',
      totalArea: 2850.75,
      builtArea: 2650.50,
      floors: 6,
      units: 12,
      status: 'active' as const,
      progress: 85,
      startDate: '2021-03-15',
      completionDate: '2024-08-30',
      totalValue: 3200000,
      category: 'residential' as const,
      // ENTERPRISE: Features as BuildingFeatureKey[] (keys, not labels)
      features: [
        'autonomousHeating',
        'solarHeating',
        'parkingSpaces',
        'elevator',
        'balconiesWithView',
        'energyClassAPlus'
      ] satisfies readonly BuildingFeatureKey[]
    },
    {
      id: 'building_2_palaiologou_commercial',
      name: 'ΚΤΙΡΙΟ Β - Καταστήματα Παλαιολόγου',
      description: `${buildingDescriptions.commercial_building_shops} στο ισόγειο`,
      address: 'Παλαιολόγου 158, Πυλαία',
      city: 'Θεσσαλονίκη',
      totalArea: 650.25,
      builtArea: 580.75,
      floors: 2,
      units: 6,
      status: 'completed' as const,
      progress: 100,
      startDate: '2020-09-01',
      completionDate: '2022-12-15',
      totalValue: 850000,
      category: 'commercial' as const,
      features: [
        'shopWindows',
        'vrvClimate',
        'fireSuppression',
        'disabilityAccess',
        'loadingAccess'
      ] satisfies readonly BuildingFeatureKey[]
    },
    {
      id: 'building_3_palaiologou_parking',
      name: 'ΚΤΙΡΙΟ Γ - Υπόγειο Πάρκινγκ Παλαιολόγου',
      description: `${buildingDescriptions.underground_parking} με 45 θέσεις`,
      address: 'Παλαιολόγου 160, Πυλαία',
      city: 'Θεσσαλονίκη',
      totalArea: 1250.00,
      builtArea: 1150.00,
      floors: 2,
      units: 45,
      status: 'construction' as const,
      progress: 65,
      startDate: '2023-04-20',
      completionDate: '2024-11-30',
      totalValue: 450000,
      category: 'commercial' as const,
      features: [
        'electricVehicleCharging',
        'securityCameras247',
        'automaticVentilation',
        'carWash',
        'accessControl'
      ] satisfies readonly BuildingFeatureKey[]
    }
  ],

  // ===== PROJECT 2: Βιομηχανικό Κέντρο Θέρμης =====
  project_2_thermi_industrial: [
    {
      id: 'building_1_thermi_factory_main',
      name: 'ΚΤΙΡΙΟ Α - Κύριο Εργοστάσιο Θέρμης',
      description: buildingDescriptions.main_factory_building,
      address: `${buildingTechnicalTerms.industrial_area_thermi}, Οδός Α5`,
      city: 'Θέρμη',
      totalArea: 4200.50,
      builtArea: 3950.25,
      floors: 3,
      units: 15,
      status: 'construction' as const,
      progress: 72,
      startDate: '2022-01-10',
      completionDate: '2025-03-31',
      totalValue: 5500000,
      category: 'industrial' as const,
      features: [
        'craneBridge20Tons',
        'powerSupply1000kw',
        'dustRemovalSystems',
        'naturalVentilation',
        'gasFireSuppression',
        'automationSystems'
      ] satisfies readonly BuildingFeatureKey[]
    },
    {
      id: 'building_2_thermi_warehouse',
      name: 'ΚΤΙΡΙΟ Β - Αποθήκη Θέρμης',
      description: buildingDescriptions.warehouse_building,
      address: `${buildingTechnicalTerms.industrial_area_thermi}, Οδός Β12`,
      city: 'Θέρμη',
      totalArea: 2800.75,
      builtArea: 2650.25,
      floors: 2,
      units: 8,
      status: 'planned' as const,
      progress: 15,
      startDate: '2024-06-01',
      completionDate: '2025-12-15',
      totalValue: 1800000,
      category: 'industrial' as const,
      features: [
        'highShelving12m',
        'monitoringSystems',
        'warehouseClimate',
        'loadingRamps',
        'rfidTracking'
      ] satisfies readonly BuildingFeatureKey[]
    },
    {
      id: 'building_3_thermi_offices',
      name: 'ΚΤΙΡΙΟ Γ - Διοίκηση Θέρμης',
      description: buildingDescriptions.administration_building,
      address: `${buildingTechnicalTerms.industrial_area_thermi}, Οδός Γ8`,
      city: 'Θέρμη',
      totalArea: 850.25,
      builtArea: 780.50,
      floors: 3,
      units: 18,
      status: 'active' as const,
      progress: 95,
      startDate: '2021-11-15',
      completionDate: '2023-07-20',
      totalValue: 1200000,
      category: 'commercial' as const,
      features: [
        'videoConferencingAllRooms',
        'smartClimate',
        'securitySystems',
        'highQualityAcoustics',
        'staffCafeteria'
      ] satisfies readonly BuildingFeatureKey[]
    }
  ],

  // ===== PROJECT 3: Εμπορικό Κέντρο Καλαμαριάς =====
  project_3_kalamaria_mall: [
    {
      id: 'building_1_kalamaria_mall_main',
      name: 'ΚΤΙΡΙΟ Α - Κύριο Εμπορικό Καλαμαριάς',
      description: `${buildingDescriptions.commercial_building_main} με καταστήματα και εστίαση`,
      address: `${buildingTechnicalTerms.avenue_megalou_alexandrou} 250, Καλαμαριά`,
      city: 'Καλαμαριά',
      totalArea: 5200.50,
      builtArea: 4850.25,
      floors: 4,
      units: 85,
      status: 'construction' as const,
      progress: 40,
      startDate: '2023-09-15',
      completionDate: '2026-06-30',
      totalValue: 12500000,
      category: 'commercial' as const,
      features: [
        'naturalLightingAtrium',
        'escalatorsAllFloors',
        'shopManagementSystem',
        'foodCourt800Seats',
        'cinema8Rooms',
        'playground300sqm'
      ] satisfies readonly BuildingFeatureKey[]
    },
    {
      id: 'building_2_kalamaria_parking_tower',
      name: 'ΚΤΙΡΙΟ Β - Πύργος Στάθμευσης Καλαμαριάς',
      description: `${buildingDescriptions.parking_tower} 6 ορόφων για 350 οχήματα`,
      address: `${buildingTechnicalTerms.avenue_megalou_alexandrou} 252, Καλαμαριά`,
      city: 'Καλαμαριά',
      totalArea: 3200.75,
      builtArea: 2950.50,
      floors: 6,
      units: 350,
      status: 'planned' as const,
      progress: 5,
      startDate: '2024-12-01',
      completionDate: '2025-10-15',
      totalValue: 2800000,
      category: 'commercial' as const,
      features: [
        'parkingGuidanceSystem',
        'teslaVwCharging',
        'carWashPlural',
        'mechanicalSecurity',
        'emergencyExits'
      ] satisfies readonly BuildingFeatureKey[]
    }
  ]
};

/**
 * MAIN POPULATION FUNCTION
 * POST endpoint that creates all building records in Firestore
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[POPULATE] Starting database population...');

  // ENTERPRISE: Get required company name (fail-fast if not configured)
  let companyName: string;
  try {
    companyName = getRequiredAdminCompanyName();
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      suggestion: 'Add ADMIN_COMPANY_NAME to .env.local'
    }, { status: 500 });
  }

  // ENTERPRISE: Database-driven company lookup (centralized service)
  const company = await getCompanyByName(companyName);
  if (!company) {
    return NextResponse.json({
      success: false,
      error: `Company "${companyName}" not found in database`,
      suggestion: 'Please ensure company data exists before populating buildings'
    }, { status: 404 });
  }

  console.log(`[POPULATE] Company: ${company.companyName}`);
  console.log(`[POPULATE] Company ID: ${company.id}`);

  let totalBuildings = 0;
  const results = {
    success: [] as Array<{ id: string; originalId: string; name: string; project: string }>,
    errors: [] as Array<{ id: string; error: string }>,
    summary: {} as Record<string, unknown>
  };

  try {
    // Add buildings for each project
    for (const [projectKey, buildings] of Object.entries(BUILDING_COLLECTIONS)) {
      console.log(`\n[POPULATE] Processing project: ${projectKey}`);

      for (const building of buildings) {
        try {
          // Add full data based on schema research
          const buildingData = {
            ...building,
            projectId: projectKey,  // Critical: Link to specific project
            companyId: company.id,  // ENTERPRISE: Database-driven
            company: company.companyName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

            // ENTERPRISE: Additional schema fields from research
            legalInfo: {
              buildingPermit: `BP-${building.id.slice(-8).toUpperCase()}`,
              zoneDesignation: building.category === 'industrial' ? buildingTechnicalTerms.industrial_zone : building.category === 'commercial' ? buildingTechnicalTerms.commercial_zone : buildingTechnicalTerms.residential_zone,
              coverage: Math.round((building.builtArea / building.totalArea) * 100),
              constructionType: buildingTechnicalTerms.reinforced_concrete
            },

            technicalSpecs: {
              heatingSystem: building.category === 'industrial' ? 'Βιομηχανικό' : 'Αυτόνομο',
              elevators: building.floors > 2 ? Math.ceil(building.floors / 3) : 0,
              energyClass: building.status === 'completed' ? buildingTechnicalTerms.energy_class_a_plus_label : buildingTechnicalTerms.energy_class_a_label,
              seismicZone: buildingTechnicalTerms.seismic_zone_2,
              fireProtection: true
            },

            financialData: {
              currentValue: building.totalValue,
              constructionCost: Math.round(building.totalValue * 0.75),
              landValue: Math.round(building.totalValue * 0.25),
              insurance: Math.round(building.totalValue * 0.005),
              taxes: Math.round(building.totalValue * 0.015)
            }
          };

          // Save to Firestore with custom ID
          const docRef = await addDoc(collection(db, COLLECTIONS.BUILDINGS), buildingData);

          results.success.push({
            id: docRef.id,
            originalId: building.id,
            name: building.name,
            project: projectKey
          });

          totalBuildings++;
          console.log(`  [OK] ${building.name} - ${docRef.id}`);

        } catch (error) {
          console.error(`  [ERROR] Error creating building ${building.id}:`, (error as Error).message);
          results.errors.push({
            id: building.id,
            error: (error as Error).message
          });
        }
      }
    }

    // Final Summary
    results.summary = {
      totalBuildings,
      successCount: results.success.length,
      errorCount: results.errors.length,
      projectsProcessed: Object.keys(BUILDING_COLLECTIONS).length,
      timestamp: new Date().toISOString()
    };

    console.log('\n[POPULATE] Database population completed!');
    console.log(`[POPULATE] Buildings Created: ${results.summary.successCount}/${totalBuildings}`);
    console.log(`[POPULATE] Projects Processed: ${results.summary.projectsProcessed}`);

    return NextResponse.json({
      success: true,
      message: `Successfully created ${results.summary.successCount} buildings for ${company.companyName}`,
      results,
      company: company.companyName,
      companyId: company.id
    });

  } catch (error) {
    console.error('[POPULATE] CRITICAL ERROR during database population:', error);

    return NextResponse.json({
      success: false,
      error: 'Database population failed',
      details: (error as Error).message,
      company: company.companyName,
      companyId: company.id
    }, { status: 500 });
  }
}

// Type for building summary in verification response
interface BuildingSummary {
  id: string;
  name: string;
  status: string;
  address: string;
  totalValue: number;
  createdAt: unknown;
}

/**
 * VERIFICATION ENDPOINT
 * GET endpoint that verifies the created buildings
 */
export async function GET(): Promise<NextResponse> {
  console.log('\n[VERIFY] Verifying buildings creation...');

  // ENTERPRISE: Get required company name (fail-fast if not configured)
  let companyName: string;
  try {
    companyName = getRequiredAdminCompanyName();
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      suggestion: 'Add ADMIN_COMPANY_NAME to .env.local'
    }, { status: 500 });
  }

  // ENTERPRISE: Database-driven company lookup (centralized service)
  const company = await getCompanyByName(companyName);
  if (!company) {
    return NextResponse.json({
      success: false,
      error: `Company "${companyName}" not found in database`,
      suggestion: 'Please ensure company data exists'
    }, { status: 404 });
  }

  try {
    // Check buildings for the company
    const buildingsQuery = query(
      collection(db, COLLECTIONS.BUILDINGS),
      where('companyId', '==', company.id)
    );
    const buildingsSnapshot = await getDocs(buildingsQuery);

    console.log(`[VERIFY] Found ${buildingsSnapshot.docs.length} buildings for ${company.companyName}`);

    // Group by project
    const projectGroups: Record<string, BuildingSummary[]> = {};
    buildingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const projectId = data.projectId as string;

      if (!projectGroups[projectId]) {
        projectGroups[projectId] = [];
      }
      projectGroups[projectId].push({
        id: doc.id,
        name: data.name as string,
        status: data.status as string,
        address: data.address as string,
        totalValue: data.totalValue as number,
        createdAt: data.createdAt
      });
    });

    // Display results
    for (const [projectId, buildings] of Object.entries(projectGroups)) {
      console.log(`\n[VERIFY] Project: ${projectId}`);
      buildings.forEach(building => {
        console.log(`  - ${building.name} (${building.status}) - ID: ${building.id}`);
      });
    }

    return NextResponse.json({
      success: true,
      totalBuildings: buildingsSnapshot.docs.length,
      projectGroups,
      company: company.companyName,
      companyId: company.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Verification failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Buildings verification failed',
      details: (error as Error).message,
      company: company.companyName,
      companyId: company.id
    }, { status: 500 });
  }
}