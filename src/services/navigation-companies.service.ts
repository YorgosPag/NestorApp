import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationCompaniesService');

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

// 🏢 ENTERPRISE: Centralized collection configuration
const NAVIGATION_COMPANIES_COLLECTION = COLLECTIONS.NAVIGATION;

export class NavigationCompaniesService {
  /**
   * 🏢 Προσθήκη εταιρείας στην πλοήγηση με cache invalidation
   */
  async addCompanyToNavigation(contactId: string, userId?: string): Promise<void> {
    try {
      // Ελέγχουμε αν υπάρχει ήδη
      const exists = await this.isCompanyInNavigation(contactId);
      if (exists) {
        // Debug logging removed //(`Company ${contactId} already in navigation`);
        return;
      }

      const entry: Omit<NavigationCompanyEntry, 'id'> = {
        contactId,
        addedAt: new Date(),
        ...(userId && { addedBy: userId })
      };

      const { generateNavigationId } = await import('@/services/enterprise-id.service');
      const enterpriseId = generateNavigationId();
      const docRef = doc(db, NAVIGATION_COMPANIES_COLLECTION, enterpriseId);
      await setDoc(docRef, entry);

      // 🗑️ PERFORMANCE: Clear cache after modification
      this.clearCache();

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('WORKSPACE_UPDATED', {
        workspaceId: 'navigation',
        updates: {
          settings: {
            action: 'company_added',
            contactId,
          }
        },
        timestamp: Date.now(),
      });

      // Debug logging removed //(`✅ Company ${contactId} added to navigation`);
    } catch (error) {
      // Error logging removed //('Error adding company to navigation:', error);
      throw error;
    }
  }

  /**
   * 🗑️ Αφαίρεση εταιρείας από την πλοήγηση με cache invalidation
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

      // 🗑️ PERFORMANCE: Clear cache after modification
      this.clearCache();

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('WORKSPACE_UPDATED', {
        workspaceId: 'navigation',
        updates: {
          settings: {
            action: 'company_removed',
            contactId,
          }
        },
        timestamp: Date.now(),
      });

      // Debug logging removed //(`✅ Company ${contactId} removed from navigation`);
    } catch (error) {
      // Error logging removed //('Error removing company from navigation:', error);
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
      // Error logging removed //('Error checking company in navigation:', error);
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE CACHING: Επιστρέφει όλα τα IDs εταιρειών που είναι στην πλοήγηση
   *
   * @performance Implements memory caching για αποφυγή duplicate queries
   * @cache 5 λεπτών TTL για real-time consistency
   */
  private static navigationCache: {
    data: string[] | null;
    timestamp: number;
    ttl: number;
  } = {
    data: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000, // 5 λεπτά cache
  };

  async getNavigationCompanyIds(): Promise<string[]> {
    try {
      // 🚀 PERFORMANCE: Check cache first
      const now = Date.now();
      const cache = NavigationCompaniesService.navigationCache;

      if (cache.data && (now - cache.timestamp) < cache.ttl) {
        // console.log(`🧭 CACHE HIT: Returning ${cache.data.length} cached navigation company IDs`);
        return cache.data;
      }

      // 🔄 Cache miss - fetch from Firestore
      const q = query(collection(db, NAVIGATION_COMPANIES_COLLECTION));
      const snapshot = await getDocs(q);

      // 🎯 PRODUCTION: Μείωση logging verbosity για obligations/new page
      // console.log(`🧭 CACHE MISS: ${NAVIGATION_COMPANIES_COLLECTION} collection has ${snapshot.docs.length} documents`);

      const contactIds = snapshot.docs.map(doc => {
        const data = doc.data() as NavigationCompanyEntry;
        // 🎯 PRODUCTION: Αφαίρεση debug logs για καθαρότερη κονσόλα
        // console.log(`🧭 DEBUG: navigation entry - contactId: ${data.contactId}, addedBy: ${data.addedBy}`);
        return data.contactId;
      });

      // 💾 Update cache
      cache.data = contactIds;
      cache.timestamp = now;

      return contactIds;
    } catch (error) {
      logger.error('Error fetching navigation company IDs', { error });
      return [];
    }
  }

  /**
   * 🗑️ CACHE MANAGEMENT: Clear cache when navigation changes
   * Καλείται όταν προστίθενται/αφαιρούνται εταιρείες
   */
  private clearCache(): void {
    NavigationCompaniesService.navigationCache.data = null;
    NavigationCompaniesService.navigationCache.timestamp = 0;
    // console.log('🧭 Cache cleared');
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
      // Error logging removed //('Error fetching navigation companies:', error);
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
