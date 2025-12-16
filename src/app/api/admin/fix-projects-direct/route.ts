/**
 * ENTERPRISE FIX - Direct Admin SDK Project CompanyID Update
 * Bypasses all permission systems using Firebase Admin SDK
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Admin SDK if not already initialized
let adminDb: FirebaseFirestore.Firestore;

try {
  if (getApps().length === 0) {
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized');
    }

    console.log('🔧 ENTERPRISE DIRECT FIX: Project CompanyIDs');
    console.log('⏰ Started at:', new Date().toISOString());

    // 🏢 ENTERPRISE: Load target company ID from environment
    const correctCompanyId = process.env.NEXT_PUBLIC_MAIN_COMPANY_ID || 'default-company-id';

    // Get all projects using Admin SDK
    console.log('📋 Loading all projects...');
    const projectsSnapshot = await adminDb.collection('projects').get();

    if (projectsSnapshot.empty) {
      console.log('⚠️ No projects found in database');
      return NextResponse.json({
        success: false,
        error: 'No projects found in database',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    console.log(`📊 Found ${projectsSnapshot.size} projects`);

    // Process each project
    const updates = [];
    const errors = [];

    for (const doc of projectsSnapshot.docs) {
      const project = doc.data();
      const projectId = doc.id;

      console.log(`🔍 Project ${projectId}:`);
      console.log(`   Current companyId: "${project.companyId || '(empty)'}"`);
      console.log(`   Project name: "${project.name}"`);
      console.log(`   Company: "${project.company}"`);

      // Check if update is needed
      if (project.companyId !== correctCompanyId) {
        console.log(`🔄 Updating project ${projectId} companyId`);
        console.log(`   From: "${project.companyId || '(empty)'}"`);
        console.log(`   To: "${correctCompanyId}"`);

        try {
          // Direct Admin SDK update - bypasses all permissions
          await adminDb.collection('projects').doc(projectId).update({
            companyId: correctCompanyId
          });

          updates.push({
            projectId,
            projectName: project.name,
            oldCompanyId: project.companyId || '(empty)',
            newCompanyId: correctCompanyId,
            status: 'SUCCESS'
          });

          console.log(`✅ Successfully updated project ${projectId}`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to update project ${projectId}:`, errorMessage);

          errors.push({
            projectId,
            projectName: project.name,
            error: errorMessage
          });
        }
      } else {
        console.log(`✅ Project ${projectId} already has correct companyId`);
        updates.push({
          projectId,
          projectName: project.name,
          oldCompanyId: project.companyId,
          newCompanyId: correctCompanyId,
          status: 'NO_CHANGE_NEEDED'
        });
      }
    }

    // Verification: Re-read all projects to confirm updates
    console.log('🔍 Verifying updates...');
    const verificationSnapshot = await adminDb.collection('projects').get();
    const verificationResults = [];

    for (const doc of verificationSnapshot.docs) {
      const project = doc.data();
      verificationResults.push({
        projectId: doc.id,
        projectName: project.name,
        companyId: project.companyId,
        isCorrect: project.companyId === correctCompanyId
      });
    }

    const totalExecutionTime = Date.now() - startTime;
    const successfulUpdates = updates.filter(u => u.status === 'SUCCESS').length;
    const totalProjects = projectsSnapshot.size;
    const correctProjects = verificationResults.filter(p => p.isCorrect).length;

    console.log('📊 FINAL RESULTS:');
    console.log(`   Total projects: ${totalProjects}`);
    console.log(`   Successful updates: ${successfulUpdates}`);
    console.log(`   Projects with correct companyId: ${correctProjects}/${totalProjects}`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Total execution time: ${totalExecutionTime}ms`);

    const response = {
      success: errors.length === 0,
      summary: {
        totalProjects,
        successfulUpdates,
        correctProjectsAfterUpdate: correctProjects,
        errors: errors.length,
        allProjectsFixed: correctProjects === totalProjects
      },
      execution: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        executionTimeMs: totalExecutionTime,
        mode: 'DIRECT_ADMIN_SDK'
      },
      target: {
        correctCompanyId,
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company'
      },
      updates,
      errors,
      verification: verificationResults,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Direct Admin Fix'
      }
    };

    if (response.success && response.summary.allProjectsFixed) {
      console.log('🎉 ALL PROJECTS SUCCESSFULLY FIXED!');
    } else {
      console.log('⚠️ Fix completed with issues');
    }

    return NextResponse.json(response, {
      status: response.success ? 200 : 500
    });

  } catch (error) {
    const totalExecutionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ DIRECT FIX SYSTEM ERROR:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      execution: {
        startedAt: new Date(startTime).toISOString(),
        failedAt: new Date().toISOString(),
        totalTimeMs: totalExecutionTime,
        mode: 'DIRECT_ADMIN_SDK'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        system: 'Nestor Pagonis Enterprise Platform - Direct Admin Fix'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      system: {
        name: 'Direct Admin Project CompanyID Fix',
        version: '1.0.0',
        description: 'Bypasses all permission systems using Firebase Admin SDK',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      },
      usage: {
        endpoint: 'POST /api/admin/fix-projects-direct',
        method: 'Direct Firebase Admin SDK update',
        target: 'Fix all project companyIds to: pzNUy8ksddGCtcQMqumR',
        features: ['Permission bypass', 'Verification', 'Detailed logging']
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}