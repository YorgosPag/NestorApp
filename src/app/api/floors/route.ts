/**
 * Floors API - Enterprise Normalized Collection
 * Provides access to floors using foreign key relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');
    const projectId = searchParams.get('projectId');

    // Validate required parameters
    if (!buildingId && !projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either buildingId or projectId parameter is required',
          usage: 'GET /api/floors?buildingId=<id> or GET /api/floors?projectId=<id>'
        },
        { status: 400 }
      );
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
    let response;
    if (projectId) {
      const floorsByBuilding = floors.reduce((groups: any, floor: any) => {
        const buildingId = floor.buildingId;
        if (!groups[buildingId]) {
          groups[buildingId] = [];
        }
        groups[buildingId].push(floor);
        return groups;
      }, {});

      response = {
        success: true,
        floors,
        floorsByBuilding,
        stats: {
          totalFloors: floors.length,
          buildingsWithFloors: Object.keys(floorsByBuilding).length
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
    console.error(`❌ Floors API Error: ${errorMessage}`);

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