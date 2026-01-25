
'use client';

/**
 * 🏢 ENTERPRISE BUILDINGS & COMPANIES DATA SERVICES - PRODUCTION READY
 *
 * Αντικατέστησε τα sample data με επαγγελματικά Firebase/Database services.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import { collection, getDocs, query, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Building } from '@/types/building/contracts';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

/**
 * 🏗️ Ανάκτηση κτιρίων από Firebase
 * Αντικατέστησε τα sampleBuildings με πραγματικά δεδομένα από τη βάση
 */
export async function getBuildings(limitCount: number = 100): Promise<Building[]> {
  try {
    // 🏢 ENTERPRISE: Query χωρίς orderBy γιατί τα buildings έχουν μεικτούς τύπους στο updatedAt
    // (κάποια έχουν string, κάποια Firestore Timestamp - δεν μπορούν να ταξινομηθούν μαζί)
    console.log('🔍 [getBuildings] Starting Firestore query...');

    const buildingsRef = collection(db, COLLECTIONS.BUILDINGS);
    const snapshot = await getDocs(buildingsRef);

    const buildings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Building[];

    console.log(`✅ [getBuildings] Loaded ${buildings.length} buildings from Firebase`);
    console.log('🏢 [getBuildings] Building names:', buildings.map(b => b.name));
    return buildings;

  } catch (error) {
    console.error('❌ Error fetching buildings from Firebase:', error);
    return []; // Επιστροφή κενού array αντί για sample data
  }
}

/**
 * 🏢 ENTERPRISE: Building update payload type
 * Type-safe updates for building modifications
 */
export interface BuildingUpdatePayload {
  name?: string;
  description?: string;
  totalArea?: number;
  builtArea?: number;
  floors?: number;
  units?: number;
  totalValue?: number;
  startDate?: string;
  completionDate?: string;
  address?: string;
  city?: string;
  status?: string;
}

/**
 * 🏗️ ENTERPRISE: Ενημέρωση κτιρίου στο Firebase
 * Αποθηκεύει τα δεδομένα στη βάση και ενημερώνει το real-time service
 */
export async function updateBuilding(
  buildingId: string,
  updates: BuildingUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🏗️ [updateBuilding] Updating building ${buildingId}...`);

    const buildingRef = doc(db, COLLECTIONS.BUILDINGS, buildingId);
    await updateDoc(buildingRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ [updateBuilding] Building ${buildingId} updated successfully`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    // Dispatch event for all components to update their local state
    RealtimeService.dispatchBuildingUpdated({
      buildingId,
      updates: {
        name: updates.name,
        address: updates.address,
        city: updates.city,
        status: updates.status,
        totalArea: updates.totalArea,
        floors: updates.floors,
      },
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [updateBuilding] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
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

    // 🌐 i18n: Fallback text converted to i18n key - 2026-01-18
    const companies = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.data().personal?.firstName + ' ' + doc.data().personal?.lastName || 'entities.company.unknown'
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

    // 🌐 i18n: Fallback text converted to i18n key - 2026-01-18
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().title || doc.data().name || 'entities.project.unknown'
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
