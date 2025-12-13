import { db, safeDbOperation } from '@/lib/firebase-admin';
import type { IProjectsRepository } from '../contracts';
import type { Project } from '@/types/project';
import type { Building } from '@/components/building-management/mockData';
import type { Property } from '@/types/property-viewer';
import type { Contact } from '@/types/contacts';

// Helper function for chunking arrays
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export class FirestoreProjectsRepository implements IProjectsRepository {

  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    console.log(`🏗️ FirestoreProjectsRepository: Loading projects for companyId: "${companyId}"`);

    return await safeDbOperation(async (database) => {
      // Import firestore functions at runtime
      const { collection, query, where, getDocs } = await import('firebase-admin/firestore');

      // First, let's see ALL projects to understand the data structure
      console.log(`🔍 DEBUG: Fetching ALL projects to see available companyIds...`);
      const allProjectsQuery = query(collection(database, 'projects'));
      const allSnapshot = await getDocs(allProjectsQuery);
      console.log(`🔍 DEBUG: Total projects in Firestore: ${allSnapshot.docs.length}`);

      allSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // TEMP DEBUG για Γιώργο: Εμφάνιση όλων των projects και των company IDs τους
        console.log(`🔍 DEBUG: Project ID=${doc.id}, companyId="${data.companyId}", company="${data.company}", name="${data.name}"`);
      });

      // Now do the specific query
      const projectsQuery = query(
        collection(database, 'projects'),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(projectsQuery);
      console.log(`🏗️ FirestoreProjectsRepository: Found ${snapshot.docs.length} projects for companyId "${companyId}"`);

      const projects: Project[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Project));

      console.log(`🏗️ FirestoreProjectsRepository: Projects:`, projects.map(p => ({
        id: p.id,
        name: p.name,
        company: p.company
      })));

      return projects;
    }, []);
  }

  async getProjectById(projectId: string): Promise<Project | null> {
    return await safeDbOperation(async (database) => {
      const { doc, getDoc } = await import('firebase-admin/firestore');

      const docRef = doc(database, 'projects', projectId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return { id: docSnap.id, ...docSnap.data() } as Project;
    }, null);
  }

  async getBuildingsByProjectId(projectId: string): Promise<Building[]> {
    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs } = await import('firebase-admin/firestore');

      const q = query(
        collection(database, 'buildings'),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Building));
    }, []);
  }

  async getUnitsByBuildingId(buildingId: string): Promise<Property[]> {
    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs } = await import('firebase-admin/firestore');

      const q = query(
        collection(database, 'units'),
        where('buildingId', '==', buildingId)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Property));
    }, []);
  }

  async getContactsByIds(ids: string[]): Promise<Contact[]> {
    if (ids.length === 0) return [];

    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs, documentId } = await import('firebase-admin/firestore');

      const allContacts: Contact[] = [];
      const idChunks = chunkArray(ids, 10);

      for (const chunk of idChunks) {
        const q = query(
          collection(database, 'contacts'),
          where(documentId(), 'in', chunk)
        );
        const snapshot = await getDocs(q);
        const contacts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Contact));
        allContacts.push(...contacts);
      }

      return allContacts;
    }, []);
  }
}