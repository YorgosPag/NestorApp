
'use client';

/**
 * 🏢 ENTERPRISE BUILDINGS & COMPANIES DATA SERVICES - PRODUCTION READY
 *
 * Αντικατέστησε τα sample data με επαγγελματικά Firebase/Database services.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Building } from '@/types/building/contracts';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * 🏗️ Ανάκτηση κτιρίων από Firebase
 * Αντικατέστησε τα sampleBuildings με πραγματικά δεδομένα από τη βάση
 */
export async function getBuildings(limitCount: number = 100): Promise<Building[]> {
  try {
    const buildingsQuery = query(
      collection(db, COLLECTIONS.BUILDINGS),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(buildingsQuery);

    const buildings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Building[];

    console.log(`✅ Loaded ${buildings.length} real buildings from Firebase`);
    return buildings;

  } catch (error) {
    console.error('❌ Error fetching buildings from Firebase:', error);
    return []; // Επιστροφή κενού array αντί για sample data
  }
}

/**
 * 🏢 Ανάκτηση εταιρειών από Firebase
 * Αντικατέστησε τα sampleCompanies με πραγματικά δεδομένα από τη βάση
 */
export async function getCompanies(limitCount: number = 50): Promise<Array<{id: string, name: string}>> {
  try {
    const companiesQuery = query(
      collection(db, COLLECTIONS.COMPANIES),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(companiesQuery);

    const companies = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.data().personal?.firstName + ' ' + doc.data().personal?.lastName || 'Εταιρεία'
    }));

    console.log(`✅ Loaded ${companies.length} real companies from Firebase`);
    return companies;

  } catch (error) {
    console.error('❌ Error fetching companies from Firebase:', error);
    return []; // Επιστροφή κενού array αντί για sample data
  }
}

/**
 * 🎯 Ανάκτηση έργων από Firebase
 * Αντικατέστησε τα sampleProjects με πραγματικά δεδομένα από τη βάση
 */
export async function getProjectsList(limitCount: number = 50): Promise<Array<{id: string, name: string}>> {
  try {
    // 🏢 ENTERPRISE: Query χωρίς orderBy('updatedAt') γιατί το field δεν υπάρχει σε όλα τα projects
    // Χρησιμοποιούμε orderBy('name') για αλφαβητική ταξινόμηση
    const projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      orderBy('name', 'asc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(projectsQuery);

    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().title || doc.data().name || 'Έργο'
    }));

    console.log(`✅ Loaded ${projects.length} real projects from Firebase`);
    return projects;

  } catch (error) {
    console.error('❌ Error fetching projects from Firebase:', error);
    return []; // Επιστροφή κενού array αντί για sample data
  }
}

// 🚨 DEPRECATED: Αυτά τα exports διατηρούνται για backward compatibility
// αλλά θα πρέπει να αντικατασταθούν με async Firebase calls
export const buildings: Building[] = [];
export const companies: Array<{id: string, name: string}> = [];
export const projects: Array<{id: string, name: string}> = [];

// 📝 TODO: Αφαίρεση των deprecated exports όταν όλα τα αρχεία μετακινηθούν στο async API
