/**
 * 🏢 ENTERPRISE PROJECTS REPOSITORY - PRODUCTION READY
 *
 * Αντικατέστησε το MockProjectsRepository με επαγγελματικό FirestoreProjectsRepository.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { IProjectsRepository } from '../contracts';
import type { Project } from '@/types/project';

export class FirestoreProjectsRepository implements Pick<IProjectsRepository, 'getProjectsByCompanyId'> {
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    try {
      console.log(`🏗️ FirestoreProjectsRepository: Searching for companyId: "${companyId}"`);

      // Φόρτωση projects από Firebase για τη συγκεκριμένη εταιρεία
      const projectsQuery = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(projectsQuery);

      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];

      console.log(`✅ Found ${projects.length} projects for companyId "${companyId}"`);
      return projects;

    } catch (error) {
      console.error('❌ Error fetching projects from Firebase:', error);
      return []; // Επιστροφή κενού array αντί για mock data
    }
  }
}

// 🚨 DEPRECATED: MockProjectsRepository - Αντικαταστάθηκε με FirestoreProjectsRepository
// Διατηρείται για backward compatibility μόνο
export class MockProjectsRepository implements Pick<IProjectsRepository, 'getProjectsByCompanyId'> {
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    console.warn('🚨 MockProjectsRepository is deprecated! Use FirestoreProjectsRepository instead.');

    // Redirect to real Firebase data instead of mock data
    const firestoreRepo = new FirestoreProjectsRepository();
    return await firestoreRepo.getProjectsByCompanyId(companyId);
  }
}