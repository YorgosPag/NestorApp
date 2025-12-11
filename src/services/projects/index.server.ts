'use server';

import { FirestoreProjectsRepository } from './repositories/FirestoreProjectsRepository';
import { FirestoreProjectsRepository as NewFirestoreRepo } from './repositories/MockProjectsRepository'; // Updated to use production repo
import { ProjectsService } from './services/ProjectsService';

// 🔥 PRODUCTION READY: Χρησιμοποιεί μόνο επαγγελματικά repositories
const firestoreRepo = new FirestoreProjectsRepository();
const productionRepo = new NewFirestoreRepo(); // Αντικατέστησε το mock repository
const service = new ProjectsService(firestoreRepo, productionRepo);

export async function getProjectsByCompanyId(companyId: string) {
    // Debug logging removed: console.log(`🏗️ SERVER ACTION: getProjectsByCompanyId called with: "${companyId}"`);
    return await service.getProjectsByCompanyId(companyId);
}

export async function getProjectStructure(projectId: number) {
    return await service.getProjectStructure(projectId);
}

export async function getProjectCustomers(projectId: number) {
    return await service.getProjectCustomers(projectId);
}

export async function getProjectStats(projectId: number) {
    return await service.getProjectStats(projectId);
}

export async function debugProjectData(projectId: number) {
    return await service.debugProjectData(projectId);
}
