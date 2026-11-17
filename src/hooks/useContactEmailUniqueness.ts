/**
 * @module useContactEmailUniqueness
 * @description Debounced προειδοποίηση «αυτό το email υπάρχει ήδη σε άλλη επαφή» (ADR-944).
 *
 * Ίδιο σχήμα με το `useVatUniqueness` (debounce 500ms · αυτο-εξαίρεση στην επεξεργασία · fail-open), αλλά πάνω σε
 * **πολλά** email. Το κλειδί εξάρτησης είναι τα **κανονικοποιημένα** κλειδιά: αλλαγή τύπου/ετικέτας ή κεφαλαίων δεν
 * ξαναρωτά τη βάση.
 * 🔑 **Καμία κούρσα**: απάντηση παλιότερου γύρου (ο χρήστης έγραψε στο μεταξύ) **απορρίπτεται** με αύξοντα αριθμό.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useCompanyId } from '@/hooks/useCompanyId';
import { emailKeyOf } from '@/lib/contacts/contact-email-keys';
import { findEmailDuplicates, type EmailDuplicateWarning } from '@/lib/validation/contact-email-uniqueness';

const DEBOUNCE_MS = 500;

export interface UseContactEmailUniquenessReturn {
  readonly isChecking: boolean;
  readonly warnings: readonly EmailDuplicateWarning[];
}

const NO_WARNINGS: readonly EmailDuplicateWarning[] = [];

export function useContactEmailUniqueness(
  emails: readonly string[],
  excludeContactId?: string,
): UseContactEmailUniquenessReturn {
  const companyId = useCompanyId()?.companyId;
  const [isChecking, setIsChecking] = useState(false);
  const [warnings, setWarnings] = useState<readonly EmailDuplicateWarning[]>(NO_WARNINGS);
  const roundRef = useRef(0);

  const keysSignature = useMemo(
    () => [...new Set(emails.map(emailKeyOf).filter((k): k is string => k !== null))].sort().join('\n'),
    [emails],
  );

  useEffect(() => {
    const round = ++roundRef.current;
    if (keysSignature === '' || !companyId) {
      setWarnings(NO_WARNINGS);
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    const timer = setTimeout(async () => {
      const found = await findEmailDuplicates(keysSignature.split('\n'), companyId, excludeContactId);
      if (round !== roundRef.current) return; // νεότερος γύρος ξεκίνησε — η απάντηση αυτή είναι μπαγιάτικη
      setWarnings(found.length === 0 ? NO_WARNINGS : found);
      setIsChecking(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keysSignature, companyId, excludeContactId]);

  return { isChecking, warnings };
}
