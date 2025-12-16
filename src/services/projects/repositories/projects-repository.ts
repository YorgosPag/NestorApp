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

// 🏢 ENTERPRISE: Configurable Firestore collection names
const PROJECTS_COLLECTION = process.env.NEXT_PUBLIC_PROJECTS_COLLECTION || 'projects';

export class FirestoreProjectsRepository implements Pick<IProjectsRepository, 'getProjectsByCompanyId'> {
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    try {
      console.log(`🏗️ FirestoreProjectsRepository: Searching for companyId: "${companyId}"`);

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

      console.log(`✅ Found ${projects.length} projects for companyId "${companyId}"`);
      return projects;

    } catch (error) {
      console.error('❌ Error fetching projects from Firebase:', error);
      return []; // Επιστροφή κενού array αντί για sample data
    }
  }
}

// 🚨 DEPRECATED: SampleProjectsRepository - Αντικαταστάθηκε με FirestoreProjectsRepository
// Διατηρείται για backward compatibility μόνο
export class SampleProjectsRepository implements Pick<IProjectsRepository, 'getProjectsByCompanyId'> {
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    console.warn('🚨 SampleProjectsRepository is deprecated! Use FirestoreProjectsRepository instead.');

    // Redirect to real Firebase data instead of sample data
    const firestoreRepo = new FirestoreProjectsRepository();
    return await firestoreRepo.getProjectsByCompanyId(companyId);
  }
}