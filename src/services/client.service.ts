/**
 * =============================================================================
 * ClientService — Πελάτης/Αγοραστής Guard Queries
 * =============================================================================
 *
 * Ελέγχει αν μια επαφή-πελάτης έχει ενεργές αγορές (μονάδες, parking, αποθήκες)
 * που εμποδίζουν την αφαίρεση της ιδιότητας «Πελάτης».
 *
 * @module services/client.service
 * @enterprise ADR-121 - Contact Persona System (Client Guard)
 */

import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ClientService');

/** Result of checking a contact's active unit purchases */
interface ActiveUnitsResult {
  hasUnits: boolean;
  hasParking: boolean;
  hasStorage: boolean;
}

/**
 * 🏢 ClientService — Guard service for client persona removal
 *
 * Pattern: Same fail-open approach as BrokerageService.hasActiveRecords()
 */
export class ClientService {
  /**
   * Check if a contact has active purchased units, parking spots, or storage units.
   *
   * Queries 3 collections in parallel:
   * - units (ownerContactIds array-contains)
   * - parking_spots (ownerContactIds array-contains)
   * - storage_units (ownerContactIds array-contains)
   *
   * @param contactId - The contact's Firestore document ID
   * @returns Object indicating which collection types have active records
   */
  static async hasActiveUnits(contactId: string): Promise<ActiveUnitsResult> {
    try {
      const [unitsSnap, parkingSnap, storageSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, COLLECTIONS.PROPERTIES),
            where('commercial.ownerContactIds', 'array-contains', contactId),
            limit(1)
          )
        ),
        getDocs(
          query(
            collection(db, COLLECTIONS.PARKING_SPACES),
            where('commercial.ownerContactIds', 'array-contains', contactId),
            limit(1)
          )
        ),
        getDocs(
          query(
            collection(db, COLLECTIONS.STORAGE),
            where('commercial.ownerContactIds', 'array-contains', contactId),
            limit(1)
          )
        ),
      ]);

      return {
        hasUnits: !unitsSnap.empty,
        hasParking: !parkingSnap.empty,
        hasStorage: !storageSnap.empty,
      };
    } catch (error) {
      logger.warn('[ClientService] hasActiveUnits check failed — allowing removal:', error);
      // Fail open: if check fails (e.g., permission issues), allow removal
      return { hasUnits: false, hasParking: false, hasStorage: false };
    }
  }
}
