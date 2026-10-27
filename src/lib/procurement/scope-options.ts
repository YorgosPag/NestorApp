/**
 * Επιλογές επιλογέα για υλικά · κατηγορίες ΑΤΟΕ · έργα — η ΜΙΑ αντιστοίχιση (ADR-923 §5.11 «3γ», Βήμα 2)
 *
 * Η ίδια αντιστοίχιση ήταν γραμμένη χωριστά σε κάθε επιλογέα (φίλτρα αναλύσεων · γραμμές PO · φόρμα
 * υλικού · επιλογέας έργου PO), με **διαφορετική** ετικέτα για το ίδιο πράγμα (`p.name` εδώ, `p.name ||
 * p.title || p.id` εκεί). Μια σύμβαση που δείχνει «Καλώδιο» στη φόρμα και «CBL-001 — Καλώδιο» στη γραμμή
 * PO είναι το ίδιο υλικό με δύο ονόματα. Εδώ ζει **μία** φορά· η μετάφραση της κατηγορίας έρχεται από τον
 * καλούντα (καθαρό module, χωρίς React/i18n).
 *
 * Ο τύπος επιστροφής είναι δομικά συμβατός με το `ComboboxOption` και το `MultiComboboxOption`.
 */

import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';

export interface ScopeOption {
  readonly value: string;
  readonly label: string;
  readonly secondaryLabel?: string;
}

/** «OIK-9 — Ηλεκτρολογικά». `nameOf` = η μεταφρασμένη ονομασία της κατηγορίας. */
export function atoeCategoryOptions(nameOf: (code: string) => string): ScopeOption[] {
  return ATOE_MASTER_CATEGORIES.map(({ code }) => ({ value: code, label: `${code} — ${nameOf(code)}` }));
}

export interface ProjectOptionSource {
  readonly id: string;
  readonly name?: string | null;
  readonly title?: string | null;
}

/** Το όνομα του έργου, με το `title` και την ταυτότητα ως εφεδρεία. */
export function projectOptionLabel(project: ProjectOptionSource): string {
  return project.name || project.title || project.id;
}

export function projectsToOptions(projects: readonly ProjectOptionSource[]): ScopeOption[] {
  return projects.map((project) => ({ value: project.id, label: projectOptionLabel(project) }));
}

export interface MaterialOptionSource {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** «CBL-001 — Καλώδιο» — ίδια ετικέτα με τη γραμμή PO. */
export function materialOptionLabel(material: MaterialOptionSource): string {
  return `${material.code} — ${material.name}`;
}

export function materialsToOptions(materials: readonly MaterialOptionSource[]): ScopeOption[] {
  return materials.map((material) => ({ value: material.id, label: materialOptionLabel(material) }));
}
