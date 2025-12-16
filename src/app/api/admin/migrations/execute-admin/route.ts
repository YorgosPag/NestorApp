/**
 * Enterprise Migration with Admin SDK
 * Production-grade migration using Firebase Admin SDK for elevated permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { COLLECTIONS } from '@/config/firestore-collections';

// Initialize Admin SDK if not already initialized
let adminDb: FirebaseFirestore.Firestore;

try {
  if (getApps().length === 0) {
    // For development, use project ID
    const app = initializeApp({
      projectId: 'nestor-pagonis'
    });
    adminDb = getFirestore(app);
  } else {
    adminDb = getFirestore();
  }
} catch (error) {
  console.error('Failed to initialize Admin SDK:', error);
}

interface MigrationResult {
  success: boolean;
  affectedRecords: number;
  executionTimeMs: number;
  details: any;
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    console.log('🏢 ENTERPRISE ADMIN MIGRATION STARTING...');

    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized');
    }

    // Step 1: Fetch all companies
    console.log('📋 Step 1: Fetching companies...');
    const companiesSnapshot = await adminDb.collection(COLLECTIONS.CONTACTS)
      .where('type', '==', 'company')
      .where('status', '==', 'active')
      .get();

    const companies = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${companies.length} active companies`);

    // Step 2: Fetch all projects
    console.log('📋 Step 2: Fetching projects...');
    const projectsSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();
    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${projects.length} projects`);

    // Step 3: Analyze and create mappings
    console.log('📋 Step 3: Analyzing project-company mappings...');
    const mappings = [];

    for (const project of projects) {
      const matchingCompany = companies.find(
        company => company.companyName === project.company
      );

      if (matchingCompany && project.companyId !== matchingCompany.id) {
        mappings.push({
          projectId: project.id,
          projectName: project.name,
          oldCompanyId: project.companyId || '<empty>',
          newCompanyId: matchingCompany.id,
          companyName: matchingCompany.companyName
        });
      }
    }

    console.log(`   Found ${mappings.length} projects requiring updates`);

    // Step 4: Execute updates using Admin SDK (batch operation)
    console.log('📋 Step 4: Executing batch updates...');
    const batch = adminDb.batch();
    let updateCount = 0;

    for (const mapping of mappings) {
      const projectRef = adminDb.collection(COLLECTIONS.PROJECTS).doc(mapping.projectId);

      batch.update(projectRef, {
        companyId: mapping.newCompanyId,
        updatedAt: new Date().toISOString(),
        migrationInfo: {
          migrationId: '001_fix_project_company_relationships_admin',
          migratedAt: new Date().toISOString(),
          oldCompanyId: mapping.oldCompanyId,
          newCompanyId: mapping.newCompanyId,
          migrationMethod: 'admin_sdk_batch'
        }
      });

      console.log(`   📝 Queued update: ${mapping.projectName} → ${mapping.companyName}`);
      updateCount++;
    }

    // Commit the batch
    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully updated ${updateCount} projects`);
    } else {
      console.log('ℹ️ No projects required updates');
    }

    // Step 5: Verification
    console.log('📋 Step 5: Verifying migration results...');
    const verificationSnapshot = await adminDb.collection(COLLECTIONS.PROJECTS).get();
    const updatedProjects = verificationSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    let validProjects = 0;
    let orphanProjects = 0;

    for (const project of updatedProjects) {
      const hasValidCompanyId = companies.some(company => company.id === project.companyId);
      if (hasValidCompanyId) {
        validProjects++;
      } else {
        orphanProjects++;
      }
    }

    const integrityScore = (validProjects / updatedProjects.length) * 100;

    console.log(`📊 Final Results:`);
    console.log(`   - Total projects: ${updatedProjects.length}`);
    console.log(`   - Projects with valid company IDs: ${validProjects}`);
    console.log(`   - Orphan projects: ${orphanProjects}`);
    console.log(`   - Data integrity: ${integrityScore.toFixed(1)}%`);

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      migration: {
        id: '001_fix_project_company_relationships_admin',
        name: 'Fix Project-Company Relationships (Admin SDK)',
        method: 'firebase_admin_batch'
      },
      execution: {
        executionTimeMs: executionTime,
        affectedRecords: updateCount,
        completedAt: new Date().toISOString()
      },
      results: {
        mappings: mappings.map(m => ({
          projectName: m.projectName,
          companyName: m.companyName,
          oldCompanyId: m.oldCompanyId,
          newCompanyId: m.newCompanyId
        })),
        verification: {
          totalProjects: updatedProjects.length,
          validProjects,
          orphanProjects,
          integrityScore: parseFloat(integrityScore.toFixed(1))
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Admin SDK'
      }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ ADMIN MIGRATION FAILED: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        execution: {
          executionTimeMs: executionTime,
          failedAt: new Date().toISOString()
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          system: 'Nestor Pagonis Enterprise Platform - Admin SDK'
        }
      },
      { status: 500 }
    );
  }
}