'use client';

/**
 * @fileoverview **Οι ΚΑΔ ως επιλογές combobox** — φόρτωση, μετατροπή και cache, μία φορά.
 * @related ADR-ACC-013 · CLAUDE.md N.0.2 / N.18 (CHECK 3.28)
 *
 * 🔴 **Γιατί υπάρχει**: ο ίδιος hook ζούσε **δύο φορές**, στο `shared/KadCodePicker` και στο
 * accounting `KadSection`, με **δύο** caches (`shared-kad-options`, `accounting-kad-options`).
 * Το ίδιο αρχείο ~1.000 ΚΑΔ φορτωνόταν και κρατιόταν στη μνήμη δύο φορές, και η μορφή της
 * ετικέτας («κωδικός — περιγραφή») μπορούσε να αποκλίνει ανάμεσα στις δύο οθόνες.
 * Το CHECK 3.28 το είδε τη στιγμή που τα δύο αρχεία άλλαξαν μαζί (2026-09-21).
 */

import { useEffect, useState } from 'react';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import type { KadCode } from '@/subapps/accounting/data/greek-kad-codes';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useKadOptions');
const kadOptionsCache = createStaleCache<ComboboxOption[]>('shared-kad-options');

/** Ετικέτα «κωδικός — περιγραφή», τιμή ο κωδικός, δευτερεύουσα η περιγραφή. */
function kadCodesToOptions(codes: readonly KadCode[]): ComboboxOption[] {
  return codes.map((kad) => ({
    value: kad.code,
    label: `${kad.code} — ${kad.description}`,
    secondaryLabel: kad.description,
  }));
}

/** Οι ΚΑΔ, φορτωμένοι τεμπέλικα (code-splitting) και κοινοί για κάθε οθόνη. */
export function useKadOptions(): { options: ComboboxOption[]; isLoading: boolean } {
  const [options, setOptions] = useState<ComboboxOption[]>(kadOptionsCache.get() ?? []);
  const [isLoading, setIsLoading] = useState(!kadOptionsCache.hasLoaded());

  useEffect(() => {
    let cancelled = false;

    async function loadKadCodes(): Promise<void> {
      try {
        if (!kadOptionsCache.hasLoaded()) setIsLoading(true);
        const { GREEK_KAD_CODES } = await import('@/subapps/accounting/data/greek-kad-codes');
        if (!cancelled) {
          const loaded = kadCodesToOptions(GREEK_KAD_CODES);
          kadOptionsCache.set(loaded);
          setOptions(loaded);
        }
      } catch (error) {
        logger.error('Failed to load KAD codes', { error });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadKadCodes();
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, isLoading };
}
