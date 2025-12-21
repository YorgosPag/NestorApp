import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getApp } from 'firebase/app';
import type { CompanyContact } from '@/types/contacts';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { getNavigationCompanyIds } from './navigation-companies.service';
import { getProjectsByCompanyId } from './projects.service';
import { COLLECTIONS } from '@/config/firestore-collections';

// 🎯 PRODUCTION: DEBUG FLAG enabled για διάγνωση του προβλήματος ΠΑΓΩΝΗΣ
const DEBUG_COMPANIES_SERVICE = true;

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;
const PROJECTS_COLLECTION = COLLECTIONS.PROJECTS;

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
        console.log(`🔍 Total companies in Firestore (type=company, status=active): ${snapshot.docs.length}`);

        // DEBUGGING: Ελέγχουμε αν υπάρχουν εταιρείες χωρίς φίλτρα status
        const allCompaniesQuery = query(
          collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
          where('type', '==', 'company')
        );
        const allSnapshot = await getDocs(allCompaniesQuery);
        console.log(`🔍 Total companies without status filter: ${allSnapshot.docs.length}`);

        allSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          console.log(`🏢 Sample company: ${data.companyName} (status: ${data.status || 'UNDEFINED'})`);
        });
      }

      // 🚀 ENTERPRISE BATCH OPTIMIZATION: Single query για όλες τις εταιρείες
      const companyIds: string[] = [];
      const companyMap = new Map<string, any>();

      // Build company map
      snapshot.docs.forEach(doc => {
        companyMap.set(doc.id, doc.data());
      });

      if (DEBUG_COMPANIES_SERVICE) {
        console.log(`🔍 BATCH MODE: Checking ${snapshot.docs.length} companies for projects using single query...`);
      }

      try {
        // 💾 ENTERPRISE STRATEGY: Batch query ALL projects, then filter by company
        const projectsQuery = query(
          collection(db, PROJECTS_COLLECTION)
          // Note: Firestore doesn't support "IN" with more than 10 items, so we fetch all and filter
        );

        const projectsSnapshot = await getDocs(projectsQuery);

        if (DEBUG_COMPANIES_SERVICE) {
          console.log(`🏗️ BATCH RESULT: Found ${projectsSnapshot.docs.length} total projects in database`);
        }

        // Group projects by companyId
        const projectsByCompany = new Map<string, any[]>();
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
            console.log(`🏗️ Company ${companyId} (${companyData.companyName}) has ${companyProjects.length} projects:`, companyProjects.map(p => p.name || 'Unnamed') || []);
          }

          if (companyProjects.length > 0) {
            companyIds.push(companyId);
          }
        });

        if (DEBUG_COMPANIES_SERVICE) {
          console.log(`🎯 BATCH COMPLETE: ${companyIds.length} companies with projects found`);
        }

      } catch (error) {
        console.error('❌ Batch project query failed, falling back to individual queries:', error);

        // Fallback to individual queries if batch fails
        for (const doc of snapshot.docs) {
          const companyId = doc.id;
          const companyData = doc.data();

          try {
            const projects = await getProjectsByCompanyId(companyId);
            if (projects && projects.length > 0) {
              companyIds.push(companyId);
            }
          } catch (error) {
            // Skip failed company checks
          }
        }
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
        console.log(`📍 Navigation Company IDs: ${navigationCompanyIds.length}`, navigationCompanyIds);
      }

      // Παίρνουμε τα IDs εταιρειών που έχουν έργα
      const companiesWithProjectIds = await this.getCompaniesWithProjects();
      if (DEBUG_COMPANIES_SERVICE) {
        console.log(`🏗️ Companies with Projects: ${companiesWithProjectIds.length}`, companiesWithProjectIds);
      }

      // Συνδυάζουμε και τα δύο (unique values)
      // ΣΗΜΑΝΤΙΚΟ: Οι navigation companies έχουν προτεραιότητα
      const allRelevantCompanyIds = Array.from(new Set([
        ...navigationCompanyIds,
        ...companiesWithProjectIds
      ]));

      if (DEBUG_COMPANIES_SERVICE) {
        console.log(`🎯 Total Relevant Company IDs: ${allRelevantCompanyIds.length}`, allRelevantCompanyIds);
      }

      // ΝΕΟ: Ακόμα κι αν δεν υπάρχουν companies με έργα,
      // θέλουμε να εμφανίσουμε τις navigation companies
      if (allRelevantCompanyIds.length === 0 && navigationCompanyIds.length === 0) {
        if (DEBUG_COMPANIES_SERVICE) {
          console.log(`⚠️ No relevant companies found - returning empty array`);
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
            console.log(`🏢 Company found in Firestore: ${data.id} - ${data.companyName} (status: ${data.status})`);
          }
          return data;
        })
        .filter((contact): contact is CompanyContact => contact.type === 'company');

      // Φιλτράρουμε μόνο τις εταιρείες που είναι relevant
      const relevantCompanies = allCompanies.filter(company => {
        const isRelevant = allRelevantCompanyIds.includes(company.id!);
        if (DEBUG_COMPANIES_SERVICE && company.id === 'pzNUy8ksddGCtcQMqumR') {
          console.log(`🔍 ΠΑΓΩΝΗΣ filtering check:`, {
            companyId: company.id,
            companyName: company.companyName,
            isInRelevantIds: isRelevant,
            relevantIdsArray: allRelevantCompanyIds,
            companyExists: !!company.id
          });
        }
        return isRelevant;
      });

      if (DEBUG_COMPANIES_SERVICE) {
        console.log(`🏢 Total companies from Firestore: ${allCompanies.length}`);
        console.log(`🎯 Relevant companies: ${relevantCompanies.length}`);
        console.log(`🔍 All company IDs from Firestore:`, allCompanies.map(c => c.id));
        console.log(`🔍 Relevant company IDs array:`, allRelevantCompanyIds);
        console.log(`🔍 Filtered relevant companies:`, relevantCompanies.map(c => `${c.id} - ${c.companyName}`));
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
  
}

// Singleton instance
export const companiesService = new CompaniesService();

// Helper functions για εύκολη χρήση
export const getAllActiveCompanies = () => companiesService.getAllActiveCompanies();
export const getCompanyById = (companyId: string) => companiesService.getCompanyById(companyId);