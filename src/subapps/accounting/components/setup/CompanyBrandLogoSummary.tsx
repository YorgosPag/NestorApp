'use client';

/**
 * @fileoverview **Το λογότυπο των παραστατικών, μόνο για ανάγνωση** + σύνδεσμος προς το ΕΝΑ σημείο αλλαγής
 *   (ADR-ACC-018 §17).
 * @module subapps/accounting/components/setup/CompanyBrandLogoSummary
 *
 * Καμία δεύτερη φόρμα ανεβάσματος: η αλλαγή γίνεται **μόνο** στις Ρυθμίσεις → Εταιρεία (μοτίβο QuickBooks: «κλικ στο
 * λογότυπο → ρυθμίσεις»). Κείμενα από το namespace της λογιστικής (ήδη φορτωμένο εδώ) — όχι από το `org-structure`,
 * που θα πρόσθετε αναμονή εκτός εκκίνησης στη διαδρομή (ADR-744 §27).
 */

import { useCompanyBrandLogo } from '@/components/settings/company/brand/useCompanyBrandLogo';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { fileDisplayUrl } from '@/lib/files/file-display-url';
import { Link } from '@/lib/workspace/navigation';

const COMPANY_SETTINGS_PATH = '/settings/company';

export function CompanyBrandLogoSummary() {
  const { t } = useTranslation('accounting');
  const { state } = useCompanyBrandLogo();
  const url = state.brandLogo
    ? fileDisplayUrl({ storagePath: state.brandLogo.storagePath, contentType: state.brandLogo.contentType })
    : null;

  return (
    <figure className="flex items-center gap-3">
      {/* Χαρτί: το PDF είναι πάντα λευκό. */}
      <span className="flex h-12 w-24 items-center justify-center rounded border border-border bg-white p-1">
        {url ? <img src={url} alt={t('setup.brandLogo.alt')} className="max-h-full max-w-full object-contain" /> : null}
      </span>
      <figcaption className="space-y-1 text-sm">
        <span className="block font-medium">{t('setup.brandLogo.title')}</span>
        {state.loading ? null : (
          <span className="block text-muted-foreground">
            {url ? null : `${t('setup.brandLogo.empty')} `}
            <Link href={COMPANY_SETTINGS_PATH} className="underline underline-offset-2">
              {t('setup.brandLogo.manage')}
            </Link>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
