/**
 * Οι **δικαιοδοσίες** του καταλόγου → το δικαίωμα που τις κρίνει (ADR-923 §5.1 · §5.10 · §5.11 «3β» απόφαση Ε).
 * **Ένας** πίνακας για διακομιστή (`catalog-route.ts`: ποιο δικαίωμα ζητά η διαδρομή) **και** πελάτη
 * (`useCatalogAccess`: εμφανίζεται το κουμπί;) — ως την 3β ήταν δύο αντίγραφα που θα απέκλιναν στην πρώτη νέα.
 *
 * | Δικαιοδοσία | Τι κρίνει | Πρακτική |
 * |---|---|---|
 * | `schema` | η **δομή** (ιδιότητες · οικογένειες · κατηγορίες) | Akeneo «manage catalog structure» |
 * | `products` | τα **δεδομένα** (μοντέλα · SKU · μέσα) | Akeneo «edit products» |
 * | `pricingView` | **ανάγνωση** τιμών, και η ανάλυσή τους — η ΜΟΝΗ πόρτα τους είναι ο διακομιστής (§5.11 «3δ» Ζ) | SAP προβολή συνθηκών (VK13) |
 * | `pricing` | τιμοκατάλογοι, πρόχειρες εκδόσεις, γραμμές, ομάδες, συνθήκες | SAP συντήρηση συνθηκών |
 * | `pricingPublish` | **δημοσίευση** έκδοσης και επιβεβαίωση φράχτη | SAP αποδέσμευση (release) — ≠ συντήρηση |
 *
 * @module subapps/catalog/vocabulary/catalog-authorities
 */

import type { PermissionId } from '@/lib/auth/types';

export const CATALOG_AUTHORITY_PERMISSIONS = {
  schema: 'catalog:schema:manage',
  products: 'catalog:products:manage',
  pricingView: 'catalog:pricing:view',
  pricing: 'catalog:pricing:manage',
  pricingPublish: 'catalog:pricing:publish',
} as const satisfies Readonly<Record<string, PermissionId>>;

export type CatalogAuthority = keyof typeof CATALOG_AUTHORITY_PERMISSIONS;

/** Όσες δικαιοδοσίες κρίνουν **εγγραφή** — το υποσέλιδο επεξεργασίας ρωτά μόνο αυτές· η προβολή δεν είναι εγγραφή. */
export type CatalogWriteAuthority = Exclude<CatalogAuthority, 'pricingView'>;
