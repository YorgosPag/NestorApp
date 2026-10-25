/**
 * Κατηγορία καταλόγου (ADR-923 §5.2) — κόμβος δέντρου. **Πολλά δέντρα** ανά χώρο: κάθε
 * ρίζα (`parentId === null`) είναι ένα δέντρο (Akeneo category trees) — π.χ. «Έντυπος
 * κατάλογος 2026» με τα κεφάλαιά του, και χωριστά «Πλοήγηση βιτρίνας».
 *
 * 🔑 **`ancestorIds`** (materialized path, ρίζα → γονέας): «όλα τα προϊόντα κάτω από
 * Κλιματισμός» γίνεται **ένα** ερώτημα `array-contains`, χωρίς αναδρομή. Τα γράφει **μόνο**
 * ο γραφέας — και κατά τη μετακίνηση ξαναγράφει ολόκληρο το υποδέντρο στην **ίδια**
 * συναλλαγή (γι' αυτό υπάρχει όριο βάθους).
 * @module subapps/catalog/types/category
 */

import type { LocalizedText } from '@/i18n/localized-text';

export interface CatalogCategoryMappings {
  /** Κατηγορία ΑΤΟΕ (ADR-923 §5.8) — αντιστοίχιση, όχι νέα ταξινομία. */
  readonly atoeCode: string | null;
}

export interface CatalogCategoryDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly parentId: string | null;
  /** Πρόγονοι από τη ρίζα προς τον γονέα. Γράφεται μόνο από τον γραφέα. */
  readonly ancestorIds: readonly string[];
  /** Κλειδί σειράς ανάμεσα στα αδέλφια (fractional index). */
  readonly orderKey: string;
  readonly mappings: CatalogCategoryMappings;
}
