'use client';

/**
 * 🏢 ENTERPRISE: Real-time Properties Trash Count Hook
 *
 * Ζωντανός μετρητής των ήπια διαγραμμένων ακινήτων (`status === 'deleted'`).
 * Τροφοδοτεί το σήμα στο κουμπί κάδου της κεφαλίδας Ακινήτων.
 *
 * ⚠️ **Ο κύκλος ζωής της συνδρομής ΔΕΝ ζει εδώ** (ADR-798 §22) — ανήκει στο
 * `create-realtime-collection-hook.ts`, όπως και στα υπόλοιπα τέσσερα αδέλφια.
 *
 * 🔑 **ΓΙΑΤΙ ΔΕΝ ΕΚΘΕΤΕΙ `error` — ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ**: ένα σήμα
 * μετρητή δεν έχει πού να δείξει μήνυμα σφάλματος. Σε βλάβη η μηχανή περνά σε
 * `status: 'error'` — αυτό **είναι** το ορατό σήμα του — και το μήνυμα
 * καταγράφεται μία φορά, κεντρικά. Η μηχανή **παράγει** `error`· αυτό το hook
 * απλώς δεν το **δημοσιεύει**. Δημόσιο συμβόλαιο αμετάβλητο.
 *
 * @see ./create-realtime-collection-hook.ts
 */

import { useMemo } from 'react';
import { where, type QueryConstraint, type DocumentData } from 'firebase/firestore';
import type { SubscriptionStatus } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
import { createRealtimeCollectionHook } from './create-realtime-collection-hook';

const logger = createModuleLogger('useRealtimePropertiesTrashCount');

const DELETED_CONSTRAINTS: readonly QueryConstraint[] = [where('status', '==', 'deleted')];

export interface UseRealtimePropertiesTrashCountReturn {
  trashCount: number;
  loading: boolean;
  status: SubscriptionStatus;
}

// ============================================================================
// Η ΠΑΡΑΛΛΑΓΗ — ό,τι είναι γνήσια δικό του
// ============================================================================

/**
 * ⚠️ Χαρτογραφεί σε **ταυτότητες**, όχι σε πλήρη μοντέλα: ο καταναλωτής θέλει
 * **πλήθος**. Το «κενό αποτέλεσμα» της μηχανής (άδειος πίνακας) δίνει `0` —
 * ακριβώς η παλιά συμπεριφορά, χωρίς ξεχωριστό σχήμα κατάστασης.
 */
const useTrashedPropertiesCollection = createRealtimeCollectionHook<DocumentData, string>({
  collection: 'PROPERTIES',
  logger,
  constraints: DELETED_CONSTRAINTS,
  mapDocuments: (documents): string[] => documents.map((doc) => doc.id as string),
});

export function useRealtimePropertiesTrashCount(
  enabled = true
): UseRealtimePropertiesTrashCountReturn {
  const { items, loading, status } = useTrashedPropertiesCollection(enabled);

  return useMemo(
    () => ({ trashCount: items.length, loading, status }),
    [items, loading, status]
  );
}
