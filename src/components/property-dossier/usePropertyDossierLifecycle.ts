'use client';

/**
 * @fileoverview **Αρχειοθέτηση / επαναφορά φακέλου, με «Αναίρεση»** — ένα σημείο για κάρτα και λεπτομέρεια.
 * @related ADR-866 Φ1.2 · Ε-Φ1.2-3 (§2.9.8 Δ3) · services/property-dossier/property-dossier.service.ts
 * @module components/property-dossier/usePropertyDossierLifecycle
 *
 * 🔑 **Άμεση πράξη + toast «Αναίρεση»** (Gmail/Material): η αρχειοθέτηση **δεν** σβήνει τίποτα, άρα **δεν** ρωτά.
 * 🏆 **Παραπέρα από το Gmail**: η «Αναίρεση» **δεν** είναι καθυστερημένη εγγραφή που χάνεται όταν κλείσει το toast —
 * η πράξη **έγινε**, και η αναίρεση είναι **επαναφορά στον ίδιο γραφέα, με ίχνος**. Άρα η ίδια αναίρεση υπάρχει και
 * αύριο, από το φίλτρο «Αρχειοθετημένοι», και το ιστορικό λέει την αλήθεια (αρχειοθετήθηκε → επανήλθε).
 *
 * ⚠️ **Καμία αισιόδοξη αντιγραφή κατάστασης εδώ**: η λίστα είναι **ζωντανή** (`onSnapshot`) — η κάρτα μετακινείται
 * μόνη της μόλις γράψει ο διακομιστής, από τη **μία** πηγή αλήθειας. Ένα τοπικό «ψεύτικο archived» θα ήταν δεύτερη
 * κατάσταση που μπορεί να διαφωνήσει με τη βάση (π.χ. αν ο διακομιστής αρνηθεί).
 */

import { useCallback, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { setPropertyDossierLifecycle } from '@/services/property-dossier/property-dossier.service';
import type { PropertyDossier, PropertyDossierLifecycle } from '@/types/property-dossier';

const NS = 'property-market';
const K = `${NS}:dossier.lifecycle`;
/** Ταυτότητα toast κύκλου ζωής — μία ανά φάκελο (όχι έγγραφο Firestore ⇒ εκτός N.6). */
export const LIFECYCLE_TOAST_PREFIX = 'dossier-lifecycle-';

export interface PropertyDossierLifecycleControls {
  /** Μια αλλαγή κατάστασης είναι σε πτήση — τα κουμπιά απενεργοποιούνται (όχι διπλή αίτηση). */
  readonly busy: boolean;
  readonly archive: (dossier: Pick<PropertyDossier, 'id' | 'label'>) => Promise<void>;
  readonly restore: (dossier: Pick<PropertyDossier, 'id' | 'label'>) => Promise<void>;
}

export function usePropertyDossierLifecycle(): PropertyDossierLifecycleControls {
  const { t } = useTranslation([NS]);
  const notifications = useNotifications();
  const [busy, setBusy] = useState(false);

  /** Η **μία** μετάβαση — επιτυχία ⇒ toast (με «Αναίρεση» όταν αρχειοθετεί), αποτυχία ⇒ μήνυμα σφάλματος. */
  const transition = useCallback(
    async (dossier: Pick<PropertyDossier, 'id' | 'label'>, lifecycle: PropertyDossierLifecycle): Promise<void> => {
      setBusy(true);
      const result = await setPropertyDossierLifecycle(dossier.id, lifecycle);
      setBusy(false);

      if (result.kind !== 'saved') {
        notifications.error(t(`${K}.failed`));
        return;
      }
      // ADR-866 §2.10 Π3 — ΕΝΑ toast ανά φάκελο (Gmail): το νέο αντικαθιστά το παλιό, ώστε ένα «Αναίρεση» που έπαψε
      // να ισχύει (ο φάκελος επανήλθε) να μη μένει στη στοίβα δίπλα σε αντίθετο μήνυμα.
      const id = `${LIFECYCLE_TOAST_PREFIX}${dossier.id}`;
      if (lifecycle === 'active') {
        notifications.success(t(`${K}.restoredToast`, { label: dossier.label }), { id });
        return;
      }
      // Με ενέργεια ⇒ μένει μέχρι να ενεργήσει/κλείσει ο χρήστης (Β2, `notification-policy.ts`).
      notifications.success(t(`${K}.archivedToast`, { label: dossier.label }), {
        id,
        actions: [{ label: t(`${K}.undo`), onClick: () => void transition(dossier, 'active') }],
      });
    },
    [notifications, t],
  );

  const archive = useCallback((dossier: Pick<PropertyDossier, 'id' | 'label'>) => transition(dossier, 'archived'), [transition]);
  const restore = useCallback((dossier: Pick<PropertyDossier, 'id' | 'label'>) => transition(dossier, 'active'), [transition]);

  return { busy, archive, restore };
}
