import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CompanyContact, Contact } from '@/types/contacts';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { getNavigationCompanyIds } from './navigation-companies.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { requireAuthContext } from '@/services/firestore/auth-context';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CompaniesService');

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;
const PROJECTS_COLLECTION = COLLECTIONS.PROJECTS;

/** Lightweight shape for project data used in company-project grouping */
interface ProjectData {
  companyId?: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * 🔒 SPEC-259B: Builds tenant-scoped contacts query for company-type contacts.
 * Adds companyId filter for normal users. Super admin sees all.
 */
function buildCompanyContactsQuery(companyId: string | null, activeOnly: boolean = true) {
  const constraints = [where('type', '==', 'company')];
  if (activeOnly) {
    constraints.push(where('status', '==', 'active'));
  }
  if (companyId) {
    constraints.push(where('companyId', '==', companyId));
  }
  return query(
    collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
    ...constraints,
  );
}

/**
 * Service για διαχείριση εταιριών.
 * Επιστρέφει εταιρίες από τη contacts collection (type: 'company').
 *
 * 🔒 SPEC-259B: Κάθε public method καλεί requireAuthContext() (SSoT)
 * και φιλτράρει με companyId. Fail-closed pattern — κανένα method δεν
 * εκτελεί query χωρίς tenant context.
 */
export class CompaniesService {

  /**
   * Επιστρέφει company IDs που έχουν projects.
   * Private — καλείται μόνο από getAllActiveCompanies() που παρέχει tenant context.
   */
  private async getCompaniesWithProjects(companyId: string | null): Promise<string[]> {
    const companiesQuery = buildCompanyContactsQuery(companyId);
    const snapshot = await getDocs(companiesQuery);

    const companyMap = new Map<string, Contact>();
    snapshot.docs.forEach(doc => {
      companyMap.set(doc.id, doc.data());
    });

    const projectsQuery = companyId
      ? query(
          collection(db, PROJECTS_COLLECTION),
          where('companyId', '==', companyId),
        )
      : query(collection(db, PROJECTS_COLLECTION)); // super_admin — all projects

    const projectsSnapshot = await getDocs(projectsQuery);

    const projectsByCompany = new Map<string, ProjectData[]>();
    projectsSnapshot.docs.forEach(projectDoc => {
      const projectData = projectDoc.data();
      const projCompanyId = projectData.companyId;

      if (projCompanyId && companyMap.has(projCompanyId)) {
        if (!projectsByCompany.has(projCompanyId)) {
          projectsByCompany.set(projCompanyId, []);
        }
        projectsByCompany.get(projCompanyId)!.push(projectData);
      }
    });

    const companyIds: string[] = [];
    snapshot.docs.forEach(doc => {
      const projects = projectsByCompany.get(doc.id) || [];
      if (projects.length > 0) {
        companyIds.push(doc.id);
      }
    });

    return companyIds;
  }

  /**
   * Επιστρέφει όλες τις ενεργές εταιρίες στην πλοήγηση.
   * Περιλαμβάνει: εταιρείες με projects + χειροκίνητα στο navigation.
   */
  async getAllActiveCompanies(): Promise<CompanyContact[]> {
    try {
      const { companyId } = await requireAuthContext();

      const navigationCompanyIds = await getNavigationCompanyIds();
      const companiesWithProjectIds = await this.getCompaniesWithProjects(companyId);

      const allRelevantCompanyIds = Array.from(new Set([
        ...navigationCompanyIds,
        ...companiesWithProjectIds,
      ]));

      if (allRelevantCompanyIds.length === 0 && navigationCompanyIds.length === 0) {
        return [];
      }

      const companiesQuery = buildCompanyContactsQuery(companyId);
      const snapshot = await getDocs(companiesQuery);

      const allCompanies = snapshot.docs
        .map(doc => doc.data())
        .filter((contact): contact is CompanyContact => contact.type === 'company');

      return allCompanies.filter(company =>
        company.id != null && allRelevantCompanyIds.includes(company.id),
      );
    } catch (error) {
      logger.error('getAllActiveCompanies failed:', error);
      return [];
    }
  }

  /**
   * Βρίσκει εταιρία με βάση το ID.
   * 🔒 SPEC-259B: Tenant-scoped — companyId filter + Firestore rules (defense-in-depth).
   */
  async getCompanyById(targetId: string): Promise<CompanyContact | null> {
    try {
      const { companyId } = await requireAuthContext();

      const constraints = [
        where('type', '==', 'company'),
        where('__name__', '==', targetId),
      ];
      if (companyId) {
        constraints.push(where('companyId', '==', companyId));
      }

      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        ...constraints,
      );

      const snapshot = await getDocs(companiesQuery);
      const doc = snapshot.docs[0];
      if (!doc) return null;

      const contact = doc.data();
      return contact.type === 'company' ? contact : null;
    } catch (error) {
      logger.error('getCompanyById failed:', error);
      return null;
    }
  }

  /**
   * Βρίσκει εταιρία με βάση το όνομα.
   * Χρήση: admin routes (seed, populate).
   * @note Απαιτεί composite index: type + companyName
   */
  async getCompanyByName(companyName: string): Promise<CompanyContact | null> {
    try {
      const { companyId } = await requireAuthContext();

      const constraints = [
        where('type', '==', 'company'),
        where('companyName', '==', companyName),
      ];
      if (companyId) {
        constraints.push(where('companyId', '==', companyId));
      }

      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION).withConverter(contactConverter),
        ...constraints,
      );

      const snapshot = await getDocs(companiesQuery);
      const doc = snapshot.docs[0];
      if (!doc) return null;

      const contact = doc.data();
      return contact.type === 'company' ? contact : null;
    } catch (error) {
      logger.error(`getCompanyByName("${companyName}") failed:`, error);
      return null;
    }
  }

  /**
   * Επιστρέφει ΟΛΕΣ τις ενεργές εταιρείες (tenant-scoped).
   * Χρήση: Select/Combobox dropdowns.
   */
  async getAllCompaniesForSelect(): Promise<CompanyContact[]> {
    try {
      const { companyId } = await requireAuthContext();
      const companiesQuery = buildCompanyContactsQuery(companyId);

      const snapshot = await getDocs(companiesQuery);
      return snapshot.docs
        .map(doc => doc.data())
        .filter((contact): contact is CompanyContact => contact.type === 'company')
        .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || '', 'el'));
    } catch (error) {
      logger.error('getAllCompaniesForSelect failed:', error);
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
