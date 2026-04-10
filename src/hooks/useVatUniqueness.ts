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

import { useState, useEffect, useRef } from 'react';
import {
  checkVatUniqueness,
  isValidGreekVat,
  type VatUniquenessResult,
} from '@/lib/validation/vat-validation';
import { useCompanyId } from '@/hooks/useCompanyId';

const DEBOUNCE_MS = 500;

export interface UseVatUniquenessReturn {
  isChecking: boolean;
  result: VatUniquenessResult | null;
}

export function useVatUniqueness(
  vatNumber: string | undefined | null,
  excludeContactId?: string
): UseVatUniquenessReturn {
  const companyId = useCompanyId()?.companyId;
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<VatUniquenessResult | null>(null);
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
      setResult(null);
      setIsChecking(false);
      return;
    }

    // Valid VAT — debounce the check
    setIsChecking(true);

    timerRef.current = setTimeout(async () => {
      try {
        const uniquenessResult = await checkVatUniqueness(vat, companyId, excludeContactId);
        setResult(uniquenessResult);
      } catch {
        // Fail silently — don't block user
        setResult(null);
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

  return { isChecking, result };
}
