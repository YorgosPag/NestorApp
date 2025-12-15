/**
 * Floors API - Enterprise Normalized Collection
 * Provides access to floors using foreign key relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';

export const GET = withErrorHandling(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const projectId = searchParams.get('projectId');

    // Validate required parameters
    if (!buildingId && !projectId) {
      throw new Error('Either buildingId or projectId parameter is required');
    }

    console.log(`📋 Loading floors for: ${buildingId ? `building ${buildingId}` : `project ${projectId}`}`);

    // Build query based on parameters (Enterprise foreign key relationships)
    let floorsQuery;
    if (buildingId) {
      // Query floors by buildingId (most common use case)
      floorsQuery = query(
        collection(db, 'floors'),
        where('buildingId', '==', buildingId),
        orderBy('number', 'asc') // Order by floor number
      );
    } else if (projectId) {
      // Query floors by projectId (for project-level floor listing)
      floorsQuery = query(
        collection(db, 'floors'),
        where('projectId', '==', projectId),
        orderBy('buildingId', 'asc'),
        orderBy('number', 'asc')
      );
    }

    // Execute query
    const floorsSnapshot = await getDocs(floorsQuery!);
    const floors = floorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   Found ${floors.length} floors`);

    // Group floors by building if querying by projectId
    if (projectId) {
      const floorsByBuilding = floors.reduce((groups: any, floor: any) => {
        const buildingId = floor.buildingId;
        if (!groups[buildingId]) {
          groups[buildingId] = [];
        }
        groups[buildingId].push(floor);
        return groups;
      }, {});

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