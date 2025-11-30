import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getApp } from 'firebase/app';
import type { CompanyContact } from '@/types/contacts';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { getNavigationCompanyIds } from './navigation-companies.service';
import { getProjectsByCompanyId } from './projects.service';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_COMPANIES_SERVICE = true;

const CONTACTS_COLLECTION = 'contacts';

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
      const companyIds: string[] = [];

      // Ελέγχουμε για κάθε εταιρεία αν έχει έργα
      for (const doc of snapshot.docs) {
        const companyId = doc.id;
        const companyData = doc.data();

        if (DEBUG_COMPANIES_SERVICE) {
          console.log(`🔍 Checking company: ${companyId} - ${companyData.companyName}`);
        }

        try {
          const projects = await getProjectsByCompanyId(companyId);
          if (DEBUG_COMPANIES_SERVICE) {
            console.log(`🏗️ Company ${companyId} (${companyData.companyName}) has ${projects?.length || 0} projects:`, projects?.map(p => p.name) || []);
          }

          if (projects && projects.length > 0) {
            companyIds.push(companyId);
          }
        } catch (error) {
          if (DEBUG_COMPANIES_SERVICE) {
            console.log(`⚠️ Failed to check projects for company ${companyId} (${companyData.companyName}):`, error);
          }
        }
      }

      return companyIds;
    } catch (error) {
      console.error('Error finding companies with projects:', error);
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
      if (DEBUG_COMPANIES_SERVICE) console.log('🔥 CLIENT projectId:', getApp().options.projectId);

      // Παίρνουμε τα IDs εταιρειών που είναι στην πλοήγηση (χειροκίνητα)
      const navigationCompanyIds = await getNavigationCompanyIds();
      if (DEBUG_COMPANIES_SERVICE) console.log('📍 Navigation company IDs:', navigationCompanyIds);

      // Παίρνουμε τα IDs εταιρειών που έχουν έργα
      const companiesWithProjectIds = await this.getCompaniesWithProjects();
      if (DEBUG_COMPANIES_SERVICE) console.log('🏗️ Companies with projects:', companiesWithProjectIds);

      // Συνδυάζουμε και τα δύο (unique values)
      // ΣΗΜΑΝΤΙΚΟ: Οι navigation companies έχουν προτεραιότητα
      const allRelevantCompanyIds = Array.from(new Set([
        ...navigationCompanyIds,
        ...companiesWithProjectIds
      ]));

      if (DEBUG_COMPANIES_SERVICE) console.log('🎯 All relevant company IDs:', allRelevantCompanyIds);

      // ΝΕΟ: Ακόμα κι αν δεν υπάρχουν companies με έργα,
      // θέλουμε να εμφανίσουμε τις navigation companies
      if (allRelevantCompanyIds.length === 0 && navigationCompanyIds.length === 0) {
        if (DEBUG_COMPANIES_SERVICE) console.log('📍 No relevant companies, returning empty array');
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
          if (DEBUG_COMPANIES_SERVICE) console.log(`🏢 Firestore doc: ID=${doc.id}, Name=${data.companyName}, Type=${data.type}`);
          return data;
        })
        .filter((contact): contact is CompanyContact => contact.type === 'company');

      // Φιλτράρουμε μόνο τις εταιρείες που είναι relevant
      const relevantCompanies = allCompanies.filter(company =>
        allRelevantCompanyIds.includes(company.id!)
      );

      if (DEBUG_COMPANIES_SERVICE) {
        console.log(`🏢 Total companies from Firestore: ${allCompanies.length}`);
        console.log(`🎯 Relevant companies: ${relevantCompanies.length}`);
      }

      return relevantCompanies;
    } catch (error) {
      console.error('Error fetching companies:', error);
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
      console.error('Error fetching company by ID:', error);
      return null;
    }
  }
  
}

// Singleton instance
export const companiesService = new CompaniesService();

// Helper functions για εύκολη χρήση
export const getAllActiveCompanies = () => companiesService.getAllActiveCompanies();
export const getCompanyById = (companyId: string) => companiesService.getCompanyById(companyId);