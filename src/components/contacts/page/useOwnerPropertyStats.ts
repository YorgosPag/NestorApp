'use client';

/**
 * =============================================================================
 * **ΤΙ ΚΑΤΕΧΕΙ ΚΑΘΕ ΕΠΑΦΗ** — μία κλήση για όλους (ADR-842 §7.6.13 Δ)
 * =============================================================================
 *
 * 🧹 **Γιατί ζει σε δικό του αρχείο** *(N.7.1 · εξαγωγή, όχι περικοπή)*: το
 * `useContactsPageState` πέρασε τις **500** γραμμές όταν μπήκε εδώ αυτούσιο, και το
 * CHECK 4 το μπλόκαρε. Η ενότητα είναι **αυτοτελής** — μία κατάσταση, ένα effect,
 * καμία εξάρτηση από την υπόλοιπη σελίδα πέρα από τη σκανδάλη ανανέωσης — άρα η
 * απάντηση ήταν να **φύγει ολόκληρη**, όχι να στριμωχτεί.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { OwnerPropertyStatsByContact } from '@/lib/contacts/owner-property-stats';

const logger = createModuleLogger('useOwnerPropertyStats');

/**
 * Τι κατέχει κάθε επαφή — **συναθροισμένο στον διακομιστή**.
 *
 * 🔴 **Μία κλήση για ΟΛΟΥΣ τους ιδιοκτήτες, όχι μία ανά επαφή.** Η αδελφή διαδρομή
 * `CONTACTS.PROPERTIES(id)` απαντά για **μία** επαφή· αν την καλούσαμε ανά γραμμή, μια
 * λίστα 300 επαφών θα γεννούσε 300 αιτήματα για να απαντηθεί ένα φίλτρο.
 *
 * 🔴 **`undefined` σημαίνει «δεν ξέρω ακόμη», όχι «κανείς δεν κατέχει τίποτα».** Η
 * διάκριση δεν είναι φιλοσοφική: με `{}` τα τρία φίλτρα ιδιοκτησίας θα άδειαζαν τη
 * λίστα για όσο διαρκεί η φόρτωση, σε **κάθε** επίσκεψη.
 *
 * ⚠️ **Δεν ξαναφέρνει σε κάθε αλλαγή φίλτρου** — τα φίλτρα δουλεύουν πάνω στον ίδιο
 * πίνακα. Ξαναφέρνει μόνο όταν αλλάζει ο χρήστης ή ζητηθεί ανανέωση: γι' αυτό δέχεται
 * την **ίδια** σκανδάλη με τη συνδρομή επαφών, ώστε το tab-visibility / AI-sync refresh
 * *(§7.6.13 Α)* να ενημερώνει **και** τα δύο.
 *
 * 🔑 Η αποτυχία **δεν** είναι σφάλμα οθόνης: αφήνει το αποτέλεσμα `undefined`, δηλαδή τα
 * τρία φίλτρα ιδιοκτησίας δεν εφαρμόζονται και η λίστα μένει πλήρης. *«Δεν μπόρεσα να
 * μετρήσω»* δεν δικαιολογεί *«δεν σου δείχνω κανέναν»*.
 *
 * @param refreshTrigger Η σκανδάλη ανανέωσης της σελίδας (`subscriptionRetry`).
 */
export function useOwnerPropertyStats(
  refreshTrigger: number,
): OwnerPropertyStatsByContact | undefined {
  const { user, loading: authLoading } = useAuth();
  const [ownerStats, setOwnerStats] = useState<OwnerPropertyStatsByContact | undefined>();

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    apiClient
      .get<{ success: boolean; stats: OwnerPropertyStatsByContact }>(
        API_ROUTES.CONTACTS.OWNER_PROPERTY_STATS,
      )
      .then((result) => {
        if (cancelled || !result?.success) return;
        setOwnerStats(result.stats);
      })
      .catch((err) => {
        logger.warn('Owner property stats unavailable — ownership filters stay off', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => { cancelled = true; };
  }, [user, authLoading, refreshTrigger]);

  return ownerStats;
}
