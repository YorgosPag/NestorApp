/**
 * 🏢 ENTERPRISE DATA SERVICES - PRODUCTION READY
 *
 * Αντικατέστησε τα sample data με επαγγελματικά Firebase/Database services.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Contact, Project } from '@/types';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * 📞 Ανάκτηση επαφών από Firebase
 * Αντικατέστησε το sampleContacts με πραγματικά δεδομένα από τη βάση
 */
export async function getContacts(limitCount: number = 100): Promise<Contact[]> {
  try {
    const contactsQuery = query(
      collection(db, COLLECTIONS.CONTACTS),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(contactsQuery);

    const contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Contact[];

    console.log(`✅ Loaded ${contacts.length} real contacts from Firebase`);
    return contacts;

  } catch (error) {
    console.error('❌ Error fetching contacts from Firebase:', error);
    return []; // Επιστροφή κενού array αντί για mock data
  }
}

/**
 * 🏗️ Ανάκτηση projects από Firebase
 * Αντικατέστησε το mockProjects με πραγματικά δεδομένα από τη βάση
 */
export async function getProjects(limitCount: number = 100): Promise<Project[]> {
  try {
    const projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(projectsQuery);

    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Project[];

    console.log(`✅ Loaded ${projects.length} real projects from Firebase`);
    return projects;

  } catch (error) {
    console.error('❌ Error fetching projects from Firebase:', error);
    return []; // Επιστροφή κενού array αντί για mock data
  }
}

// 🚨 DEPRECATED: Αυτά τα exports διατηρούνται για backward compatibility
// αλλά θα πρέπει να αντικατασταθούν με async Firebase calls
export const sampleContacts: Contact[] = [];
export const mockProjects: Project[] = [];

// 📝 TODO: Αφαίρεση των deprecated exports όταν όλα τα αρχεία μετακινηθούν στο async API