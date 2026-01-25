'use server';

// 🏢 ENTERPRISE: Server actions barrel file for backward compatibility
// All functions must be async and defined here (no re-exports in 'use server' files)

import { FirestoreProjectsRepository } from './projects/repositories/FirestoreProjectsRepository';
import { FirestoreProjectsRepository as NewFirestoreRepo } from './projects/repositories/projects-repository';
import { ProjectsService } from './projects/services/ProjectsService';

// Initialize repositories and service
const firestoreRepo = new FirestoreProjectsRepository();
const productionRepo = new NewFirestoreRepo();
const service = new ProjectsService(firestoreRepo, productionRepo);

// Server Actions - must be async functions
export async function getProjectsByCompanyId(companyId: string) {
    console.log(`🏗️ SERVER ACTION: getProjectsByCompanyId called with: "${companyId}"`);
    const result = await service.getProjectsByCompanyId(companyId);
    console.log(`🏗️ SERVER ACTION: returning ${result.length} projects for companyId "${companyId}"`);
    return result;
}

export async function getProjectStructure(projectId: string) {
    return await service.getProjectStructure(projectId);
}

export async function getProjectCustomers(projectId: string) {
    return await service.getProjectCustomers(projectId);
}

export async function getProjectStats(projectId: string) {
    return await service.getProjectStats(projectId);
}

export async function debugProjectData(projectId: string) {
    return await service.debugProjectData(projectId);
}

/**
 * 🏢 ENTERPRISE: Update project using Firebase Admin SDK (server-side)
 *
 * Pattern: SAP/Salesforce/Microsoft Dynamics - Server Action with validation
 *
 * @param projectId - The ID of the project to update
 * @param updates - Partial project data to update
 * @returns Promise<{ success: boolean; error?: string }>
 *
 * Security:
 * - Runs on server (not exposed to client)
 * - Uses Firebase Admin SDK (admin privileges)
 * - Includes server-side validation
 */
export async function updateProject(
    projectId: string,
    updates: { name?: string; title?: string; status?: string }
): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`🏗️ SERVER ACTION: updateProject called for: "${projectId}"`);

        // 🏢 ENTERPRISE: Use the Firestore repository with validation
        await firestoreRepo.updateProject(projectId, updates);

        console.log(`✅ SERVER ACTION: Project "${projectId}" updated successfully`);
        return { success: true };

    } catch (error) {
        console.error(`❌ SERVER ACTION: Failed to update project "${projectId}":`, error);

        // 🏢 ENTERPRISE: Return descriptive error message
        const errorMessage = error instanceof Error
            ? error.message
            : 'Unknown error occurred while updating project';

        return { success: false, error: errorMessage };
    }
}

// 🏢 ENTERPRISE: Type re-exports NOT allowed in 'use server' files
// Import types directly from: '@/services/projects/contracts'
