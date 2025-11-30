
import { db } from '@/lib/firebase-admin';
import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase-admin/firestore';
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
    // Debug logging removed: console.log(`🏗️ FirestoreProjectsRepository: Loading projects for companyId: "${companyId}"`);
    
    if (!db) {
      // Error logging removed //('🏗️ FirestoreProjectsRepository: Firebase admin not initialized');
      // Error logging removed //('🏗️ FirestoreProjectsRepository: Check environment variables FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_KEY');
      return [];
    }
    
    // Debug logging removed: console.log('🏗️ FirestoreProjectsRepository: Firebase admin is initialized correctly');
    
    try {
      // First, let's see ALL projects to understand the data structure
      // Debug logging removed: console.log(`🔍 DEBUG: Fetching ALL projects to see available companyIds...`);
      const allProjectsQuery = query(collection(db, 'projects'));
      const allSnapshot = await getDocs(allProjectsQuery);
      // Debug logging removed: console.log(`🔍 DEBUG: Total projects in Firestore: ${allSnapshot.docs.length}`);
      
      allSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Debug logging removed: console.log(`🔍 DEBUG: Project ID=${doc.id}, companyId="${data.companyId}", company="${data.company}", name="${data.name}"`);
      });
      
      // Now do the specific query
      const projectsQuery = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId)
      );
      
      const snapshot = await getDocs(projectsQuery);
      // Debug logging removed: console.log('🔍 Found', snapshot.docs.length, 'projects');
      // Debug logging removed: console.log(`🏗️ FirestoreProjectsRepository: Found ${snapshot.docs.length} projects for companyId "${companyId}"`);
      
      const projects: Project[] = snapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      } as Project));
      
      // Debug logging removed: console.log(`🏗️ FirestoreProjectsRepository: Projects:`, projects.map(p => ({
      //   id: p.id,
      //   name: p.name,
      //   company: p.company
      // })));
      
      return projects;
    } catch (error) {
      // Error logging removed: console.error('🏗️ FirestoreProjectsRepository: Error loading projects:', error);
      return [];
    }
  }
  
  async getProjectById(projectId: number): Promise<Project | null> {
    if (!db) return null;
    const docRef = doc(db, 'projects', String(projectId));
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    return { id: parseInt(docSnap.id), ...docSnap.data() } as Project;
  }

  async getBuildingsByProjectId(projectId: number): Promise<Building[]> {
    if (!db) return [];
    const q = query(collection(db, 'buildings'), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: parseInt(doc.id), ...doc.data() } as Building));
  }
  
  async getUnitsByBuildingId(buildingId: string): Promise<Property[]> {
      if (!db) return [];
      const q = query(collection(db, 'units'), where('buildingId', '==', buildingId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
  }

  async getContactsByIds(ids: string[]): Promise<Contact[]> {
    if (ids.length === 0 || !db) return [];
    
    const allContacts: Contact[] = [];
    const idChunks = chunkArray(ids, 10);
    
    for (const chunk of idChunks) {
      const q = query(collection(db, 'contacts'), where(documentId(), 'in', chunk));
      const snapshot = await getDocs(q);
      const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
      allContacts.push(...contacts);
    }

    return allContacts;
  }
}
