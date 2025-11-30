import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Service για διαχείριση των εταιρειών που εμφανίζονται στην πλοήγηση
 * Κρατά track ποιες εταιρείες (από contacts) έχουν προστεθεί χειροκίνητα στην πλοήγηση
 */

export interface NavigationCompanyEntry {
  id?: string;
  contactId: string; // ID της εταιρείας από τη contacts collection
  addedAt: Date;
  addedBy?: string; // User ID που την πρόσθεσε
}

const NAVIGATION_COMPANIES_COLLECTION = 'navigation_companies';

export class NavigationCompaniesService {
  /**
   * Προσθήκη εταιρείας στην πλοήγηση
   */
  async addCompanyToNavigation(contactId: string, userId?: string): Promise<void> {
    try {
      // Ελέγχουμε αν υπάρχει ήδη
      const exists = await this.isCompanyInNavigation(contactId);
      if (exists) {
        console.log(`Company ${contactId} already in navigation`);
        return;
      }

      const entry: Omit<NavigationCompanyEntry, 'id'> = {
        contactId,
        addedAt: new Date(),
        ...(userId && { addedBy: userId })
      };

      await addDoc(collection(db, NAVIGATION_COMPANIES_COLLECTION), entry);
      console.log(`✅ Company ${contactId} added to navigation`);
    } catch (error) {
      console.error('Error adding company to navigation:', error);
      throw error;
    }
  }

  /**
   * Αφαίρεση εταιρείας από την πλοήγηση
   */
  async removeCompanyFromNavigation(contactId: string): Promise<void> {
    try {
      const q = query(
        collection(db, NAVIGATION_COMPANIES_COLLECTION),
        where('contactId', '==', contactId)
      );

      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log(`✅ Company ${contactId} removed from navigation`);
    } catch (error) {
      console.error('Error removing company from navigation:', error);
      throw error;
    }
  }

  /**
   * Έλεγχος αν εταιρεία είναι στην πλοήγηση
   */
  async isCompanyInNavigation(contactId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, NAVIGATION_COMPANIES_COLLECTION),
        where('contactId', '==', contactId)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking company in navigation:', error);
      return false;
    }
  }

  /**
   * Επιστρέφει όλα τα IDs εταιρειών που είναι στην πλοήγηση
   */
  async getNavigationCompanyIds(): Promise<string[]> {
    try {
      const q = query(collection(db, NAVIGATION_COMPANIES_COLLECTION));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data() as NavigationCompanyEntry;
        return data.contactId;
      });
    } catch (error) {
      console.error('Error fetching navigation company IDs:', error);
      return [];
    }
  }

  /**
   * Επιστρέφει όλες τις navigation company entries
   */
  async getAllNavigationCompanies(): Promise<NavigationCompanyEntry[]> {
    try {
      const q = query(collection(db, NAVIGATION_COMPANIES_COLLECTION));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as NavigationCompanyEntry));
    } catch (error) {
      console.error('Error fetching navigation companies:', error);
      return [];
    }
  }
}

// Singleton instance
export const navigationCompaniesService = new NavigationCompaniesService();

// Helper functions
export const addCompanyToNavigation = (contactId: string, userId?: string) =>
  navigationCompaniesService.addCompanyToNavigation(contactId, userId);

export const removeCompanyFromNavigation = (contactId: string) =>
  navigationCompaniesService.removeCompanyFromNavigation(contactId);

export const isCompanyInNavigation = (contactId: string) =>
  navigationCompaniesService.isCompanyInNavigation(contactId);

export const getNavigationCompanyIds = () =>
  navigationCompaniesService.getNavigationCompanyIds();