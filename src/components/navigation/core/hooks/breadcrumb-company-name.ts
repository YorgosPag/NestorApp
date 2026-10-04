/**
 * **ΤΟ ΟΝΟΜΑ ΤΗΣ ΕΤΑΙΡΕΙΑΣ ΣΤΟ BREADCRUMB — ΠΟΤΕ Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ** (ADR-016).
 *
 * 🔴 Ως τις 2026-10-04 τρία σημεία του `useBreadcrumbSync` έγραφαν `όνομα || companyId`. Όταν το
 * όνομα έλειπε (νέο έργο πριν την ενυδάτωση, έργο πλοήγησης που δεν φορτώθηκε ακόμη) ο άνθρωπος
 * έβλεπε `cont_3f2a…` στη γραμμή πλοήγησης (μετρημένο ζωντανά). Μια ταυτότητα **δεν είναι όνομα**·
 * το «δεν ξέρω ακόμη» λέγεται με **κενό**, και το breadcrumb τότε παραλείπει τον κρίκο.
 *
 * @module components/navigation/core/hooks/breadcrumb-company-name
 */

import type { NavigationCompany, NavigationProject } from '../types';

type Crumb = { readonly id: string; readonly name: string };

/**
 * Οι δύο πρώτοι κρίκοι (εταιρεία → έργο) ενός έργου της πλοήγησης — ό,τι μοιράζονται το κτίριο
 * και ο χώρος, που κρέμονται κάτω από το ίδιο έργο.
 */
export function projectBreadcrumbTrail(
  project: NavigationProject,
  companies: readonly NavigationCompany[],
): { company: Crumb; project: Crumb } {
  const companyId = project.linkedCompanyId || project.companyId;
  return {
    company: {
      id: companyId,
      name: breadcrumbCompanyName({ companyId, candidates: [project.company], companies }),
    },
    project: { id: project.id, name: project.name },
  };
}

export interface BreadcrumbCompanyNameInput {
  /** Η ταυτότητα της εταιρείας — χρησιμεύει **μόνο** για αναζήτηση, ποτέ ως εμφανιζόμενη τιμή. */
  readonly companyId: string;
  /** Ονόματα κατά σειρά εμπιστοσύνης (π.χ. έργο πλοήγησης, μετά η ίδια η οντότητα). */
  readonly candidates: readonly (string | null | undefined)[];
  /** Οι εταιρείες που ξέρει ήδη η πλοήγηση — η τελευταία πηγή ονόματος. */
  readonly companies: readonly NavigationCompany[];
}

/** @returns το όνομα, ή `''` όταν κανείς δεν το ξέρει ακόμη. Ποτέ το `companyId`. */
export function breadcrumbCompanyName({
  companyId,
  candidates,
  companies,
}: BreadcrumbCompanyNameInput): string {
  for (const candidate of candidates) {
    const name = candidate?.trim() ?? '';
    // Παλιά δεδομένα κουβαλούν την ταυτότητα μέσα στο πεδίο `company` — ούτε αυτό είναι όνομα.
    if (name && name !== companyId) return name;
  }
  if (!companyId) return '';
  return companies.find((company) => company.id === companyId)?.companyName?.trim() ?? '';
}
