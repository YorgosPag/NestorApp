'use client';

/**
 * @fileoverview ADR-915 §33 — **η αποστολή μιας «Συμπλήρωσης στοιχείων»** από τον διάλογο του μητρώου.
 * @related lib/document-validity/facts-declaration.ts (ο κριτής · οι κωδικοί) · services/document-registry/document-registry.client.ts
 *   (`saveFactsDeclaration`) · useDocumentRegistry.ts (`revalidate`)
 * @module hooks/document-registry/useFactsDeclaration
 *
 * 🔑 **ΟΧΙ αισιόδοξα** (ίδια απόφαση με την αποστολή του §28): η ετυμηγορία ανήκει στον διακομιστή — ιεραρχία μαρτυριών
 *    και CAS κρίνονται μέσα στη συναλλαγή του ΕΝΟΣ γραφέα. Μια αισιόδοξη ημερομηνία που μετά «γυρίζει πίσω» θα έλεγε για
 *    λίγο ότι η ΥΔΕ ισχύει ως το 2034 ενώ δεν ισχύει. Ο διάλογος μένει ανοιχτός με «Αποθηκεύεται…»· επιτυχία ⇒ το μητρώο
 *    ξαναδιαβάζεται **στο παρασκήνιο** (`revalidate`, χωρίς «φορτώνει»)· άρνηση ⇒ ο διάλογος λέει **γιατί**.
 * 🔑 **Χωρίς διπλή αποστολή**: όσο υπάρχει αίτημα σε πτήση, δεύτερο πάτημα αγνοείται (ref, όχι state — δεν περιμένει
 *    επόμενη απόδοση). Το σύνορο ιδεμποτίας ADR-872 καλύπτει την αυτόματη επανάληψη του δικτύου.
 */

import { useCallback, useRef, useState } from 'react';

import { FACTS_DECLARATION_ERROR_KEYS, FACTS_DECLARATION_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  factsDeclarationRefusalOfCode,
  type FactsDeclarationBody,
} from '@/lib/document-validity/facts-declaration';
import { useNotifications } from '@/providers/NotificationProvider';
import { saveFactsDeclaration } from '@/services/document-registry/document-registry.client';

export type FactsDeclarationError = keyof typeof FACTS_DECLARATION_ERROR_KEYS;

export interface FactsDeclarationSubmit {
  /** `true` = αποθηκεύτηκε (ο διάλογος κλείνει). */
  readonly submit: (body: FactsDeclarationBody) => Promise<boolean>;
  readonly busy: boolean;
  /**
   * Η άρνηση της τελευταίας αποστολής — `null` πριν/μετά από επιτυχία. ⚠️ **Γραμμή**, όχι κλειδί: η κλήση μένει
   * `t(FACTS_DECLARATION_ERROR_KEYS[…])`, που ο τεμαχιστής του CHECK 3.34 λύνει στατικά (ίδιο με το §26).
   */
  readonly error: FactsDeclarationError | null;
}

export function useFactsDeclaration(revalidate: () => Promise<void>): FactsDeclarationSubmit {
  const { t } = useTranslation([REGISTRY_NS]);
  const { success } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FactsDeclarationError | null>(null);
  const inFlight = useRef(false);

  const submit = useCallback(async (body: FactsDeclarationBody): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveFactsDeclaration(body);
      if (saved.kind === 'failed') {
        setError(factsDeclarationRefusalOfCode(saved.code) ?? 'failed');
        return false;
      }
      await revalidate();
      success(t(FACTS_DECLARATION_KEYS.saved));
      return true;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [revalidate, success, t]);

  return { submit, busy, error };
}
