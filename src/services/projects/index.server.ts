/**
 * @deprecated This file is deprecated. Import from '@/services/projects.service' instead.
 *
 * 🏢 ENTERPRISE: Single Source of Truth Pattern
 * All server actions are defined in the parent projects.service.ts file.
 * This file exists only for backward compatibility and will be removed in future versions.
 *
 * Correct import:
 * import { getProjectsByCompanyId, getProjectStats } from '@/services/projects.service';
 */

// Re-export from the single source of truth (no 'use server' needed - parent has it)
export {
    getProjectsByCompanyId,
    getProjectStructure,
    getProjectCustomers,
    getProjectStats,
    debugProjectData
} from '../projects.service';

export type {
    ProjectStructure,
    ProjectBuilding,
    ProjectUnit,
    ProjectStorage,
    ProjectParking
} from './contracts';
