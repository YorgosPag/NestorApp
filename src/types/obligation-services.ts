/**
 * 📄 ENTERPRISE OBLIGATIONS TEMPLATES - PRODUCTION READY
 *
 * Αντικατέστησε τα mock templates με επαγγελματικά Firebase/Database services.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ObligationSection, ObligationDocument } from './obligations';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('obligation-services');

/**
 * 📋 Ανάκτηση obligation templates από Firebase
 * Αντικατέστησε τα MOCK_SECTIONS με πραγματικά δεδομένα από τη βάση
 */
export async function getObligationTemplates(limitCount: number = 50): Promise<ObligationSection[]> {
  try {
    const templatesQuery = query(
      collection(db, COLLECTIONS.OBLIGATION_TEMPLATES),
      orderBy('order', 'asc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(templatesQuery);

    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ObligationSection[];

    logger.info(`Loaded ${templates.length} real obligation templates from Firebase`);
    return templates;

  } catch (error) {
    logger.error('Error fetching obligation templates from Firebase', { error });
    // Fallback to default template
    return DEFAULT_TEMPLATE_SECTIONS;
  }
}

/**
 * 📝 Ανάκτηση obligations από Firebase
 * Αντικατέστησε τα MOCK_OBLIGATIONS με πραγματικά δεδομένα από τη βάση
 */
export async function getObligations(limitCount: number = 100): Promise<ObligationDocument[]> {
  try {
    const obligationsQuery = query(
      collection(db, COLLECTIONS.OBLIGATIONS),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
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

    logger.info(`Loaded ${obligations.length} real obligations from Firebase`);
    return obligations;

  } catch (error) {
    logger.error('Error fetching obligations from Firebase', { error });
    return []; // Επιστροφή κενού array αντί για mock data
  }
}

// DEFAULT TEMPLATE — Πλήρης Γενική Συγγραφή Υποχρεώσεων (28 Άρθρα)
import { GENERAL_CONSTRUCTION_TEMPLATE } from './obligations/default-template';
export const DEFAULT_TEMPLATE_SECTIONS: ObligationSection[] = GENERAL_CONSTRUCTION_TEMPLATE;

/** @deprecated Χρησιμοποίησε async Firebase calls */
export const MOCK_SECTIONS: ObligationSection[] = [];
export const MOCK_OBLIGATIONS: ObligationDocument[] = [];
export const COMPLETE_SECTIONS: ObligationSection[] = [];
