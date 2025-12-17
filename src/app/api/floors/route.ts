/**
 * Floors API - Enterprise Normalized Collection
 * Provides access to floors using foreign key relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE INTERFACES - Proper TypeScript typing
interface FloorDocument {
  id: string;
  number: number;
  name?: string;
  buildingId: string;
  projectId?: string;
  [key: string]: any;
}

export const GET = withErrorHandling(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const projectId = searchParams.get('projectId');

    // For testing: Show ALL floors if no parameters (temporary debug)
    if (!buildingId && !projectId) {
      console.log('🔧 DEBUG MODE: Loading ALL floors (no parameters provided)');
      const allFloorsQuery = query(collection(db, COLLECTIONS.FLOORS));
      const allSnapshot = await getDocs(allFloorsQuery);

      console.log(`🔧 DEBUG: Found ${allSnapshot.docs.length} total floors`);
      allSnapshot.docs.forEach(doc => {
        console.log(`🔧 DEBUG: Floor ID=${doc.id}, data:`, doc.data());
      });

      const allFloors = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return apiSuccess({
        floors: allFloors,
        debug: true,
        message: 'Debug mode: All floors returned'
      }, `DEBUG: Found ${allFloors.length} floors total`);
    }

    console.log(`📋 Loading floors for: ${buildingId ? `building ${buildingId}` : `project ${projectId}`}`);

    // Build query based on parameters (Enterprise foreign key relationships)
    let floorsQuery;
    if (buildingId) {
      // Query floors by buildingId (most common use case)
      floorsQuery = query(
        collection(db, COLLECTIONS.FLOORS),
        where('buildingId', '==', buildingId)
      );
    } else if (projectId) {
      // Query floors by projectId (for project-level floor listing)
      // Handle both string and number projectId values
      const projectIdValue = isNaN(Number(projectId)) ? projectId : Number(projectId);
      console.log(`🔧 DEBUG: projectId="${projectId}" converted to:`, projectIdValue);

      floorsQuery = query(
        collection(db, COLLECTIONS.FLOORS),
        where('projectId', '==', projectIdValue)
      );
    }

    // Execute query
    const floorsSnapshot = await getDocs(floorsQuery!);
    let floors: FloorDocument[] = floorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FloorDocument));

    console.log(`   Found ${floors.length} floors`);

    // 🚀 ENTERPRISE SORTING: JavaScript-based sorting to avoid Firestore index requirements
    if (buildingId) {
      // Sort floors by number for single building
      floors.sort((a: FloorDocument, b: FloorDocument) => {
        const numA = typeof a.number === 'number' ? a.number : parseInt(String(a.number)) || 0;
        const numB = typeof b.number === 'number' ? b.number : parseInt(String(b.number)) || 0;
        return numA - numB;
      });
    } else if (projectId) {
      // Sort by building first, then by floor number for project-level queries
      floors.sort((a: FloorDocument, b: FloorDocument) => {
        // First sort by building ID
        if (a.buildingId !== b.buildingId) {
          return a.buildingId.localeCompare(b.buildingId);
        }
        // Then by floor number
        const numA = typeof a.number === 'number' ? a.number : parseInt(String(a.number)) || 0;
        const numB = typeof b.number === 'number' ? b.number : parseInt(String(b.number)) || 0;
        return numA - numB;
      });
    }

    // Group floors by building if querying by projectId
    if (projectId) {
      const floorsByBuilding = floors.reduce((groups: Record<string, FloorDocument[]>, floor: FloorDocument) => {
        const buildingId = floor.buildingId;
        if (!groups[buildingId]) {
          groups[buildingId] = [];
        }
        groups[buildingId].push(floor);
        return groups;
      }, {} as Record<string, FloorDocument[]>);

      return apiSuccess({
        floors,
        floorsByBuilding,
        stats: {
          totalFloors: floors.length,
          buildingsWithFloors: Object.keys(floorsByBuilding).length
        }
      }, `Found ${floors.length} floors in ${Object.keys(floorsByBuilding).length} buildings`);
    } else {
      return apiSuccess({
        floors,
        stats: {
          totalFloors: floors.length,
          buildingId
        }
      }, `Found ${floors.length} floors for building ${buildingId}`);
    }
}, {
  operation: 'loadFloors',
  entityType: 'floors'
});