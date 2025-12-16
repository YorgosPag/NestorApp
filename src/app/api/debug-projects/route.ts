import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging projects with buildings...');

    // Get all projects to see what's available
    const projectsQuery = query(collection(db, COLLECTIONS.PROJECTS));
    
    const projectsSnapshot = await getDocs(projectsQuery);
    const projects = projectsSnapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${projects.length} projects in database`);

    return NextResponse.json({
      success: true,
      projects: projects,
      debug: {
        projectCount: projects.length,
        projectBuildings: projects.map(p => ({
          docId: p.docId,
          id: p.id,
          name: p.name,
          buildings: p.buildings ? p.buildings.length : 0,
          buildingNames: p.buildings ? p.buildings.map((b: any) => b.name) : []
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error debugging projects:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to debug projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}