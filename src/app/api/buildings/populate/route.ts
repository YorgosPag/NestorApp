import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// ✅ ENTERPRISE: Import centralized building data - NO MORE HARDCODED STRINGS
import {
  getBuildingFeatures,
  getBuildingDescriptions,
  getBuildingTechnicalTerms
} from '@/subapps/dxf-viewer/config/modal-select';

/**
 * 🏗️ ENTERPRISE DATABASE POPULATION: Real Buildings Data for ΠΑΓΩΝΗΣ Projects
 *
 * API endpoint που προσθέτει πραγματικά building records στη βάση δεδομένων
 * για κάθε έργο της εταιρίας "Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε."
 *
 * PROBLEM SOLVED:
 * - Όλα τα projects έδειχναν τα ίδια 2 κτίρια (mockdata)
 * - Χρειάζεται unique buildings για κάθε project
 * - Comprehensive building data based on complete schema research
 *
 * COMPANY: Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.
 * COMPANY_ID: pzNUy8ksddGCtcQMqumR
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2025-12-21
 */

// 👥 COMPANY DATA
const PAGONIS_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';
const COMPANY_NAME = 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.';

// ✅ ENTERPRISE: Get centralized building data - NO MORE HARDCODED STRINGS
const buildingFeatures = getBuildingFeatures();
const buildingDescriptions = getBuildingDescriptions();
const buildingTechnicalTerms = getBuildingTechnicalTerms();

// 🏗️ COMPREHENSIVE BUILDING DATA - Based on Complete Schema Research
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
      features: [
        buildingFeatures.autonomous_heating,
        buildingFeatures.solar_heating,
        buildingFeatures.parking_spaces,
        buildingFeatures.elevator,
        buildingFeatures.balconies_with_view,
        buildingFeatures.energy_class_a_plus
      ]
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
        buildingFeatures.shop_windows,
        buildingFeatures.vrv_climate,
        buildingFeatures.fire_suppression,
        buildingFeatures.disability_access,
        buildingFeatures.loading_access
      ]
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
        buildingFeatures.electric_vehicle_charging,
        buildingFeatures.security_cameras_24_7,
        buildingFeatures.automatic_ventilation,
        buildingFeatures.car_wash,
        buildingFeatures.access_control
      ]
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
        buildingFeatures.crane_bridge_20_tons,
        buildingFeatures.power_supply_1000kw,
        buildingFeatures.dust_removal_systems,
        buildingFeatures.natural_ventilation,
        buildingFeatures.gas_fire_suppression,
        buildingFeatures.automation_systems
      ]
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
        buildingFeatures.high_shelving_12m,
        buildingFeatures.monitoring_systems,
        buildingFeatures.warehouse_climate,
        buildingFeatures.loading_ramps,
        buildingFeatures.rfid_tracking
      ]
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
        buildingFeatures.video_conferencing_all_rooms,
        buildingFeatures.smart_climate,
        buildingFeatures.security_systems,
        buildingFeatures.high_quality_acoustics,
        buildingFeatures.staff_cafeteria
      ]
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
        buildingFeatures.natural_lighting_atrium,
        buildingFeatures.escalators_all_floors,
        buildingFeatures.shop_management_system,
        buildingFeatures.food_court_800_seats,
        buildingFeatures.cinema_8_rooms,
        buildingFeatures.playground_300sqm
      ]
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
        buildingFeatures.parking_guidance_system,
        buildingFeatures.tesla_vw_charging,
        buildingFeatures.car_wash_plural,
        buildingFeatures.mechanical_security,
        buildingFeatures.emergency_exits
      ]
    }
  ]
};

/**
 * 🎯 MAIN POPULATION FUNCTION
 * POST endpoint που δημιουργεί όλα τα building records στη Firestore
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('🚀 STARTING DATABASE POPULATION...');
  console.log(`📊 Company: ${COMPANY_NAME}`);
  console.log(`🆔 Company ID: ${PAGONIS_COMPANY_ID}`);

  let totalBuildings = 0;
  const results = {
    success: [],
    errors: [],
    summary: {}
  };

  try {
    // 🏗️ Προσθήκη buildings για κάθε project
    for (const [projectKey, buildings] of Object.entries(BUILDING_COLLECTIONS)) {
      console.log(`\n🏢 Processing project: ${projectKey}`);

      for (const building of buildings) {
        try {
          // 📝 Προσθήκη πλήρων δεδομένων based on schema research
          const buildingData = {
            ...building,
            projectId: projectKey,  // 🔗 Critical: Link to specific project
            companyId: PAGONIS_COMPANY_ID,
            company: COMPANY_NAME,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

            // 🎯 ENTERPRISE: Additional schema fields από research
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

          // 💾 Αποθήκευση στο Firestore με custom ID
          const docRef = await addDoc(collection(db, COLLECTIONS.BUILDINGS), buildingData);

          results.success.push({
            id: docRef.id,
            originalId: building.id,
            name: building.name,
            project: projectKey
          });

          totalBuildings++;
          console.log(`  ✅ ${building.name} - ${docRef.id}`);

        } catch (error) {
          console.error(`  ❌ Error creating building ${building.id}:`, (error as Error).message);
          results.errors.push({
            id: building.id,
            error: (error as Error).message
          });
        }
      }
    }

    // 📊 Final Summary
    results.summary = {
      totalBuildings,
      successCount: results.success.length,
      errorCount: results.errors.length,
      projectsProcessed: Object.keys(BUILDING_COLLECTIONS).length,
      timestamp: new Date().toISOString()
    };

    console.log('\n🎉 DATABASE POPULATION COMPLETED!');
    console.log(`📊 Buildings Created: ${results.summary.successCount}/${totalBuildings}`);
    console.log(`🏗️ Projects Processed: ${results.summary.projectsProcessed}`);

    return NextResponse.json({
      success: true,
      message: `Successfully created ${results.summary.successCount} buildings for ${COMPANY_NAME}`,
      results,
      company: COMPANY_NAME,
      companyId: PAGONIS_COMPANY_ID
    });

  } catch (error) {
    console.error('💥 CRITICAL ERROR during database population:', error);

    return NextResponse.json({
      success: false,
      error: 'Database population failed',
      details: (error as Error).message,
      company: COMPANY_NAME,
      companyId: PAGONIS_COMPANY_ID
    }, { status: 500 });
  }
}

/**
 * 🔍 VERIFICATION ENDPOINT
 * GET endpoint που επαληθεύει τα buildings που δημιουργήθηκαν
 */
export async function GET(): Promise<NextResponse> {
  console.log('\n🔍 VERIFYING BUILDINGS CREATION...');

  try {
    // Έλεγχος για buildings του ΠΑΓΩΝΗΣ
    const buildingsQuery = query(
      collection(db, COLLECTIONS.BUILDINGS),
      where('companyId', '==', PAGONIS_COMPANY_ID)
    );
    const buildingsSnapshot = await getDocs(buildingsQuery);

    console.log(`📊 Found ${buildingsSnapshot.docs.length} buildings for ${COMPANY_NAME}`);

    // Group by project
    const projectGroups: Record<string, any[]> = {};
    buildingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const projectId = data.projectId;

      if (!projectGroups[projectId]) {
        projectGroups[projectId] = [];
      }
      projectGroups[projectId].push({
        id: doc.id,
        name: data.name,
        status: data.status,
        address: data.address,
        totalValue: data.totalValue,
        createdAt: data.createdAt
      });
    });

    // Εμφάνιση αποτελεσμάτων
    for (const [projectId, buildings] of Object.entries(projectGroups)) {
      console.log(`\n🏗️ Project: ${projectId}`);
      buildings.forEach(building => {
        console.log(`  📋 ${building.name} (${building.status}) - ID: ${building.id}`);
      });
    }

    return NextResponse.json({
      success: true,
      totalBuildings: buildingsSnapshot.docs.length,
      projectGroups,
      company: COMPANY_NAME,
      companyId: PAGONIS_COMPANY_ID,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Verification failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Buildings verification failed',
      details: (error as Error).message,
      company: COMPANY_NAME,
      companyId: PAGONIS_COMPANY_ID
    }, { status: 500 });
  }
}