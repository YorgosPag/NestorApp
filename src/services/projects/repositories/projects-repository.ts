/**
 * 🏢 ENTERPRISE PROJECTS REPOSITORY - PRODUCTION READY
 *
 * Αντικατέστησε το SampleProjectsRepository με επαγγελματικό FirestoreProjectsRepository.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { IProjectsRepository } from '../contracts';
import type { Project } from '@/types/project';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectsRepository');

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const PROJECTS_COLLECTION = COLLECTIONS.PROJECTS;

export class FirestoreProjectsRepository implements Pick<IProjectsRepository, 'getProjectsByCompanyId'> {
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    try {
      logger.info(`Searching for companyId`, { companyId });

      // Φόρτωση projects από Firebase για τη συγκεκριμένη εταιρεία
      const projectsQuery = query(
        collection(db, PROJECTS_COLLECTION),
        where('companyId', '==', companyId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(projectsQuery);

      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];

      logger.info(`Found projects for companyId`, { companyId, count: projects.length });
      return projects;

    } catch (error) {
      logger.error('Error fetching projects from Firebase', { error });
      return []; // Επιστροφή κενού array αντί για sample data
    }
  }

  // 🏢 ENTERPRISE NOTE: Project updates use Server Actions only (not client-side)
  // See: src/services/projects.service.ts → updateProject() server action
  // Reason: Firestore Security Rules block client-side writes to projects collection
}

// 🚨 DEPRECATED: SampleProjectsRepository - Αντικαταστάθηκε με FirestoreProjectsRepository
// Διατηρείται για backward compatibility μόνο
export class SampleProjectsRepository implements Pick<IProjectsRepository, 'getProjectsByCompanyId'> {
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    logger.warn('SampleProjectsRepository is deprecated! Use FirestoreProjectsRepository instead.');

    // Redirect to real Firebase data instead of sample data
    const firestoreRepo = new FirestoreProjectsRepository();
    return await firestoreRepo.getProjectsByCompanyId(companyId);
  }
}