
// This file is now a barrel file to re-export from the new structure,
// ensuring backward compatibility with existing imports.
export { 
    getProjectsByCompanyId,
    getProjectStructure,
    getProjectCustomers,
    getProjectStats,
    debugProjectData
} from './projects/index.server';

export type {
    ProjectStructure,
    ProjectBuilding,
    ProjectUnit,
    ProjectStorage,
    ProjectParking
} from './projects/contracts';
