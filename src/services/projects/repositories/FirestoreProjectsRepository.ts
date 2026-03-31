import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
// ✅ ENTERPRISE FIX: Use Firestore functions from db instance, not direct imports
// Firebase Admin SDK Firestore functions are methods on the db instance
import type { IProjectsRepository } from '../contracts';
import type { Project, ProjectUpdatePayload } from '@/types/project';
import type { Building } from '@/types/building/contracts';
import type { Property } from '@/types/property-viewer';
import type { Contact } from '@/types/contacts';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { chunkArray } from '@/lib/array-utils';

const logger = createModuleLogger('FirestoreProjectsRepository');

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const PROJECTS_COLLECTION = COLLECTIONS.PROJECTS;
const BUILDINGS_COLLECTION = COLLECTIONS.BUILDINGS;
const UNITS_COLLECTION = COLLECTIONS.PROPERTIES;
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;

export class FirestoreProjectsRepository implements IProjectsRepository {

  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    return await safeFirestoreOperation(async (database) => {
      const projectsCollection = database.collection(PROJECTS_COLLECTION);
      const snapshot = await projectsCollection.where(FIELDS.COMPANY_ID, '==', companyId).get();

      const projects: Project[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Project));

      return projects;
    }, []);
  }

  async getProjectById(projectId: string): Promise<Project | null> {
    return await safeFirestoreOperation(async (database) => {
      const docRef = database.collection(PROJECTS_COLLECTION).doc(projectId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return null;
      }

      return { id: docSnap.id, ...docSnap.data() } as Project;
    }, null);
  }

  async getBuildingsByProjectId(projectId: string): Promise<Building[]> {
    return await safeFirestoreOperation(async (database) => {
      // Using Firestore admin SDK methods correctly
      const buildingsCollection = database.collection(COLLECTIONS.BUILDINGS);
      const snapshot = await buildingsCollection.where(FIELDS.PROJECT_ID, '==', projectId).get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Building));
    }, []);
  }

  async getUnitsByBuildingId(buildingId: string): Promise<Property[]> {
    return await safeFirestoreOperation(async (database) => {
      // Using Firestore admin SDK methods correctly
      const unitsCollection = database.collection(COLLECTIONS.PROPERTIES);
      const snapshot = await unitsCollection.where(FIELDS.BUILDING_ID, '==', buildingId).get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Property));
    }, []);
  }

  async getContactsByIds(ids: string[]): Promise<Contact[]> {
    if (ids.length === 0) return [];

    return await safeFirestoreOperation(async (database) => {
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

  /**
   * 🏢 ENTERPRISE: Update project in Firestore using Firebase Admin SDK
   *
   * Pattern: SAP/Salesforce/Microsoft Dynamics - Server-side updates with validation
   *
   * @param projectId - The ID of the project to update
   * @param updates - Partial project data to update
   * @throws Error with descriptive message if update fails
   *
   * Security:
   * - Uses Firebase Admin SDK (server-side only)
   * - Bypasses Firestore Security Rules (admin privileges)
   * - Includes server-side validation before write
   *
   * @see https://firebase.google.com/docs/admin/setup
   */
  async updateProject(projectId: string, updates: ProjectUpdatePayload): Promise<void> {
    // 🏢 ENTERPRISE VALIDATION: Validate input parameters
    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: Project ID is required and must be a non-empty string');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('VALIDATION_ERROR: Updates must be a valid object');
    }

    // 🏢 ENTERPRISE: Validate individual fields if provided
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || updates.name.trim().length === 0) {
        throw new Error('VALIDATION_ERROR: Project name must be a non-empty string');
      }
    }

    if (updates.status !== undefined) {
      const validStatuses = ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'];
      if (!validStatuses.includes(updates.status)) {
        throw new Error(`VALIDATION_ERROR: Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return await safeFirestoreOperation(async (database) => {
      const { FieldValue } = await import('firebase-admin/firestore');

      // 🏢 ENTERPRISE: Verify document exists before update
      const docRef = database.collection(PROJECTS_COLLECTION).doc(projectId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new Error(`NOT_FOUND: Project with ID "${projectId}" does not exist`);
      }

      // 🏢 ENTERPRISE: Prepare update data with serverTimestamp
      // 🔒 ADR-232: companyId is IMMUTABLE (tenant key) — strip from updates
      const { companyId: _immutable, ...safeUpdates } = updates;
      const updateData: Record<string, unknown> = {
        ...safeUpdates,
        updatedAt: FieldValue.serverTimestamp()
      };

      // 🏢 ENTERPRISE: Remove undefined values (don't write undefined to Firestore)
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // 🏢 ENTERPRISE: Perform the update
      await docRef.update(updateData);

      logger.info(`Project updated: ${projectId}`, {
        updatedFields: Object.keys(updateData).filter(k => k !== 'updatedAt')
      });

    }, undefined);
  }
}