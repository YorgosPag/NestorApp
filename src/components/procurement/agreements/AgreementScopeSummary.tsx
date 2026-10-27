'use client';

/**
 * «Εφαρμόζεται σε» — η εμβέλεια σύμβασης στη λεπτομέρεια (ADR-923 §5.11 «3γ», Βήμα 2). Ίδιες δύο
 * διαστάσεις και ίδιες ετικέτες με τη φόρμα (`agreement-scope-form` · `useAgreementScopeOptions`).
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAgreementScopeOptions } from '@/hooks/procurement/useAgreementScopeOptions';
import type { AgreementScopeFields } from './agreement-scope-form';

const NS = 'hub.frameworkAgreements.detail';

function ScopeRow({ label, values, allLabel }: { readonly label: string; readonly values: readonly string[] | null; readonly allLabel: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap gap-1 text-sm">
        {values === null
          ? allLabel
          : values.map((value) => (
              <Badge key={value} variant="outline">
                {value}
              </Badge>
            ))}
      </dd>
    </div>
  );
}

export function AgreementScopeSummary({ scope }: { readonly scope: AgreementScopeFields }) {
  const { t } = useTranslation('procurement');
  const { labelOfMaterial, labelOfCategory, labelOfProject } = useAgreementScopeOptions();
  const materials = scope.applicableMaterialIds;
  const categories = scope.applicableAtoeCategoryCodes;
  const items =
    materials === null && categories === null
      ? null
      : [...(materials ?? []).map(labelOfMaterial), ...(categories ?? []).map(labelOfCategory)];
  const projects = scope.applicableProjectIds?.map(labelOfProject) ?? null;

  return (
    <section>
      <h3 className="mb-3 text-sm font-medium">{t(`${NS}.scope`)}</h3>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScopeRow label={t(`${NS}.scopeItems`)} values={items} allLabel={t(`${NS}.scopeAllItems`)} />
        <ScopeRow label={t(`${NS}.scopeProjects`)} values={projects} allLabel={t(`${NS}.scopeAllProjects`)} />
      </dl>
    </section>
  );
}
