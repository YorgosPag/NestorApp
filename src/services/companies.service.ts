import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CompanyContact, Contact } from '@/types/contacts';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { getNavigationCompanyIds } from './navigation-companies.service';
// 🏢 ENTERPRISE: Removed server action import - use direct Firestore queries instead
// Server actions cannot be imported into client-side services
import { COLLECTIONS } from '@/config/firestore-collections';
import { LEGACY_TENANT_COMPANY_ID } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('CompaniesService');

// 🎯 PRODUCTION: DEBUG FLAG enabled temporarily for navigation investigation
const DEBUG_COMPANIES_SERVICE = true;

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;
const PROJECTS_COLLECTION = COLLECTIONS.PROJECTS;

// ✅ ENTERPRISE: Type guard για CompanyContact
function isCompanyContact(contact: Contact): contact is CompanyContact {
  return contact.type === 'company';
}

/**
 * Service για διαχείριση εταιριών
 * Επιστρέφει εταιρίες από τη contacts collection που έχουν type: 'company'
 */
export class CompaniesService {
  /**
   * Επιστρέφει εταιρείες που έχουν έργα συνδεμένα
   */
  async getCompaniesWithProjects(): Promise<string[]> {
    try {
      // Παίρνουμε όλες τις ενεργές εταιρείες
      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        where('type', '==', 'company'),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(companiesQuery);

      if (DEBUG_COMPANIES_SERVICE) {
        logger.info(`🔍 Total companies in Firestore (type=company, status=active): ${snapshot.docs.length}`);

        // DEBUGGING: Ελέγχουμε αν υπάρχουν εταιρείες χωρίς φίλτρα status
        const allCompaniesQuery = query(
          collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
          where('type', '==', 'company')
        );
        const allSnapshot = await getDocs(allCompaniesQuery);
        logger.info(`🔍 Total companies without status filter: ${allSnapshot.docs.length}`);

        allSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          const companyName = isCompanyContact(data) ? data.companyName : 'Unknown Company';
          logger.info(`🏢 Sample company: ${companyName} (status: ${data.status || 'UNDEFINED'})`);
        });
      }

      // 🚀 ENTERPRISE BATCH OPTIMIZATION: Single query για όλες τις εταιρείες
      const companyIds: string[] = [];
      // 🏢 ENTERPRISE: Proper type instead of any
      const companyMap = new Map<string, Contact>();

      // Build company map
      snapshot.docs.forEach(doc => {
        companyMap.set(doc.id, doc.data());
      });

      if (DEBUG_COMPANIES_SERVICE) {
        logger.info(`🔍 BATCH MODE: Checking ${snapshot.docs.length} companies for projects using single query...`);
      }

      try {
        // 💾 ENTERPRISE STRATEGY: Batch query ALL projects, then filter by company
        const projectsQuery = query(
          collection(db, PROJECTS_COLLECTION)
          // Note: Firestore doesn't support "IN" with more than 10 items, so we fetch all and filter
        );

        const projectsSnapshot = await getDocs(projectsQuery);

        if (DEBUG_COMPANIES_SERVICE) {
          logger.info(`🏗️ BATCH RESULT: Found ${projectsSnapshot.docs.length} total projects in database`);
        }

        // Group projects by companyId
        // 🏢 ENTERPRISE: Proper project type
        interface ProjectData {
          companyId?: string;
          name?: string;
          [key: string]: unknown;
        }
        const projectsByCompany = new Map<string, ProjectData[]>();
        projectsSnapshot.docs.forEach(projectDoc => {
          const projectData = projectDoc.data();
          const companyId = projectData.companyId;

          if (companyId && companyMap.has(companyId)) {
            if (!projectsByCompany.has(companyId)) {
              projectsByCompany.set(companyId, []);
            }
            projectsByCompany.get(companyId)!.push(projectData);
          }
        });

        // Process results for each company
        snapshot.docs.forEach(doc => {
          const companyId = doc.id;
          const companyData = doc.data();
          const companyProjects = projectsByCompany.get(companyId) || [];

          if (DEBUG_COMPANIES_SERVICE) {
            const companyName = isCompanyContact(companyData) ? companyData.companyName : 'Unknown Company';
            logger.info(`🏗️ Company ${companyId} (${companyName}) has ${companyProjects.length} projects:`, companyProjects.map(p => p.name || 'Unnamed') || []);
          }

          if (companyProjects.length > 0) {
            companyIds.push(companyId);
          }
        });

        if (DEBUG_COMPANIES_SERVICE) {
          logger.info(`🎯 BATCH COMPLETE: ${companyIds.length} companies with projects found`);
        }

      } catch (error) {
        // 🏢 ENTERPRISE: Batch mode is the only supported strategy
        // Server actions cannot be called from client-side services
        logger.error('❌ Batch project query failed:', error);
        // Return empty array - batch mode failure means no companies can be determined
      }

      return companyIds;
    } catch (error) {
      // Error logging removed //('Error finding companies with projects:', error);
      return [];
    }
  }

  /**
   * Επιστρέφει όλες τις ενεργές εταιρίες που είναι στην πλοήγηση
   * Περιλαμβάνει:
   * 1. Εταιρείες που έχουν έργα
   * 2. Εταιρείες που προστέθηκαν χειροκίνητα στην πλοήγηση
   */
  async getAllActiveCompanies(): Promise<CompanyContact[]> {
    try {
      if (DEBUG_COMPANIES_SERVICE) {
        // Debug logging removed - projectId check
      }

      // Παίρνουμε τα IDs εταιρειών που είναι στην πλοήγηση (χειροκίνητα)
      const navigationCompanyIds = await getNavigationCompanyIds();
      if (DEBUG_COMPANIES_SERVICE) {
        logger.info(`📍 Navigation Company IDs: ${navigationCompanyIds.length}`, navigationCompanyIds);
      }

      // Παίρνουμε τα IDs εταιρειών που έχουν έργα
      const companiesWithProjectIds = await this.getCompaniesWithProjects();
      if (DEBUG_COMPANIES_SERVICE) {
        logger.info(`🏗️ Companies with Projects: ${companiesWithProjectIds.length}`, companiesWithProjectIds);
      }

      // Συνδυάζουμε και τα δύο (unique values)
      // ΣΗΜΑΝΤΙΚΟ: Οι navigation companies έχουν προτεραιότητα
      const allRelevantCompanyIds = Array.from(new Set([
        ...navigationCompanyIds,
        ...companiesWithProjectIds
      ]));

      if (DEBUG_COMPANIES_SERVICE) {
        logger.info(`🎯 Total Relevant Company IDs: ${allRelevantCompanyIds.length}`, allRelevantCompanyIds);
      }

      // ΝΕΟ: Ακόμα κι αν δεν υπάρχουν companies με έργα,
      // θέλουμε να εμφανίσουμε τις navigation companies
      if (allRelevantCompanyIds.length === 0 && navigationCompanyIds.length === 0) {
        if (DEBUG_COMPANIES_SERVICE) {
          logger.info(`⚠️ No relevant companies found - returning empty array`);
        }
        return [];
      }

      // Παίρνουμε όλες τις ενεργές εταιρείες από contacts
      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        where('type', '==', 'company'),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(companiesQuery);
      const allCompanies = snapshot.docs
        .map(doc => {
          const data = doc.data();
          if (DEBUG_COMPANIES_SERVICE) {
            const companyName = isCompanyContact(data) ? (data as CompanyContact).companyName : 'Unknown Company';
            logger.info(`🏢 Company found in Firestore: ${data.id} - ${companyName} (status: ${data.status})`);
          }
          return data;
        })
        .filter((contact): contact is CompanyContact => contact.type === 'company');

      // Φιλτράρουμε μόνο τις εταιρείες που είναι relevant
      const relevantCompanies = allCompanies.filter(company => {
        const isRelevant = allRelevantCompanyIds.includes(company.id!);
        if (DEBUG_COMPANIES_SERVICE && company.id === LEGACY_TENANT_COMPANY_ID) {
          logger.info(`🔍 ΠΑΓΩΝΗΣ filtering check:`, {
            companyId: company.id,
            companyName: isCompanyContact(company) ? company.companyName : 'Unknown Company',
            isInRelevantIds: isRelevant,
            relevantIdsArray: allRelevantCompanyIds,
            companyExists: !!company.id
          });
        }
        return isRelevant;
      });

      if (DEBUG_COMPANIES_SERVICE) {
        logger.info(`🏢 Total companies from Firestore: ${allCompanies.length}`);
        logger.info(`🎯 Relevant companies: ${relevantCompanies.length}`);
        logger.info(`🔍 All company IDs from Firestore:`, allCompanies.map(c => c.id));
        logger.info(`🔍 Relevant company IDs array:`, allRelevantCompanyIds);
        logger.info(`🔍 Filtered relevant companies:`, relevantCompanies.map(c => {
          const companyName = isCompanyContact(c) ? c.companyName : 'Unknown Company';
          return `${c.id} - ${companyName}`;
        }));
      }

      return relevantCompanies;
    } catch (error) {
      // Error logging removed //('Error fetching companies:', error);
      return [];
    }
  }
  
  /**
   * Βρίσκει εταιρία με βάση το ID
   */
  async getCompanyById(companyId: string): Promise<CompanyContact | null> {
    try {
      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        where('type', '==', 'company'),
        where('__name__', '==', companyId)
      );

      const snapshot = await getDocs(companiesQuery);
      const doc = snapshot.docs[0];

      if (!doc) return null;

      const contact = doc.data();
      return contact.type === 'company' ? contact : null;
    } catch (error) {
      // Error logging removed //('Error fetching company by ID:', error);
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Βρίσκει εταιρία με βάση το όνομα
   *
   * Χρησιμοποιείται από admin routes (seed, populate) για database-driven
   * company lookup αντί για hardcoded IDs.
   *
   * @param companyName - Το ακριβές όνομα της εταιρίας (companyName field)
   * @returns CompanyContact ή null αν δεν βρεθεί
   *
   * @note Απαιτεί composite index: type + companyName
   */
  async getCompanyByName(companyName: string): Promise<CompanyContact | null> {
    try {
      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        where('type', '==', 'company'),
        where('companyName', '==', companyName)
      );

      const snapshot = await getDocs(companiesQuery);
      const doc = snapshot.docs[0];

      if (!doc) {
        if (DEBUG_COMPANIES_SERVICE) {
          logger.info(`🔍 Company not found by name: "${companyName}"`);
        }
        return null;
      }

      const contact = doc.data();
      if (DEBUG_COMPANIES_SERVICE) {
        logger.info(`✅ Company found by name: "${companyName}" → ID: ${doc.id}`);
      }

      return contact.type === 'company' ? contact : null;
    } catch (error) {
      logger.error(`🚨 Error fetching company by name "${companyName}":`, error);
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Επιστρέφει ΟΛΕΣ τις ενεργές εταιρείες χωρίς φίλτρο
   *
   * Χρήση: Select/Combobox dropdowns όπου ο χρήστης πρέπει να βλέπει
   * ΟΛΕΣ τις εταιρείες, όχι μόνο αυτές με projects ή στο navigation.
   *
   * Διαφορά από getAllActiveCompanies():
   * - getAllActiveCompanies() → μόνο navigation + with-projects
   * - getAllCompaniesForSelect() → ΟΛΕΣ οι ενεργές (type=company, status=active)
   */
  async getAllCompaniesForSelect(): Promise<CompanyContact[]> {
    try {
      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        where('type', '==', 'company'),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(companiesQuery);
      return snapshot.docs
        .map(doc => doc.data())
        .filter((contact): contact is CompanyContact => contact.type === 'company')
        .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || '', 'el'));
    } catch (error) {
      logger.error('Error fetching all companies for select', error);
      return [];
    }
  }

}

// Singleton instance
export const companiesService = new CompaniesService();

// Helper functions για εύκολη χρήση
export const getAllActiveCompanies = () => companiesService.getAllActiveCompanies();
export const getAllCompaniesForSelect = () => companiesService.getAllCompaniesForSelect();
export const getCompanyById = (companyId: string) => companiesService.getCompanyById(companyId);
export const getCompanyByName = (companyName: string) => companiesService.getCompanyByName(companyName);