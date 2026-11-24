'use client';

/**
 * @fileoverview **«Το ΑΦΜ του χώρου το έχει ήδη άλλη επαφή»** — η ρητή επιβεβαίωση πριν από διπλή επαφή (ADR-951 §4).
 * @module components/settings/company/self-contact/TaxIdTakenPrompt
 *
 * 🔑 **Οδηγεί η απάντηση του server**, όχι εικασία του browser: εμφανίζεται μόνο όταν ο γραφέας αρνήθηκε με
 *    `tax-id-taken` και έστειλε τους κατόχους — ίδια κρίση (ADR-944 §9 `decideVatDuplicate`) με τη φόρμα επαφής.
 * 🔑 **Πρώτα η σύνδεση, μετά η δημιουργία** (μοτίβο Odoo `same_vat_partner_id`: προειδοποίηση, όχι σιωπηλό διπλότυπο):
 *    κάθε κάτοχος είναι σύνδεσμος στην καρτέλα του· η «δημιουργία παρ' όλα αυτά» είναι δευτερεύουσα, με όνομα.
 * 🔑 Κάτοχος **στο αρχείο** μετρά (Odoo `active_test=False`) και σημαδεύεται — δεν συνδέεται πριν επανέλθει. Επαφή στον
 *    **κάδο** δεν είναι κάτοχος (ADR-944 §9.7) και δεν φτάνει ποτέ εδώ.
 */

import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getEntityHref } from '@/lib/navigation/entity-href';
import { Link } from '@/lib/workspace/navigation';
import type { SelfContactTaxIdHolder } from '@/types/company-self-contact';

interface TaxIdTakenPromptProps {
  readonly holders: readonly SelfContactTaxIdHolder[];
  readonly busy: boolean;
  readonly onCreateAnyway: () => void;
  readonly onCancel: () => void;
}

export function TaxIdTakenPrompt({ holders, busy, onCreateAnyway, onCancel }: TaxIdTakenPromptProps) {
  const { t } = useTranslation('org-structure');
  const titleId = useId();
  return (
    <section role="alert" aria-labelledby={titleId} className="space-y-3 rounded-md border border-destructive/50 p-3">
      <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
        {t('orgStructure.selfContact.taxIdTaken.title')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('orgStructure.selfContact.taxIdTaken.description')}</p>
      <ul className="space-y-1 text-sm">
        {holders.map((holder) => (
          <li key={holder.contactId} className="flex flex-wrap items-center gap-2">
            <Link href={getEntityHref('contact', holder.contactId)} className="font-medium underline underline-offset-2">
              {holder.displayName || t('orgStructure.selfContact.unnamedContact')}
            </Link>
            {holder.archived ? (
              <span className="text-muted-foreground">({t('orgStructure.selfContact.taxIdTaken.archived')})</span>
            ) : null}
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          {t('orgStructure.selfContact.taxIdTaken.cancel')}
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onCreateAnyway}>
          {t('orgStructure.selfContact.taxIdTaken.createAnyway')}
        </Button>
      </footer>
    </section>
  );
}
