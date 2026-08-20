'use client';

/**
 * =============================================================================
 * ΕΦΕΔΡΙΚΗ ΕΠΙΛΥΣΗ: **η εγγραφή που δεν είναι στη φορτωμένη λίστα** — ADR-777 §8.31
 * =============================================================================
 *
 * Ένας σύνδεσμος δεν ξέρει τι φίλτρα έχεις ανοιχτά. Η λίστα μιας οθόνης είναι
 * **ενεργά, φιλτραρισμένα, σελιδοποιημένα** — η ταυτότητα που ζητά η διεύθυνση
 * μπορεί κάλλιστα να λείπει από εκεί χωρίς να λείπει από τη **βάση**.
 *
 * 🔑 **Η σωστή συμπεριφορά ΥΠΗΡΧΕ ΗΔΗ, γραμμένη μία φορά εκτός SSoT**: το
 * `useContactsPageState:146` (`loadSpecificContact`) πάει και φέρνει την επαφή
 * όταν λείπει από τη λίστα — γι' αυτό οι **επαφές** ήταν η μόνη από τις πέντε
 * οντότητες χωρίς το ελάττωμα. Εδώ **ανεβαίνει** στο κοινό εξάρτημα (N.0.2),
 * αντί να αντιγραφεί σε τρεις ακόμη οθόνες.
 *
 * ⚠️ **ΓΙΑ ΤΗΝ ΠΗΓΗ**: δώσε διαδρομή που **ελέγχει εταιρεία**. Το
 * `getStorageUnitById` (`services/storage.service.ts`) χρησιμοποιεί Admin SDK
 * **χωρίς κανέναν έλεγχο `companyId`**, δηλαδή παρακάμπτει τους κανόνες
 * Firestore — είναι διαρροή μεταξύ εταιρειών αν κληθεί από οθόνη (CHECK 3.35).
 *
 * @module hooks/useEntityFallbackResolution
 * @enterprise ADR-777 §8.31
 */

import { useEffect, useRef, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';
import type {
  EntitySelectionFallback,
  SelectableEntity,
} from './entity-selection-state';

export interface EntityFallbackParams<T extends SelectableEntity> {
  /** Η ταυτότητα που ζητά η διεύθυνση. */
  readonly requestedId: string | null;
  /**
   * Ρωτάμε την εφεδρεία **μόνο** όταν η λίστα έχει απαντήσει και δεν την έχει.
   * Ο υπολογισμός γίνεται έξω ώστε να μην υπάρχει κύκλος με την κατάσταση.
   */
  readonly enabled: boolean;
  /** Η πηγή. Απουσία της ⇒ `unavailable` — δεν περιμένουμε κανέναν. */
  readonly resolveById?: (id: string) => Promise<T | null>;
  readonly loggerName: string;
}

const IDLE: EntitySelectionFallback<never> = { phase: 'unavailable', item: null };

/**
 * ⚠️ **Ο φρουρός γενιάς δεν είναι πολυτέλεια.** Ο άνθρωπος μπορεί να πατήσει
 * δεύτερο σύνδεσμο όσο τρέχει το πρώτο αίτημα· χωρίς αυτόν, η **αργή** απάντηση
 * του πρώτου προσγειώνεται πάνω στο δεύτερο και η οθόνη δείχνει **άλλη
 * εγγραφή** — ακριβώς το ψέμα που το §8.31 υπάρχει για να εξαλείψει, με νέα μορφή.
 */
export function useEntityFallbackResolution<T extends SelectableEntity>({
  requestedId,
  enabled,
  resolveById,
  loggerName,
}: EntityFallbackParams<T>): EntitySelectionFallback<T> {
  const [state, setState] = useState<EntitySelectionFallback<T>>(IDLE);
  const generation = useRef(0);

  useEffect(() => {
    if (!resolveById || !enabled || !requestedId) {
      setState(IDLE);
      return;
    }

    const logger = createModuleLogger(loggerName);
    const mine = ++generation.current;

    setState({ phase: 'pending', item: null });

    resolveById(requestedId)
      .then((item) => {
        if (mine !== generation.current) return;
        logger.info('Deep-link fallback resolved', { requestedId, found: Boolean(item) });
        setState({ phase: 'settled', item });
      })
      .catch((error: unknown) => {
        if (mine !== generation.current) return;
        // Μια αποτυχία ΕΙΝΑΙ απάντηση: αλλιώς η οθόνη μένει «φορτώνει» για πάντα.
        logger.error('Deep-link fallback failed', { requestedId, error });
        setState({ phase: 'settled', item: null });
      });
  }, [requestedId, enabled, resolveById, loggerName]);

  return state;
}
