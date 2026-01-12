/**
 * Floors API - Admin SDK (Enterprise Normalized Collection)
 * Provides access to floors using foreign key relationships with elevated permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { COLLECTIONS } from '@/config/firestore-collections';

/** Floor document from Firestore */
interface AdminFloorDocument {
  id: string;
  number?: number;
  name?: string;
  buildingId: string;
  projectId?: string;
  [key: string]: unknown;
}

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const projectId = searchParams.get('projectId');

    if (!adminDb) {
      throw new Error('Firebase Admin SDK not properly initialized');
    }

    // Validate required parameters
    if (!buildingId && !projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either buildingId or projectId parameter is required',
          usage: 'GET /api/floors/admin?buildingId=<id> or GET /api/floors/admin?projectId=<id>'
        },
        { status: 400 }
      );
    }

    console.log(`📋 [Admin] Loading floors for: ${buildingId ? `building ${buildingId}` : `project ${projectId}`}`);

    let floors: AdminFloorDocument[] = [];

    if (buildingId) {
      // Query floors by buildingId (Enterprise foreign key relationship)
      const floorsSnapshot = await adminDb.collection(COLLECTIONS.FLOORS)
        .where('buildingId', '==', buildingId)
        .get();

      floors = floorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AdminFloorDocument));

      // Sort by floor number in code (to avoid index requirements)
      floors.sort((a, b) => (a.number || 0) - (b.number || 0));

    } else if (projectId) {
      // Query floors by projectId
      const floorsSnapshot = await adminDb.collection(COLLECTIONS.FLOORS)
        .where('projectId', '==', projectId)
        .get();

      floors = floorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AdminFloorDocument));

      // Sort by building and then by floor number
      floors.sort((a, b) => {
        if (a.buildingId !== b.buildingId) {
          return a.buildingId.localeCompare(b.buildingId);
        }
        return (a.number || 0) - (b.number || 0);
      });
    }

    console.log(`   [Admin] Found ${floors.length} floors`);

    // Group floors by building if querying by projectId
    let response;
    if (projectId) {
      const floorsByBuilding = floors.reduce((groups: Record<string, AdminFloorDocument[]>, floor: AdminFloorDocument) => {
        const bId = floor.buildingId;
        if (!groups[bId]) {
          groups[bId] = [];
        }
        groups[bId].push(floor);
        return groups;
      }, {} as Record<string, AdminFloorDocument[]>);

      response = {
        success: true,
        floors,
        floorsByBuilding,
        stats: {
          totalFloors: floors.length,
          buildingsWithFloors: Object.keys(floorsByBuilding).length,
          projectId
        }
      };
    } else {
      response = {
        success: true,
        floors,
        stats: {
          totalFloors: floors.length,
          buildingId
        }
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [Admin] Floors API Error: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}