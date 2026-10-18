'use client';

/**
 * @fileoverview ADR-915 §35 — **η αποστολή μιας απόφασης μόνιμης υποχρέωσης** από την ενότητα του μητρώου.
 * @related lib/document-validity/upkeep-declaration-request.ts (σχήμα · κωδικοί) ·
 *   services/document-registry/document-registry.client.ts (`saveUpkeepDeclaration`) · useFactsDeclaration.ts (το ιδίωμα)
 * @module hooks/document-registry/useUpkeepDeclaration
 *
 * 🔑 **ΟΧΙ αισιόδοξα** (ίδια απόφαση με το §33): μια επιβεβαίωση **γεννά** γραμμές «λείπει» και εξαρτήσεις, που τις
 *    κρίνει ο ΕΝΑΣ πυρήνας (`documentRegistry`) στον διακομιστή. Αισιόδοξη αναπαραγωγή εδώ θα ήταν δεύτερη μηχανή — και
 *    ένα «λείπει» που εμφανίζεται και ξαναχάνεται. Το κουμπί λέει «Αποθηκεύεται…»· επιτυχία ⇒ `revalidate` στο
 *    παρασκήνιο· άρνηση ⇒ η ενότητα λέει **γιατί**.
 * 🔑 **Χωρίς διπλή αποστολή**: όσο υπάρχει αίτημα σε πτήση, δεύτερο πάτημα αγνοείται (ref). Το σύνορο ιδεμποτίας
 *    ADR-872 καλύπτει την αυτόματη επανάληψη του δικτύου.
 */

import { useCallback, useRef, useState } from 'react';

import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { UPKEEP_KEYS, type UPKEEP_ERROR_KEYS } from '@/components/document-registry/upkeep-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  upkeepDeclarationRefusalOfCode,
  type UpkeepDeclarationBody,
} from '@/lib/document-validity/upkeep-declaration-request';
import { useNotifications } from '@/providers/NotificationProvider';
import { saveUpkeepDeclaration } from '@/services/document-registry/document-registry.client';

export type UpkeepDeclarationError = keyof typeof UPKEEP_ERROR_KEYS;

export interface UpkeepDeclarationSubmit {
  /** `true` = αποθηκεύτηκε. */
  readonly submit: (body: UpkeepDeclarationBody) => Promise<boolean>;
  /** Το (ακίνητο, είδος) που στέλνεται τώρα — `null` όταν τίποτα δεν είναι σε πτήση. */
  readonly busyKey: string | null;
  /** Η άρνηση της τελευταίας αποστολής, με το (ακίνητο, είδος) της. ⚠️ Γραμμή, όχι κλειδί (CHECK 3.34, ιδίωμα §33). */
  readonly error: { readonly key: string; readonly reason: UpkeepDeclarationError } | null;
}

/** Η ΜΙΑ ταυτότητα (ακίνητο, είδος) της ενότητας — για το «ποιο κουμπί περιμένει» και «πού λέγεται η άρνηση». */
export function upkeepItemKeyOf(propertyId: string, documentKind: string): string {
  return `${propertyId}:${documentKind}`;
}

export function useUpkeepDeclaration(revalidate: () => Promise<void>): UpkeepDeclarationSubmit {
  const { t } = useTranslation([REGISTRY_NS]);
  const { success } = useNotifications();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<UpkeepDeclarationSubmit['error']>(null);
  const inFlight = useRef(false);

  const submit = useCallback(async (body: UpkeepDeclarationBody): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    const key = upkeepItemKeyOf(body.propertyId, body.documentKind);
    setBusyKey(key);
    setError(null);
    try {
      const saved = await saveUpkeepDeclaration(body);
      if (saved.kind === 'failed') {
        setError({ key, reason: upkeepDeclarationRefusalOfCode(saved.code) ?? 'failed' });
        return false;
      }
      await revalidate();
      success(t(UPKEEP_KEYS.saved));
      return true;
    } finally {
      inFlight.current = false;
      setBusyKey(null);
    }
  }, [revalidate, success, t]);

  return { submit, busyKey, error };
}
