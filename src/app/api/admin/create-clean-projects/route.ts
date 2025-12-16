/**
 * CLEAN PROJECT CREATION - Fresh Start for Development
 * Creates clean projects with proper companyIds and structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Admin SDK if not already initialized
let adminDb: FirebaseFirestore.Firestore;

try {
  if (getApps().length === 0) {
    const app = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
    adminDb = getFirestore(app);
  } else {
    adminDb = getFirestore();
  }
} catch (error) {
  console.error('Failed to initialize Admin SDK:', error);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized');
    }

    console.log('🏗️ CREATING CLEAN PROJECTS FOR DEVELOPMENT');
    console.log('⏰ Started at:', new Date().toISOString());

    // 🏢 ENTERPRISE: Load company ID from environment configuration
    const correctCompanyId = process.env.NEXT_PUBLIC_MAIN_COMPANY_ID || 'default-company-id';

    // Define clean projects with proper structure
    const cleanProjects = [
      {
        id: '2001',
        name: 'Παλαιολόγου Πολυκατοικία',
        title: 'Ανέγερση σύγχρονης πολυκατοικίας στην οδό Παλαιολόγου',
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
        companyId: correctCompanyId,
        address: 'Παλαιολόγου 15, Εύοσμος',
        city: 'Θεσσαλονίκη',
        status: 'in_progress',
        progress: 75,
        startDate: '2023-03-15',
        completionDate: '2025-08-30',
        totalArea: 1250.5,
        totalValue: 850000,
        buildings: [
          {
            id: 'building_1_palaiologou',
            name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
            description: 'Κύριο κτίριο της πολυκατοικίας με 8 διαμερίσματα υψηλών προδιαγραφών',
            status: 'active',
            totalArea: 1850.5,
            units: 8,
            floors: [
              { id: 'floor_0', name: 'Ισόγειο', number: 0, units: 1 },
              { id: 'floor_1', name: '1ος Όροφος', number: 1, units: 2 },
              { id: 'floor_2', name: '2ος Όροφος', number: 2, units: 2 },
              { id: 'floor_3', name: '3ος Όροφος', number: 3, units: 2 },
              { id: 'floor_4', name: '4ος Όροφος', number: 4, units: 1 }
            ]
          },
          {
            id: 'building_2_palaiologou',
            name: 'ΚΤΙΡΙΟ Β - Βοηθητικές Εγκαταστάσεις',
            description: 'Βοηθητικό κτίριο με αποθήκες και χώρους κοινής ωφέλειας',
            status: 'construction',
            totalArea: 450.75,
            units: 6,
            floors: [
              { id: 'floor_-1', name: 'Υπόγειο', number: -1, units: 3 },
              { id: 'floor_0', name: 'Ισόγειο', number: 0, units: 3 }
            ]
          }
        ]
      },
      {
        id: '2002',
        name: 'Μεγάλου Αλεξάνδρου Συγκρότημα',
        title: 'Σύγχρονο εμπορικό και κατοικιακό συγκρότημα',
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
        companyId: correctCompanyId,
        address: 'Μεγάλου Αλεξάνδρου 45, Κέντρο',
        city: 'Θεσσαλονίκη',
        status: 'planning',
        progress: 25,
        startDate: '2024-01-10',
        completionDate: '2026-12-15',
        totalArea: 2500.0,
        totalValue: 1500000,
        buildings: []
      },
      {
        id: '2003',
        name: 'Τσιμισκή Εμπορικό Κέντρο',
        title: 'Πολυλειτουργικό εμπορικό κέντρο στην καρδιά της πόλης',
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
        companyId: correctCompanyId,
        address: 'Τσιμισκή 120, Κέντρο',
        city: 'Θεσσαλονίκη',
        status: 'completed',
        progress: 100,
        startDate: '2022-05-01',
        completionDate: '2024-03-30',
        totalArea: 3200.0,
        totalValue: 2200000,
        buildings: []
      }
    ];

    console.log(`🏗️ Creating ${cleanProjects.length} clean projects...`);

    const results = [];
    for (const project of cleanProjects) {
      console.log(`🔄 Creating project: ${project.name}`);

      const projectData = {
        ...project,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      };

      // Remove buildings from main project document for normalization
      const { buildings, ...projectWithoutBuildings } = projectData;

      await adminDb.collection('projects').doc(project.id).set(projectWithoutBuildings);

      // Create buildings if they exist
      for (const building of buildings || []) {
        const buildingData = {
          ...building,
          projectId: project.id,
          projectName: project.name,
          companyId: project.companyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Remove floors from main building document for normalization
        const { floors, ...buildingWithoutFloors } = buildingData;

        await adminDb.collection('buildings').doc(building.id).set(buildingWithoutFloors);

        // Create floors if they exist
        for (const floor of floors || []) {
          const floorData = {
            ...floor,
            projectId: project.id,
            buildingId: building.id,
            projectName: project.name,
            buildingName: building.name,
            companyId: project.companyId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await adminDb.collection('floors').doc(`${building.id}_${floor.id}`).set(floorData);
          console.log(`   ✅ Created floor: ${floor.name} (Building: ${building.name})`);
        }

        console.log(`  ✅ Created building: ${building.name} with ${floors?.length || 0} floors`);
      }

      results.push({
        projectId: project.id,
        projectName: project.name,
        companyId: project.companyId,
        buildingsCreated: buildings?.length || 0,
        floorsCreated: buildings?.reduce((total, b) => total + (b.floors?.length || 0), 0) || 0,
        status: 'SUCCESS'
      });

      console.log(`✅ Successfully created project ${project.id}: ${project.name}`);
    }

    // Verification: Count all created documents
    console.log('🔍 Verifying created documents...');
    const [projectsSnapshot, buildingsSnapshot, floorsSnapshot] = await Promise.all([
      adminDb.collection('projects').get(),
      adminDb.collection('buildings').get(),
      adminDb.collection('floors').get()
    ]);

    const totalExecutionTime = Date.now() - startTime;

    const response = {
      success: true,
      summary: {
        projectsCreated: results.length,
        buildingsCreated: results.reduce((total, r) => total + r.buildingsCreated, 0),
        floorsCreated: results.reduce((total, r) => total + r.floorsCreated, 0),
        totalProjectsInDb: projectsSnapshot.size,
        totalBuildingsInDb: buildingsSnapshot.size,
        totalFloorsInDb: floorsSnapshot.size
      },
      execution: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        executionTimeMs: totalExecutionTime,
        mode: 'CLEAN_CREATION_ADMIN_SDK'
      },
      target: {
        correctCompanyId,
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company'
      },
      results,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Clean Project Creation'
      }
    };

    console.log('📊 CLEAN PROJECT CREATION COMPLETED!');
    console.log(`   Projects: ${response.summary.projectsCreated}`);
    console.log(`   Buildings: ${response.summary.buildingsCreated}`);
    console.log(`   Floors: ${response.summary.floorsCreated}`);
    console.log(`   Total execution time: ${totalExecutionTime}ms`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const totalExecutionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ CLEAN PROJECT CREATION ERROR:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      execution: {
        startedAt: new Date(startTime).toISOString(),
        failedAt: new Date().toISOString(),
        totalTimeMs: totalExecutionTime,
        mode: 'CLEAN_CREATION_ADMIN_SDK'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Clean Project Creation'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    system: {
      name: 'Clean Project Creation',
      version: '1.0.0',
      description: 'Creates fresh projects with proper structure for development',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    },
    usage: {
      endpoint: 'POST /api/admin/create-clean-projects',
      method: 'Firebase Admin SDK creation',
      target: `Create clean normalized projects with companyId: ${correctCompanyId}`,
      features: ['Normalized structure', 'Buildings & Floors', 'Clean IDs']
    }
  });
}