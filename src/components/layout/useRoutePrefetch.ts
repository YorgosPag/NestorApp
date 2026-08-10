'use client';

/**
 * 🚀 ENTERPRISE: Route prefetching κατά την προσάρτηση του κελύφους.
 *
 * ΜΕΤΑΦΕΡΕΤΑΙ ΑΥΤΟΥΣΙΟ από το `ConditionalAppShell.tsx:143-180` (ADR-777 §8.12).
 * Η εξαγωγή έγινε για τον N.7.1 — το `AppLayout` ήταν **83 γραμμές**, πάνω από το
 * όριο των 40. Είναι **εξαγωγή, όχι περικοπή**: καμία γραμμή λογικής δεν άλλαξε.
 *
 * ⚠️ **ΟΙ ΝΕΚΡΟΙ ΚΛΑΔΟΙ ΜΕΝΟΥΝ, ΕΠΙΤΗΔΕΣ.** Τα `'admin'`, `'agent'`, `'sales'`,
 * `'guest'` **δεν υπάρχουν** στα `GLOBAL_ROLES` (super_admin | company_admin |
 * internal_user | external_user) — είναι το legacy λεξιλόγιο του `ProtectedRoute`
 * που διαρρέει, ήδη καταγεγραμμένο ως νεκρό στο **ADR-703 Π-17**. Η αφαίρεσή τους
 * είναι **απόφαση τομέα** (ποιος ρόλος παίρνει ποιο prefetch), όχι μέρος μιας
 * μηχανικής μετακόμισης. Ό,τι κόβεται εδώ αλλάζει σιωπηλά ποιες διαδρομές
 * προμεταγλωττίζονται για ποιον.
 *
 * @module components/layout/useRoutePrefetch
 */

import { useEffect, useRef } from 'react';

import { useAuth } from '@/auth';
import { preloadUserRoutes } from '@/utils/preloadRoutes';

type PreloadRole = 'admin' | 'agent' | 'user' | 'viewer';

/**
 * Firebase `globalRole` (custom claims) → ρόλος του συστήματος preload.
 * Αυτούσιο από `ConditionalAppShell.tsx:160-172`.
 */
function mapGlobalRoleToPreloadRole(globalRole?: string): PreloadRole {
  if (!globalRole) return 'user';
  if (globalRole === 'super_admin' || globalRole === 'company_admin' || globalRole === 'admin') {
    return 'admin';
  }
  if (globalRole === 'agent' || globalRole === 'sales') {
    return 'agent';
  }
  if (globalRole === 'viewer' || globalRole === 'guest') {
    return 'viewer';
  }
  return 'user';
}

/**
 * Ενεργοποιεί background προμεταγλώττιση διαδρομών μόλις φορτωθεί ο χρήστης.
 * Pattern: SAP Fiori, Salesforce Lightning — περίμενε το auth, μετά prefetch.
 */
export function useRoutePrefetch(): void {
  const { user } = useAuth();
  const prefetchInitialized = useRef(false);

  useEffect(() => {
    // 🛡️ GUARD: χωρίς φορτωμένο χρήστη δεν ξέρουμε ρόλο, άρα δεν ξέρουμε τι να φέρουμε.
    if (!user) return;
    if (prefetchInitialized.current) return;
    prefetchInitialized.current = true;

    preloadUserRoutes(mapGlobalRoleToPreloadRole(user.globalRole), user.companyId);
  }, [user]);
}
