'use client';

/**
 * Οι επιλογές και οι ετικέτες της εμβέλειας σύμβασης — ΜΙΑ πηγή για φόρμα, λεπτομέρεια και προειδοποίηση
 * ισοπαλίας (ADR-923 §5.11 «3γ», Βήμα 2). Δεδομένα από τα υπάρχοντα hooks (`useMaterials` ·
 * `useFirestoreProjects` · `ATOE_MASTER_CATEGORIES`), αντιστοίχιση από το `lib/procurement/scope-options`.
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useMaterials } from '@/hooks/procurement/useMaterials';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import {
  atoeCategoryOptions,
  materialsToOptions,
  projectsToOptions,
  type ScopeOption,
} from '@/lib/procurement/scope-options';

export interface AgreementScopeOptions {
  readonly materialOptions: readonly ScopeOption[];
  readonly categoryOptions: readonly ScopeOption[];
  readonly projectOptions: readonly ScopeOption[];
  /** Ετικέτα ταυτότητας· άγνωστη (π.χ. διαγραμμένο υλικό) ⇒ η ίδια η ταυτότητα, ποτέ κενό. */
  readonly labelOfMaterial: (id: string) => string;
  readonly labelOfCategory: (code: string) => string;
  readonly labelOfProject: (id: string) => string;
}

function labelLookup(options: readonly ScopeOption[]): (value: string) => string {
  const byValue = new Map(options.map((option) => [option.value, option.label]));
  return (value) => byValue.get(value) ?? value;
}

export function useAgreementScopeOptions(): AgreementScopeOptions {
  const { t } = useTranslation('procurement');
  const { materials } = useMaterials();
  const { projects } = useFirestoreProjects();

  const categoryName = useCallback((code: string) => t(`categories.${code}`), [t]);
  const materialOptions = useMemo(() => materialsToOptions(materials), [materials]);
  const categoryOptions = useMemo(() => atoeCategoryOptions(categoryName), [categoryName]);
  const projectOptions = useMemo(() => projectsToOptions(projects), [projects]);

  return useMemo(
    () => ({
      materialOptions,
      categoryOptions,
      projectOptions,
      labelOfMaterial: labelLookup(materialOptions),
      labelOfCategory: labelLookup(categoryOptions),
      labelOfProject: labelLookup(projectOptions),
    }),
    [materialOptions, categoryOptions, projectOptions],
  );
}
