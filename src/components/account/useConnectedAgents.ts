'use client';

/**
 * Κατάσταση της οθόνης «συνδεδεμένοι πράκτορες» (ADR-738 §6, §10)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΗΝ ΠΑΡΟΥΣΙΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ανάκληση δεν είναι «σβήσε τη γραμμή από τη λίστα»: είναι πράξη ασφαλείας με
 * σειρά που έχει σημασία (συγκατάθεση πρώτα, tokens μετά — ADR-738 §6) και με
 * αποτέλεσμα που ο χρήστης πρέπει να δει να ισχύει. Μπλεγμένη μέσα στο JSX,
 * γίνεται δύσκολο να απαντηθεί το «τι ακριβώς συμβαίνει όταν πατήσω;».
 *
 * ⚠️ **Καμία αισιόδοξη αφαίρεση.** Το στοιχείο φεύγει από τη λίστα **μόνο** όταν
 * ο server επιβεβαιώσει. Σε μια οθόνη που απαντά «ποιος έχει πρόσβαση στα
 * δεδομένα μου;», ένα στοιχείο που εξαφανίζεται πριν ανακληθεί πραγματικά είναι
 * ψέμα με συνέπειες: ο χρήστης φεύγει πιστεύοντας ότι έκοψε πρόσβαση που ζει
 * ακόμη. Το N.7 ζητά optimistic updates για *ταχύτητα*, όχι για ισχυρισμούς
 * ασφαλείας.
 *
 * @module components/account/useConnectedAgents
 */

import { useCallback, useEffect, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ConnectedAgents');

const CONSENTS_ENDPOINT = '/api/oauth/consents';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

/** Η προβολή που επιστρέφει το `GET /api/oauth/consents` — χωρίς κρυπτογραφικό υλικό. */
export interface ConnectedAgent {
  readonly consentId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly scopes: readonly string[];
  /** epoch ms */
  readonly createdAt: number;
}

interface ConsentsPayload {
  readonly success: boolean;
  readonly data?: readonly ConnectedAgent[];
}

export interface ConnectedAgentsState {
  readonly agents: readonly ConnectedAgent[];
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly revokingId: string | null;
  readonly revokeFailed: boolean;
  readonly reload: () => Promise<void>;
  readonly revoke: (consentId: string) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useConnectedAgents(): ConnectedAgentsState {
  const [agents, setAgents] = useState<readonly ConnectedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeFailed, setRevokeFailed] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);

    try {
      const response = await fetch(CONSENTS_ENDPOINT, { credentials: 'include' });
      const payload = (await response.json()) as ConsentsPayload;

      if (!response.ok || !payload.success) {
        setLoadFailed(true);
        return;
      }
      setAgents(payload.data ?? []);
    } catch (error) {
      logger.error('Failed to load connected agents', { error });
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revoke = useCallback(async (consentId: string) => {
    setRevokingId(consentId);
    setRevokeFailed(false);

    try {
      const response = await fetch(
        `${CONSENTS_ENDPOINT}?consentId=${encodeURIComponent(consentId)}`,
        { method: 'DELETE', credentials: 'include' },
      );

      if (!response.ok) {
        setRevokeFailed(true);
        return;
      }
      // Μόνο τώρα — ο server επιβεβαίωσε ότι η πρόσβαση κόπηκε.
      setAgents((prev) => prev.filter((agent) => agent.consentId !== consentId));
    } catch (error) {
      logger.error('Failed to revoke agent consent', { error });
      setRevokeFailed(true);
    } finally {
      setRevokingId(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { agents, isLoading, loadFailed, revokingId, revokeFailed, reload, revoke };
}
