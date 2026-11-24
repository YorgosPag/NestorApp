/**
 * @module useVatUniqueness
 * @description Debounced hook for real-time VAT uniqueness checking.
 *
 * Usage:
 * ```tsx
 * const { isChecking, result } = useVatUniqueness(formData.vatNumber, contactId);
 * ```
 *
 * - Debounces 500ms after user stops typing
 * - Only fires when vatNumber.length === 9 (valid Greek VAT)
 * - Clears result when length < 9
 * - Self-excludes contact during edit via excludeContactId
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  findVatHolders,
  isValidGreekVat,
  vatUniquenessOf,
  type VatUniquenessResult,
} from '@/lib/validation/vat-validation';
import {
  decideVatDuplicate,
  vatChanges,
  type IdentifierDuplicateDecision,
  type IdentifierHolder,
} from '@/lib/contacts/contact-identifier-duplicate-policy';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { ContactType } from '@/types/contacts';

export interface UseVatDuplicateDecisionReturn {
  isChecking: boolean;
  holders: readonly IdentifierHolder[];
  decision: IdentifierDuplicateDecision;
}

const DEBOUNCE_MS = 500;
const NO_HOLDERS: readonly IdentifierHolder[] = [];

export interface UseVatUniquenessReturn {
  isChecking: boolean;
  result: VatUniquenessResult | null;
  /** ΟΛΟΙ οι άλλοι κάτοχοι (ADR-944 §9) — από αυτούς κρίνει το `decideVatDuplicate`. Κενό πριν από τον έλεγχο. */
  holders: readonly IdentifierHolder[];
}

export function useVatUniqueness(
  vatNumber: string | undefined | null,
  excludeContactId?: string
): UseVatUniquenessReturn {
  const companyId = useCompanyId()?.companyId;
  const [isChecking, setIsChecking] = useState(false);
  const [holders, setHolders] = useState<readonly IdentifierHolder[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending debounce
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const vat = vatNumber?.trim() ?? '';

    // If not a valid 9-digit VAT or no tenant context, clear result
    if (!isValidGreekVat(vat) || !companyId) {
      setHolders(null);
      setIsChecking(false);
      return;
    }

    // Valid VAT — debounce the check
    setIsChecking(true);
    // Οι κάτοχοι του ΠΡΟΗΓΟΥΜΕΝΟΥ ΑΦΜ δεν ισχύουν για το νέο — όσο τρέχει ο έλεγχος δεν λέμε τίποτα.
    setHolders(null);

    timerRef.current = setTimeout(async () => {
      try {
        setHolders(await findVatHolders(vat, companyId, excludeContactId));
      } catch {
        // Fail silently — don't block user
        setHolders(null);
      } finally {
        setIsChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [vatNumber, excludeContactId, companyId]);

  const result = useMemo(() => (holders === null ? null : vatUniquenessOf(holders)), [holders]);
  return { isChecking, result, holders: holders ?? NO_HOLDERS };
}

/**
 * Η απόφαση του κανόνα (ADR-944 §9) για το ΑΦΜ που γράφεται τώρα: `allow` · `confirm` · `block`, μαζί με τους κατόχους.
 * Όσο τρέχει ο έλεγχος (ή πριν από αυτόν) η απόφαση είναι `allow` — ο καλών κοιτά το `isChecking` αν πρέπει να περιμένει.
 *
 * 🔑 `storedVat` = το ΑΦΜ που έχει **ήδη** η επαφή. Ίδιο ⇒ ο φρουρός αποθήκευσης δεν θα ρωτήσει (`vatChanges`) ⇒
 *    `allow` με τους κατόχους: παλιό διπλότυπο που **φαίνεται**, χωρίς υπόσχεση φραγμού ή επιβεβαίωσης.
 */
export function useVatDuplicateDecision(
  vatNumber: string | undefined | null,
  candidateType: ContactType,
  excludeContactId?: string,
  storedVat?: string
): UseVatDuplicateDecisionReturn {
  const { isChecking, holders } = useVatUniqueness(vatNumber, excludeContactId);
  const changes = vatChanges(vatNumber ?? '', storedVat);
  return { isChecking, holders, decision: changes ? decideVatDuplicate(candidateType, holders) : 'allow' };
}
