/**
 * 📄 ENTERPRISE OBLIGATIONS REPOSITORY - PRODUCTION READY
 *
 * Αντικατέστησε το InMemoryObligationsRepository με επαγγελματικό FirestoreObligationsRepository.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ObligationDocument, ObligationTemplate, ObligationStatus } from '@/types/obligations';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/obligation-services';
import type { IObligationsRepository, SearchFilters, ObligationStats } from './contracts';
import { COLLECTIONS } from '@/config/firestore-collections';

export class FirestoreObligationsRepository implements IObligationsRepository {
  async getAll(): Promise<ObligationDocument[]> {
    try {
      const obligationsQuery = query(
        collection(db, COLLECTIONS.OBLIGATIONS),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(obligationsQuery);

      const obligations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        projectDetails: {
          ...doc.data().projectDetails,
          contractDate: doc.data().projectDetails?.contractDate?.toDate() || new Date(),
          deliveryDate: doc.data().projectDetails?.deliveryDate?.toDate() || new Date()
        }
      })) as ObligationDocument[];

      // 🎯 PRODUCTION: Μείωση logging verbosity για obligations/new page
      // console.log(`✅ Loaded ${obligations.length} real obligations from Firebase`);
      return obligations;
    } catch (error) {
      console.error('❌ Error fetching obligations from Firebase:', error);
      return [];
    }
  }

  async getById(id: string): Promise<ObligationDocument | null> {
    try {
      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();
      return {
        id: snapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        projectDetails: {
          ...data.projectDetails,
          contractDate: data.projectDetails?.contractDate?.toDate() || new Date(),
          deliveryDate: data.projectDetails?.deliveryDate?.toDate() || new Date()
        }
      } as ObligationDocument;
    } catch (error) {
      console.error('❌ Error fetching obligation by ID from Firebase:', error);
      return null;
    }
  }

  async create(data: Partial<ObligationDocument>): Promise<ObligationDocument> {
    try {
      const newObligation: Omit<ObligationDocument, 'id'> = {
        title: data.title || "",
        projectName: data.projectName || "",
        // 🏢 ENTERPRISE: Use environment configuration, not hardcoded company name
        contractorCompany: data.contractorCompany || process.env.NEXT_PUBLIC_COMPANY_NAME || "Contractor Company",
        owners: data.owners || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        sections: data.sections || DEFAULT_TEMPLATE_SECTIONS,
        projectDetails: data.projectDetails || { location: "", address: "" }
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.OBLIGATIONS), newObligation);

      return {
        id: docRef.id,
        ...newObligation
      };
    } catch (error) {
      console.error('❌ Error creating obligation in Firebase:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<ObligationDocument>): Promise<ObligationDocument | null> {
    try {
      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      await updateDoc(docRef, updateData);

      // Return the updated document
      return await this.getById(id);
    } catch (error) {
      console.error('❌ Error updating obligation in Firebase:', error);
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('❌ Error deleting obligation from Firebase:', error);
      return false;
    }
  }
  
  async bulkDelete(ids: string[]): Promise<number> {
    try {
      let deletedCount = 0;
      for (const id of ids) {
        const success = await this.delete(id);
        if (success) deletedCount++;
      }
      return deletedCount;
    } catch (error) {
      console.error('❌ Error bulk deleting obligations from Firebase:', error);
      return 0;
    }
  }

  async duplicate(id: string): Promise<ObligationDocument | null> {
    try {
      const original = await this.getById(id);
      if (!original) return null;

      const duplicate = {
        ...original,
        title: `${original.title} - Αντίγραφο`,
        status: "draft" as ObligationStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        sections: original.sections.map(section => ({
          ...section,
          id: `${section.id}-copy-${Date.now()}`
        }))
      };

      // 🏢 ENTERPRISE: Type-safe ID removal using destructuring
      const { id: _removedId, ...duplicateWithoutId } = duplicate;
      return await this.create(duplicateWithoutId);
    } catch (error) {
      console.error('❌ Error duplicating obligation in Firebase:', error);
      return null;
    }
  }

  async updateStatus(id: string, status: ObligationStatus): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      await updateDoc(docRef, {
        status,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error('❌ Error updating obligation status in Firebase:', error);
      return false;
    }
  }

  async getTemplates(): Promise<ObligationTemplate[]> {
    try {
      const templatesQuery = query(
        collection(db, COLLECTIONS.OBLIGATION_TEMPLATES),
        orderBy('isDefault', 'desc')
      );

      const snapshot = await getDocs(templatesQuery);

      const templates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ObligationTemplate[];

      // If no templates in Firebase, return default ones
      if (templates.length === 0) {
        return [
          { id: "default", name: `Βασικό Πρότυπο ${process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company'}`, description: "Βασικές ενότητες συγγραφής υποχρεώσεων.", sections: DEFAULT_TEMPLATE_SECTIONS, isDefault: true },
          { id: "minimal", name: "Ελάχιστο Πρότυπο", description: "Μόνο τα απαραίτητα άρθρα για απλά έργα.", sections: DEFAULT_TEMPLATE_SECTIONS.slice(0, 3), isDefault: false }
        ];
      }

      return templates;
    } catch (error) {
      console.error('❌ Error fetching templates from Firebase:', error);
      return [
        { id: "default", name: `Βασικό Πρότυπο ${process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company'}`, description: "Βασικές ενότητες συγγραφής υποχρεώσεων.", sections: DEFAULT_TEMPLATE_SECTIONS, isDefault: true }
      ];
    }
  }

  async search(query: string, filters?: SearchFilters): Promise<ObligationDocument[]> {
    try {
      // Start with base query
      const baseQuery = collection(db, COLLECTIONS.OBLIGATIONS);
      // 🏢 ENTERPRISE: Type-safe query constraints
      const constraints: QueryConstraint[] = [];

      // Add status filter if provided
      if (filters?.status && filters.status !== "all") {
        constraints.push(where('status', '==', filters.status));
      }

      // Add date filters if provided
      if (filters?.dateFrom) {
        constraints.push(where('createdAt', '>=', filters.dateFrom));
      }
      if (filters?.dateTo) {
        constraints.push(where('createdAt', '<=', filters.dateTo));
      }

      // Add ordering
      constraints.push(orderBy('updatedAt', 'desc'));

      const searchQuery = query(
        baseQuery,
        ...constraints
      );

      const snapshot = await getDocs(searchQuery);

      let results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        projectDetails: {
          ...doc.data().projectDetails,
          contractDate: doc.data().projectDetails?.contractDate?.toDate() || new Date(),
          deliveryDate: doc.data().projectDetails?.deliveryDate?.toDate() || new Date()
        }
      })) as ObligationDocument[];

      // Apply text search filter (Firebase doesn't support full-text search natively)
      if (query.trim()) {
        const searchTerm = query.toLowerCase();
        results = results.filter(o =>
          o.title.toLowerCase().includes(searchTerm) ||
          o.projectName.toLowerCase().includes(searchTerm) ||
          o.contractorCompany.toLowerCase().includes(searchTerm) ||
          o.owners.some(owner => owner.name.toLowerCase().includes(searchTerm))
        );
      }

      return results;
    } catch (error) {
      console.error('❌ Error searching obligations in Firebase:', error);
      return [];
    }
  }

  async getStatistics(): Promise<ObligationStats> {
    try {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all obligations for statistics
      const allObligations = await this.getAll();

      return {
        total: allObligations.length,
        draft: allObligations.filter(o => o.status === "draft").length,
        completed: allObligations.filter(o => o.status === "completed").length,
        approved: allObligations.filter(o => o.status === "approved").length,
        thisMonth: allObligations.filter(o => o.createdAt >= thisMonth).length
      };
    } catch (error) {
      console.error('❌ Error getting statistics from Firebase:', error);
      return {
        total: 0,
        draft: 0,
        completed: 0,
        approved: 0,
        thisMonth: 0
      };
    }
  }
  
  async exportToPDF(id: string): Promise<Blob> {
    throw new Error("📝 PDF export not implemented yet - will be added in future update");
  }
}

// 🚨 DEPRECATED: Keep InMemoryObligationsRepository for backward compatibility
export class InMemoryObligationsRepository extends FirestoreObligationsRepository {
  constructor() {
    super();
    // 🎯 PRODUCTION: Αφαίρεση deprecation warning για καθαρότερη κονσόλα
    // console.warn('🚨 InMemoryObligationsRepository is deprecated! Use FirestoreObligationsRepository instead.');
  }
}
