'use client';

/**
 * @fileoverview **Η ΕΚΒΑΣΗ ΤΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗΣ, ΠΡΟΣ ΤΟΝ ΑΝΘΡΩΠΟ** — μία απόδοση για κάθε σημείο που ανεβάζει νέα έκδοση.
 * @related services/file-record-lifecycle.ts (`supersedeFileRecord`) · services/filesystem/container-transition.client.ts
 * @module hooks/files/useSupersessionNotice
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ** (ADR-862 Φ0 Β10): οι τρεις καλούντες της αντικατάστασης κατάπιναν την αποτυχία
 * (`catch {}` · `.catch(() => {})` · `allSettled`). Όταν ο κανόνας Β4 άρχισε να την απορρίπτει, **κανείς δεν το είδε**:
 * η παλιά κάτοψη έμενε «ενεργή» δίπλα στη νέα. Ένα σύστημα που ξέρει **ακριβώς** γιατί δεν αρχειοθέτησε δεν
 * επιτρέπεται να σωπαίνει.
 *
 * 🔑 **Σιωπή ΜΟΝΟ στην επιτυχία και στο περιττό** — εκεί δεν υπάρχει τίποτα να κάνει ο άνθρωπος. Κάθε άρνηση λέγεται
 * **με όνομα** (κλειστό σύνολο ⇒ ποτέ ωμό κλειδί). Προειδοποίηση, όχι σφάλμα: η νέα έκδοση **ανέβηκε**· αυτό που
 * δεν έγινε είναι η τακτοποίηση της παλιάς.
 *
 * ⚠️ Ένα hook και όχι αντίγραφο ανά καλούντα (N.18): η μετάφραση άρνησης → κείμενο είναι **μία** ερώτηση.
 */

import { useCallback } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import type { SupersedeOutcome } from '@/services/filesystem/container-transition.client';

const logger = createModuleLogger('useSupersessionNotice');

const K = 'files:versions.supersession';

/** Το κλειδί του λόγου — `failed` για βλάβη, το όνομα της άρνησης αλλιώς. */
function reasonKeyOf(outcome: Extract<SupersedeOutcome, { kind: 'refused' | 'failed' }>): string {
  return outcome.kind === 'failed' ? 'failed' : outcome.why;
}

/** @returns Η απόδοση μιας έκβασης — καλείται **αφού** ο διακομιστής απάντησε. */
export function useSupersessionNotice(): (outcome: SupersedeOutcome) => void {
  const { t } = useTranslation(['files']);
  const notifications = useNotifications();

  return useCallback(
    (outcome: SupersedeOutcome): void => {
      if (outcome.kind === 'superseded' || outcome.kind === 'noop') return;
      const reasonKey = reasonKeyOf(outcome);
      logger.warn('Η προηγούμενη έκδοση δεν αρχειοθετήθηκε', { reason: reasonKey });
      notifications.warning(t(`${K}.notArchived`, { reason: t(`${K}.reason.${reasonKey}`) }), { duration: 8000 });
    },
    [notifications, t],
  );
}
