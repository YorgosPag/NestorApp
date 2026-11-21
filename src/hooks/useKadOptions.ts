'use client';

/**
 * @fileoverview **Ο κατάλογος ΚΑΔ 2025 ως επιλογές combobox** — ΕΝΑΣ για επαφές, λογιστήριο και κάθε οθόνη.
 * @related lib/kad/kad-catalog-source.ts (φόρτωση) · hooks/useLazySnapshot.ts · components/shared/KadCodePicker.tsx
 *
 * 🔑 **Η φόρτωση ζει στην κοινή μηχανή** (`useLazySnapshot` + `createLazyJsonSnapshot`): single-flight,
 * επανάληψη μετά από αποτυχία, και ταυτότητα που αλλάζει όταν φτάσουν τα δεδομένα. Ο παλιός hook είχε
 * δικό του `createStaleCache` + `useEffect` — δεύτερος μηχανισμός για το ίδιο πρόβλημα.
 *
 * Επιλογές = μόνο οι **επιλέξιμες** γραμμές (τάξη και βαθύτερα — `isSelectableKad`).
 * Τιμή = κωδικός με τελείες · ετικέτα = «κωδικός — περιγραφή» · δευτερεύουσα = τα 8 ψηφία ΓΕΜΗ,
 * ώστε η αναζήτηση `41001100` να βρίσκει τον `41.00.11`.
 */

import { useMemo } from 'react';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { useLazySnapshot } from '@/hooks/useLazySnapshot';
import { KAD_CATALOG_SOURCE } from '@/lib/kad/kad-catalog-source';
import { EMPTY_KAD_CATALOG } from '@/lib/kad/kad-catalog-shape';
import { isSelectableKad } from '@/lib/kad/kad-resolve';
import type { KadCatalog } from '@/lib/kad/kad-types';

/** Μία μετατροπή ανά κατάλογο, κοινή για όλα τα πεδία της σελίδας (10.000+ γραμμές). */
const optionsByCatalog = new WeakMap<KadCatalog, ComboboxOption[]>();

function optionsOf(catalog: KadCatalog): ComboboxOption[] {
  const cached = optionsByCatalog.get(catalog);
  if (cached) return cached;
  const options = catalog.entries.filter(isSelectableKad).map(
    (entry): ComboboxOption => ({
      value: entry.code,
      label: `${entry.code} — ${entry.description}`,
      ...(entry.gemi === null ? {} : { secondaryLabel: entry.gemi }),
    }),
  );
  optionsByCatalog.set(catalog, options);
  return options;
}

export interface KadOptionsState {
  readonly options: ComboboxOption[];
  readonly isLoading: boolean;
  /** Ο κατάλογος — `EMPTY_KAD_CATALOG` όσο φορτώνει ή αν απέτυχε («δεν ξέρω»). */
  readonly catalog: KadCatalog;
}

/** Ο κατάλογος ΚΑΔ 2025, φορτωμένος τεμπέλικα, με τις επιλογές του. */
export function useKadOptions(): KadOptionsState {
  const snapshot = useLazySnapshot(KAD_CATALOG_SOURCE, EMPTY_KAD_CATALOG);
  const catalog = snapshot ?? EMPTY_KAD_CATALOG;
  const options = useMemo(() => optionsOf(catalog), [catalog]);
  return { options, isLoading: snapshot === null, catalog };
}
