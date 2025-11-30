'use server';

import { FirestoreProjectsRepository } from './repositories/FirestoreProjectsRepository';
import { MockProjectsRepository } from './repositories/MockProjectsRepository';
import { ProjectsService } from './services/ProjectsService';

const firestoreRepo = new FirestoreProjectsRepository();
const mockRepo = new MockProjectsRepository();
const service = new ProjectsService(firestoreRepo, mockRepo);

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
