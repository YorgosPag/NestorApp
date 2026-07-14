/**
 * ADR-654 M6 — Ο descriptor μιας οικογένειας entourage: ο ΜΟΝΑΔΙΚΟΣ κόμβος που δένει
 * catalog ↔ source ↔ selection store ↔ i18n ↔ icon για την generic παλέτα/κάρτα.
 *
 * Η παλέτα (`EntouragePalette`) και ο hook (`useEntouragePalette`) είναι 100% pack-agnostic — όλα
 * τα per-family δεδομένα έρχονται από εδώ (N.18: μία μηχανή, δύο descriptors, μηδέν clone).
 *
 * @see ./EntouragePalette.tsx — ο generic καταναλωτής
 */

import type { ReactNode } from 'react';
import type { AssetPackId } from '@/lib/asset-packs/asset-pack-registry';
import type { EntourageDef } from '../../../data/entourage-catalog-core';
import type {
  EntourageSelectionStore,
} from '../../../bim/entourage/entourage-selection-store';
import type { EntourageAssetVariant } from '../../../data/entourage-source';

/** Ό,τι διαφέρει ανά οικογένεια — τίποτα από τη ΛΟΓΙΚΗ της παλέτας δεν ζει εδώ. */
export interface EntouragePackDescriptor {
  /** Το asset pack (πύλη πρόσβασης + storage identity). */
  readonly packId: AssetPackId;
  /**
   * i18n namespace-prefix των facets + labels, π.χ. `'peoplePlan'`. Απ' αυτό συντίθενται ΟΛΑ τα
   * κλειδιά (`<prefix>.categories.<cat>`, `<prefix>.secondary.<sec>`, `<prefix>.title`…) — ίδιο
   * μοτίβο με τον core `getLabelParts`, οπότε δεν χρειάζεται per-pack label fn εδώ.
   */
  readonly i18nPrefix: string;
  /** Το εικονίδιο της κεφαλίδας του panel. */
  readonly icon: ReactNode;
  /** Ο κατάλογος της οικογένειας (curated, σταθερός). */
  readonly list: () => readonly EntourageDef[];
  /** id → URL (σύγχρονο, asset-pack proxy). */
  readonly resolveUrl: (id: string, variant?: EntourageAssetVariant) => string;
  /** «Ποιο item τοποθετώ» SSoT της οικογένειας. */
  readonly selection: EntourageSelectionStore;
}
