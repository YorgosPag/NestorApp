import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// ENTERPRISE: Import centralized building features registry with runtime validation
import type { BuildingFeatureKey } from '@/types/building/features';

// ENTERPRISE: Use centralized company service (NO local duplicates)
import { getCompanyByName } from '@/services/companies.service';

// ENTERPRISE: Use centralized admin env config (NO local helpers)
import { getRequiredAdminCompanyName, getOptionalAdminProjectName } from '@/config/admin-env';

/**
 * ENTERPRISE SEED ROUTE: Sample Buildings Data
 *
 * Server-only admin endpoint for seeding sample building data.
 * Company ID is loaded dynamically from database.
 *
 * @method POST - Seed sample buildings
 * @requires ADMIN_COMPANY_NAME - Server-only env var (required)
 *
 * @author George Pagonis + Claude Code (Anthropic AI)
 */

// ============================================================================
// SEED DATA: Sample buildings (server-only, no NEXT_PUBLIC_ env vars)
// ============================================================================

const SEED_BUILDINGS: Array<{
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  totalArea: number;
  builtArea: number;
  floors: number;
  units: number;
  status: string;
  startDate: string;
  completionDate: string;
  progress: number;
  totalValue: number;
  project: string;
  projectId: string;
  category: string;
  features: BuildingFeatureKey[];
  buildingFloors: Array<{ id: string; name: string; number: number; units: number }>;
}> = [
  {
    id: 'building_1_sample',
    name: 'Building A - Main Building',
    description: 'Main building with 8 high-spec units',
    address: 'Main Street 45',
    city: 'Thessaloniki',
    totalArea: 1850.50,
    builtArea: 1650.25,
    floors: 6,
    units: 8,
    status: 'active',
    startDate: '2020-03-15',
    completionDate: '2023-06-30',
    progress: 95,
    totalValue: 1800000,
    project: 'Sample Development Project',
    projectId: 'project_1_sample',
    category: 'residential',
    features: [
      'autonomousHeating',
      'elevator',
      'balconiesWithView',
      'parkingSpaces'
    ],
    buildingFloors: [
      { id: 'floor_0', name: 'Ground Floor', number: 0, units: 1 },
      { id: 'floor_1', name: '1st Floor', number: 1, units: 2 },
      { id: 'floor_2', name: '2nd Floor', number: 2, units: 2 },
      { id: 'floor_3', name: '3rd Floor', number: 3, units: 2 },
      { id: 'floor_4', name: '4th Floor', number: 4, units: 1 }
    ]
  },
  {
    id: 'building_2_sample',
    name: 'Building B - Auxiliary Building',
    description: 'Auxiliary building with storage and common areas',
    address: 'Main Street 47',
    city: 'Thessaloniki',
    totalArea: 450.75,
    builtArea: 380.50,
    floors: 2,
    units: 6,
    status: 'construction',
    startDate: '2023-09-01',
    completionDate: '2024-12-15',
    progress: 65,
    totalValue: 450000,
    project: 'Sample Development Project',
    projectId: 'project_1_sample',
    category: 'storage',
    features: [
      'warehouseClimate',
      'loadingRamps',
      'parkingSpaces'
    ],
    buildingFloors: [
      { id: 'floor_-1', name: 'Basement', number: -1, units: 3 },
      { id: 'floor_0', name: 'Ground Floor', number: 0, units: 3 }
    ]
  }
];

export async function POST(request: NextRequest) {
  try {
    console.log('[SEED] Starting enterprise building seeding (database-driven)...');

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
        suggestion: 'Please ensure company data exists before seeding buildings'
      }, { status: 404 });
    }

    console.log(`[SEED] Found company in database: ${company.id} (${company.companyName})`);

    const results = [];

    for (const buildingTemplate of SEED_BUILDINGS) {
      console.log(`[SEED] Creating building: ${buildingTemplate.name}`);

      // ENTERPRISE: Spread template and override with database-driven companyId
      const building = {
        ...buildingTemplate,
        companyId: company.id, // Database-driven value (overrides any template value)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, COLLECTIONS.BUILDINGS, building.id), building);

      console.log(`[SEED] Successfully created building with database-driven companyId: ${building.name}`);
      results.push({
        id: building.id,
        name: building.name,
        companyId: company.id,
        status: 'created'
      });
    }

    console.log('[SEED] All sample buildings have been successfully seeded to Firestore!');

    return NextResponse.json({
      success: true,
      message: 'Sample buildings seeded successfully',
      results,
      summary: {
        totalBuildings: SEED_BUILDINGS.length,
        project: getOptionalAdminProjectName() || SEED_BUILDINGS[0]?.project,
        company: company.companyName,
        companyId: company.id
      }
    });

  } catch (error) {
    console.error('[SEED] Error seeding buildings:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to seed buildings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}