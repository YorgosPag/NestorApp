'use server';

import { FirestoreProjectsRepository } from './repositories/FirestoreProjectsRepository';
import { FirestoreProjectsRepository as NewFirestoreRepo } from './repositories/projects-repository'; // Updated to use production repo
import { ProjectsService } from './services/ProjectsService';

// 🔥 PRODUCTION READY: Χρησιμοποιεί μόνο επαγγελματικά repositories
const firestoreRepo = new FirestoreProjectsRepository();
const productionRepo = new NewFirestoreRepo(); // Αντικατέστησε το sample repository
const service = new ProjectsService(firestoreRepo, productionRepo);

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
