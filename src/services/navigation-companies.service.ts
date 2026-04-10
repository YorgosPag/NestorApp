import { collection, query, where, getDocs, doc, setDoc, deleteDoc, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { requireAuthContext } from '@/services/firestore/auth-context';

const logger = createModuleLogger('NavigationCompaniesService');

/**
 * Service για διαχείριση των εταιρειών που εμφανίζονται στην πλοήγηση
 * Κρατά track ποιες εταιρείες (από contacts) έχουν προστεθεί χειροκίνητα στην πλοήγηση
 *
 * 🔒 SPEC-259B: Κάθε public method καλεί requireAuthContext() (SSoT)
 * και φιλτράρει με companyId. Super admin (null companyId) βλέπει όλα.
 */

export interface NavigationCompanyEntry {
  id?: string;
  contactId: string; // ID της εταιρείας από τη contacts collection
  companyId: string | null; // 🔒 Tenant isolation (null = super_admin global entry)
  addedAt: Date;
  addedBy?: string; // User ID που την πρόσθεσε
}

const SUPER_ADMIN_CACHE_KEY = '__super_admin__';

// 🏢 ENTERPRISE: Centralized collection configuration
const NAVIGATION_COMPANIES_COLLECTION = COLLECTIONS.NAVIGATION;

export class NavigationCompaniesService {
  /**
   * 🏢 Προσθήκη εταιρείας στην πλοήγηση με cache invalidation
   */
  async addCompanyToNavigation(contactId: string, userId?: string): Promise<void> {
    try {
      const { companyId } = await requireAuthContext();

      // Ελέγχουμε αν υπάρχει ήδη
      const exists = await this.isCompanyInNavigation(contactId);
      if (exists) {
        // Debug logging removed //(`Company ${contactId} already in navigation`);
        return;
      }

      const entry: Omit<NavigationCompanyEntry, 'id'> = {
        contactId,
        companyId,
        addedAt: new Date(),
        ...(userId && { addedBy: userId })
      };

      const { generateNavigationId } = await import('@/services/enterprise-id.service');
      const enterpriseId = generateNavigationId();
      const docRef = doc(db, NAVIGATION_COMPANIES_COLLECTION, enterpriseId);
      await setDoc(docRef, entry);

      // 🗑️ PERFORMANCE: Clear cache after modification
      this.clearCache(companyId);

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
      const { companyId } = await requireAuthContext();

      const constraints: QueryConstraint[] = [where('contactId', '==', contactId)];
      if (companyId) {
        constraints.push(where('companyId', '==', companyId));
      }
      const q = query(
        collection(db, NAVIGATION_COMPANIES_COLLECTION),
        ...constraints,
      );

      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // 🗑️ PERFORMANCE: Clear cache after modification
      this.clearCache(companyId);

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
      const { companyId } = await requireAuthContext();

      const constraints: QueryConstraint[] = [where('contactId', '==', contactId)];
      if (companyId) {
        constraints.push(where('companyId', '==', companyId));
      }
      const q = query(
        collection(db, NAVIGATION_COMPANIES_COLLECTION),
        ...constraints,
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
   * @cache 5 λεπτών TTL per-tenant για real-time consistency + tenant isolation
   */
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static navigationCache: Map<string, { data: string[]; timestamp: number }> = new Map();

  async getNavigationCompanyIds(): Promise<string[]> {
    try {
      const { companyId } = await requireAuthContext();
      const cacheKey = companyId ?? SUPER_ADMIN_CACHE_KEY;

      // 🚀 PERFORMANCE: Check per-tenant cache first
      const now = Date.now();
      const cached = NavigationCompaniesService.navigationCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < NavigationCompaniesService.CACHE_TTL_MS) {
        return cached.data;
      }

      // 🔄 Cache miss - fetch from Firestore (tenant-scoped)
      const q = companyId
        ? query(
            collection(db, NAVIGATION_COMPANIES_COLLECTION),
            where('companyId', '==', companyId),
          )
        : query(collection(db, NAVIGATION_COMPANIES_COLLECTION)); // super_admin: all tenants
      const snapshot = await getDocs(q);

      const contactIds = snapshot.docs.map(d => {
        const data = d.data() as NavigationCompanyEntry;
        return data.contactId;
      });

      // 💾 Update per-tenant cache
      NavigationCompaniesService.navigationCache.set(cacheKey, { data: contactIds, timestamp: now });

      return contactIds;
    } catch (error) {
      logger.error('Error fetching navigation company IDs', { error });
      return [];
    }
  }

  /**
   * 🗑️ CACHE MANAGEMENT: Clear per-tenant cache when navigation changes
   */
  private clearCache(companyId: string | null): void {
    const cacheKey = companyId ?? SUPER_ADMIN_CACHE_KEY;
    NavigationCompaniesService.navigationCache.delete(cacheKey);
  }

  /**
   * Επιστρέφει όλες τις navigation company entries (tenant-scoped)
   */
  async getAllNavigationCompanies(): Promise<NavigationCompanyEntry[]> {
    try {
      const { companyId } = await requireAuthContext();

      const q = companyId
        ? query(
            collection(db, NAVIGATION_COMPANIES_COLLECTION),
            where('companyId', '==', companyId),
          )
        : query(collection(db, NAVIGATION_COMPANIES_COLLECTION)); // super_admin: all tenants
      const snapshot = await getDocs(q);

      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
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
