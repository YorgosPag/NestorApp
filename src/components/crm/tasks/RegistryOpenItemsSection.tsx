'use client';

/**
 * @fileoverview ADR-915 §45 Φ4 — **«Από το μητρώο λήξεων»** στις εργασίες του CRM: πόσες αναθέσεις έκδοσης είναι σε
 *   εξέλιξη και πόσες καθυστερούν, με «Άνοιγμα» στο μητρώο (Procore «Open Items»: σύνοψη δίπλα στα Tasks). Κάτοχος το
 *   μητρώο, όχι το CRM ⇒ μόνο ανάγνωση. Τα **μεμονωμένα** στοιχεία φαίνονται στο ημερολόγιο (ίδια πηγή).
 * @related lib/document-validity/issuance-open-item.ts (η προβολή) · services/calendar/CalendarEventService.ts (το ημερολόγιο)
 * @module components/crm/tasks/RegistryOpenItemsSection
 *
 * 🔑 **Σύνοψη, όχι γραμμές μέσα στη λίστα εργασιών**: εκεί κάθε γραμμή είναι επεξεργάσιμη εργασία με πάνελ λεπτομερειών —
 *    μια ανάθεση δεν είναι. Και μόνο κλειδιά `crm`: τα ονόματα εγγράφων και οι βαθμίδες ζουν στο μητρώο (ΕΝΑ λεξιλόγιο,
 *    καμία νέα αναμονή namespace στη διαδρομή — CHECK 3.34).
 * 🔑 Καμία εκκρεμότητα ⇒ καμία ενότητα· δεν διαβάστηκε ⇒ σιωπή (ποτέ «καμία εκκρεμότητα» που δεν ξέρουμε).
 */

import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { documentExpiryHref } from '@/lib/document-validity/document-registry-view';
import { Link } from '@/lib/workspace/navigation';
import { fetchIssuanceOpenItems } from '@/services/document-registry/document-registry.client';

export function RegistryOpenItemsSection(): React.ReactElement | null {
  const { t } = useTranslation(['crm']);
  const { data } = useAsyncData({ fetcher: fetchIssuanceOpenItems, deps: [] });
  if (data === null || !data.known || data.items.length === 0) return null;
  const late = data.items.filter((item) => item.lateness.tier === 'overdue').length;
  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm" aria-label={t('crm:tasks.registryItems.heading')}>
      <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <h2 className="m-0 text-sm font-semibold">{t('crm:tasks.registryItems.heading')}</h2>
      <span>{t('crm:tasks.registryItems.open', { count: data.items.length })}</span>
      {late === 0 ? null : <span className="font-medium text-destructive">{t('crm:tasks.registryItems.late', { count: late })}</span>}
      <span className="text-xs text-muted-foreground">{t('crm:tasks.registryItems.hint')}</span>
      <Button asChild variant="ghost" size="sm" className="ml-auto gap-1">
        <Link href={documentExpiryHref(undefined, { tab: late === 0 ? 'all' : 'late' })}>
          {t('crm:tasks.registryItems.action')}
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
