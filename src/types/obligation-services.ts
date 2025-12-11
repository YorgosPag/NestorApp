/**
 * 📄 ENTERPRISE OBLIGATIONS TEMPLATES - PRODUCTION READY
 *
 * Αντικατέστησε τα mock templates με επαγγελματικά Firebase/Database services.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ObligationSection, ObligationDocument } from './obligations';

/**
 * 📋 Ανάκτηση obligation templates από Firebase
 * Αντικατέστησε τα MOCK_SECTIONS με πραγματικά δεδομένα από τη βάση
 */
export async function getObligationTemplates(limitCount: number = 50): Promise<ObligationSection[]> {
  try {
    const templatesQuery = query(
      collection(db, 'obligationTemplates'),
      orderBy('order', 'asc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(templatesQuery);

    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ObligationSection[];

    console.log(`✅ Loaded ${templates.length} real obligation templates from Firebase`);
    return templates;

  } catch (error) {
    console.error('❌ Error fetching obligation templates from Firebase:', error);
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
      collection(db, 'obligations'),
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

    console.log(`✅ Loaded ${obligations.length} real obligations from Firebase`);
    return obligations;

  } catch (error) {
    console.error('❌ Error fetching obligations from Firebase:', error);
    return []; // Επιστροφή κενού array αντί για mock data
  }
}

// 🏗️ DEFAULT TEMPLATE - για νέες συγγραφές όταν δεν υπάρχουν templates στη βάση
export const DEFAULT_TEMPLATE_SECTIONS: ObligationSection[] = [
  {
    id: 'building-terms',
    number: '1',
    title: 'ΟΡΟΙ ΔΟΜΗΣΗΣ',
    content: `Όλες οι εργασίες θα εκτελεσθούν σύμφωνα με:

• τα εγκεκριμένα σχέδια των μελετών
• την συγγραφή υποχρεώσεων
• την τεχνική περιγραφή
• τις ισχύουσες πολεοδομικές διατάξεις
• τον αντισεισμικό κανονισμό`,
    isRequired: true,
    category: 'general',
    order: 1
  },
  {
    id: 'delivery-time',
    number: '2',
    title: 'ΧΡΟΝΟΣ ΠΑΡΑΔΟΣΗΣ',
    content: `Ως χρόνος παράδοσης του κτιρίου ορίζεται ο αναφερόμενος στο συμβόλαιο.

Η παράδοση κάθε κατοικίας θα γίνεται με αντίστοιχο πρωτόκολλο παράδοσης και παραλαβής.`,
    isRequired: true,
    category: 'general',
    order: 2
  },
  {
    id: 'execution-materials',
    number: '3',
    title: 'ΕΚΤΕΛΕΣΗ - ΥΛΙΚΑ',
    content: `Οι εργασίες θα εκτελεσθούν με μέριμνα και δαπάνες της εργολάβου εταιρείας, με υλικά αρίστης ποιότητας.

Η εργολάβος εταιρεία έχει το δικαίωμα να καθορίζει τα υλικά που θα χρησιμοποιηθούν.`,
    isRequired: true,
    category: 'materials',
    order: 3
  }
];

// 🚨 DEPRECATED: Αυτά τα exports διατηρούνται για backward compatibility
// αλλά θα πρέπει να αντικατασταθούν με async Firebase calls
export const MOCK_SECTIONS: ObligationSection[] = [];
export const MOCK_OBLIGATIONS: ObligationDocument[] = [];
export const COMPLETE_SECTIONS: ObligationSection[] = [];

// 📝 TODO: Αφαίρεση των deprecated exports όταν όλα τα αρχεία μετακινηθούν στο async API
