import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getApp } from 'firebase/app';
import type { CompanyContact } from '@/types/contacts';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_COMPANIES_SERVICE = false;

const CONTACTS_COLLECTION = 'contacts';

/**
 * Service για διαχείριση εταιριών
 * Επιστρέφει εταιρίες από τη contacts collection που έχουν type: 'company'
 */
export class CompaniesService {
  /**
   * Επιστρέφει όλες τις ενεργές εταιρίες
   */
  async getAllActiveCompanies(): Promise<CompanyContact[]> {
    try {
      if (DEBUG_COMPANIES_SERVICE) console.log('🔥 CLIENT projectId:', getApp().options.projectId);
      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        where('type', '==', 'company'),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(companiesQuery);
      const companies = snapshot.docs
        .map(doc => {
          const data = doc.data();
          if (DEBUG_COMPANIES_SERVICE) console.log(`🏢 Firestore doc: ID=${doc.id}, Name=${data.companyName}, Type=${data.type}`);
          return data;
        })
        .filter((contact): contact is CompanyContact => contact.type === 'company');

      if (DEBUG_COMPANIES_SERVICE) console.log(`🏢 Total companies from Firestore: ${companies.length}`);
      return companies;
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