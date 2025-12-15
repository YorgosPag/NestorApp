/**
 * ΑΠΛΗ ΕΠΙΣΚΕΥΗ PROJECT COMPANY IDS
 * Χρησιμοποιεί Firebase Admin SDK για direct update
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

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

export async function POST() {
  try {
    console.log('🔧 FIXING PROJECT COMPANY IDS...');

    if (!adminDb) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    // Σωστό companyId για όλα τα projects
    const correctCompanyId = 'pzNUy8ksddGCtcQMqumR';

    // Παίρνουμε όλα τα projects
    const projectsSnapshot = await adminDb.collection('projects').get();
    console.log(`📊 Found ${projectsSnapshot.size} projects`);

    const results = [];

    for (const doc of projectsSnapshot.docs) {
      const project = doc.data();
      const projectId = doc.id;

      console.log(`🔍 Project ${projectId}: current companyId="${project.companyId || '(empty)'}"`);

      if (project.companyId !== correctCompanyId) {
        console.log(`🔄 Updating project ${projectId}`);

        await adminDb.collection('projects').doc(projectId).update({
          companyId: correctCompanyId
        });

        results.push({
          projectId,
          name: project.name,
          oldCompanyId: project.companyId || '(empty)',
          newCompanyId: correctCompanyId,
          status: 'UPDATED'
        });

        console.log(`✅ Updated project ${projectId}`);
      } else {
        results.push({
          projectId,
          name: project.name,
          companyId: project.companyId,
          status: 'NO_CHANGE'
        });
        console.log(`✅ Project ${projectId} already correct`);
      }
    }

    // Επιβεβαίωση
    const verificationSnapshot = await adminDb.collection('projects').get();
    const verification = [];

    for (const doc of verificationSnapshot.docs) {
      const project = doc.data();
      verification.push({
        projectId: doc.id,
        name: project.name,
        companyId: project.companyId,
        isCorrect: project.companyId === correctCompanyId
      });
    }

    const allCorrect = verification.every(p => p.isCorrect);

    console.log(`🎉 COMPLETED! All projects fixed: ${allCorrect}`);

    return NextResponse.json({
      success: true,
      message: allCorrect ? 'ALL PROJECTS FIXED!' : 'Some projects still need fixing',
      results,
      verification,
      summary: {
        totalProjects: projectsSnapshot.size,
        updatedProjects: results.filter(r => r.status === 'UPDATED').length,
        allProjectsCorrect: allCorrect
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Fix Projects Error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Project Company IDs Fix Endpoint',
    usage: 'POST /api/fix-projects'
  });
}