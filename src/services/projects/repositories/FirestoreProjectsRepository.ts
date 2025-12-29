import { db, safeDbOperation } from '@/lib/firebase-admin';
// ✅ ENTERPRISE FIX: Use Firestore functions from db instance, not direct imports
// Firebase Admin SDK Firestore functions are methods on the db instance
import type { IProjectsRepository } from '../contracts';
import type { Project } from '@/types/project';
import type { Building } from '@/types/building/contracts';
import type { Property } from '@/types/property-viewer';
import type { Contact } from '@/types/contacts';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const PROJECTS_COLLECTION = COLLECTIONS.PROJECTS;
const BUILDINGS_COLLECTION = COLLECTIONS.BUILDINGS;
const UNITS_COLLECTION = COLLECTIONS.UNITS;
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;

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
      // Using Firestore admin SDK methods correctly
      const projectsCollection = database.collection(PROJECTS_COLLECTION);

      // First, let's see ALL projects to understand the data structure
      console.log(`🔍 DEBUG: Fetching ALL projects to see available companyIds...`);
      const allSnapshot = await projectsCollection.get();
      console.log(`🔍 DEBUG: Total projects in Firestore: ${allSnapshot.docs.length}`);

      allSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // TEMP DEBUG για Γιώργο: Εμφάνιση όλων των projects και των company IDs τους
        console.log(`🔍 DEBUG: Project ID=${doc.id}, companyId="${data.companyId}", company="${data.company}", name="${data.name}"`);
      });

      // Now do the specific query
      const snapshot = await projectsCollection.where('companyId', '==', companyId).get();
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
      const docRef = database.collection('projects').doc(projectId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return null;
      }

      return { id: docSnap.id, ...docSnap.data() } as Project;
    }, null);
  }

  async getBuildingsByProjectId(projectId: string): Promise<Building[]> {
    return await safeDbOperation(async (database) => {
      // Using Firestore admin SDK methods correctly
      const buildingsCollection = database.collection(COLLECTIONS.BUILDINGS);
      const snapshot = await buildingsCollection.where('projectId', '==', projectId).get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Building));
    }, []);
  }

  async getUnitsByBuildingId(buildingId: string): Promise<Property[]> {
    return await safeDbOperation(async (database) => {
      // Using Firestore admin SDK methods correctly
      const unitsCollection = database.collection(COLLECTIONS.UNITS);
      const snapshot = await unitsCollection.where('buildingId', '==', buildingId).get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Property));
    }, []);
  }

  async getContactsByIds(ids: string[]): Promise<Contact[]> {
    if (ids.length === 0) return [];

    return await safeDbOperation(async (database) => {
      const { FieldPath } = await import('firebase-admin/firestore');

      const allContacts: Contact[] = [];
      const idChunks = chunkArray(ids, 10);
      const contactsCollection = database.collection(COLLECTIONS.CONTACTS);

      for (const chunk of idChunks) {
        const snapshot = await contactsCollection.where(FieldPath.documentId(), 'in', chunk).get();
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