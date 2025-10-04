import { NextRequest, NextResponse } from 'next/server';
import { FirestoreProjectsRepository } from '@/services/projects/repositories/FirestoreProjectsRepository';

const projectsRepo = new FirestoreProjectsRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = parseInt(params.projectId);
    console.log(`🏗️ API: Loading project structure for projectId: ${projectId}`);
    
    // Get project details
    const project = await projectsRepo.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: `Project with ID ${projectId} not found` },
        { status: 404 }
      );
    }
    
    // Get buildings for this project
    const buildings = await projectsRepo.getBuildingsByProjectId(projectId);
    
    // Get units for each building
    const buildingsWithUnits = await Promise.all(
      buildings.map(async (building) => {
        const units = await projectsRepo.getUnitsByBuildingId(`building-${building.id}`);
        return { ...building, units };
      })
    );
    
    const structure = {
      project,
      buildings: buildingsWithUnits
    };
    
    console.log(`🏗️ API: Project structure loaded for projectId: ${projectId}`);
    
    return NextResponse.json({ 
      success: true, 
      structure,
      projectId
    });
    
  } catch (error) {
    console.error('🏗️ API: Error loading project structure:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId: params.projectId
      },
      { status: 500 }
    );
  }
}