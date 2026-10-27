/**
 * Μοντέλο φόρμας της εμβέλειας σύμβασης ↔ πεδία εγγράφου (ADR-923 §5.11 «3γ», Βήμα 2)
 *
 * Η φόρμα δείχνει ΔΥΟ διαστάσεις, όχι τρία ανεξάρτητα πεδία — γιατί έτσι κρίνει η μηχανή (`itemScopeRank`):
 *   - **Είδη**: «Όλα» ⇔ `applicableMaterialIds = null` **και** `applicableAtoeCategoryCodes = null`·
 *     «Επιλεγμένα» ⇔ ένωση υλικών **ή** κατηγοριών (αρκεί ένα)· μια κενή λίστα της ένωσης = `null`
 *     («δεν περιορίζει»), ΟΧΙ `[]` («τίποτα»).
 *   - **Έργα**: «Όλα» ⇔ `null` · «Επιλεγμένα» ⇔ λίστα.
 * Τρεις διακόπτες «Όλα | Επιλεγμένα» θα έδειχναν «Κατηγορίες: Όλα» δίπλα σε επιλεγμένα υλικά — ενώ η
 * σύμβαση **δεν** καλύπτει όλες τις κατηγορίες. Το «Επιλεγμένα» χωρίς τίποτα επιλεγμένο δεν αποθηκεύεται.
 */

import type { FrameworkAgreementLike } from '@/subapps/procurement/types/framework-agreement';

export type ScopeMode = 'all' | 'selected';
export const SCOPE_MODES: readonly ScopeMode[] = ['all', 'selected'];

export interface AgreementScopeForm {
  readonly itemsMode: ScopeMode;
  readonly materialIds: readonly string[];
  readonly categoryCodes: readonly string[];
  readonly projectsMode: ScopeMode;
  readonly projectIds: readonly string[];
}

export type AgreementScopeFields = Pick<
  FrameworkAgreementLike,
  'applicableMaterialIds' | 'applicableAtoeCategoryCodes' | 'applicableProjectIds'
>;

export const EMPTY_SCOPE_FORM: AgreementScopeForm = {
  itemsMode: 'all',
  materialIds: [],
  categoryCodes: [],
  projectsMode: 'all',
  projectIds: [],
};

export function scopeFormFromAgreement(agreement: AgreementScopeFields): AgreementScopeForm {
  const materials = agreement.applicableMaterialIds;
  const categories = agreement.applicableAtoeCategoryCodes;
  const projects = agreement.applicableProjectIds;
  return {
    itemsMode: materials === null && categories === null ? 'all' : 'selected',
    materialIds: materials ?? [],
    categoryCodes: categories ?? [],
    projectsMode: projects === null ? 'all' : 'selected',
    projectIds: projects ?? [],
  };
}

/** Κενή λίστα μέσα στην ένωση = «δεν περιορίζει» (`null`). */
const listOrNull = (values: readonly string[]): string[] | null => (values.length > 0 ? [...values] : null);

export function scopeFieldsFromForm(form: AgreementScopeForm): AgreementScopeFields {
  const selectedItems = form.itemsMode === 'selected';
  return {
    applicableMaterialIds: selectedItems ? listOrNull(form.materialIds) : null,
    applicableAtoeCategoryCodes: selectedItems ? listOrNull(form.categoryCodes) : null,
    applicableProjectIds: form.projectsMode === 'selected' ? [...form.projectIds] : null,
  };
}

export interface ScopeFormIssues {
  readonly itemsEmpty: boolean;
  readonly projectsEmpty: boolean;
}

export function scopeFormIssues(form: AgreementScopeForm): ScopeFormIssues {
  return {
    itemsEmpty: form.itemsMode === 'selected' && form.materialIds.length === 0 && form.categoryCodes.length === 0,
    projectsEmpty: form.projectsMode === 'selected' && form.projectIds.length === 0,
  };
}
