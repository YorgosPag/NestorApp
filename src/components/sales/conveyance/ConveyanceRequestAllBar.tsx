'use client';

/**
 * ADR-901 Φ4.5 — «Ζήτησε όλα τα ελλείποντα (N)»: **ένα** πάτημα, **ένα** αίτημα, **μία** ειδοποίηση ανά παραλήπτη.
 *
 * Πριν φύγει, η επιβεβαίωση λέει **ποιοι** θα ειδοποιηθούν και για πόσα — «Συμβολαιογράφος (2) · Δικηγόρος αγοραστή
 * (1)». Οι μεγάλοι (Procore · Aconex) στέλνουν ένα μήνυμα ανά αίτημα· εδώ ο παραλήπτης παίρνει μία λίστα.
 *
 * @module components/sales/conveyance/ConveyanceRequestAllBar
 */

import React, { useMemo, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { CaseActorRole, ChecklistRow } from '@/types/conveyance-case';
import type { DocumentRequestTarget } from '@/types/conveyance-document-request';

interface ConveyanceRequestAllBarProps {
  readonly requestable: readonly ChecklistRow[];
  readonly targets: Readonly<Record<string, DocumentRequestTarget>>;
  readonly onConfirm: () => void;
}

/** Πόσες γραμμές πάνε σε κάθε παραλήπτη — η σειρά ακολουθεί την πρώτη εμφάνιση (σταθερή, όπως ο κατάλογος). */
function recipientCounts(rows: readonly ChecklistRow[], targets: Readonly<Record<string, DocumentRequestTarget>>): ReadonlyMap<CaseActorRole, number> {
  const counts = new Map<CaseActorRole, number>();
  for (const row of rows) {
    const target = targets[row.itemId];
    if (target?.ok) counts.set(target.recipient, (counts.get(target.recipient) ?? 0) + 1);
  }
  return counts;
}

export function ConveyanceRequestAllBar({ requestable, targets, onConfirm }: ConveyanceRequestAllBarProps) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const [open, setOpen] = useState(false);
  const recipients = useMemo(
    () => [...recipientCounts(requestable, targets)]
      .map(([recipient, count]) => t('requests.recipientCount', { recipient: t(`engagement.roles.${recipient}`), count }))
      .join(' · '),
    [requestable, targets, t],
  );
  if (requestable.length < 2) return null;
  return (
    <section className="flex justify-end" aria-label={t('requests.allConfirm.title')}>
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
        <BellRing className={iconSizes.xs} aria-hidden="true" />
        {t('requests.all', { count: requestable.length })}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('requests.allConfirm.title')}
        description={t('requests.allConfirm.description', { recipients })}
        confirmText={t('requests.allConfirm.confirm')}
        cancelText={t('requests.allConfirm.cancel')}
        onConfirm={() => { setOpen(false); onConfirm(); }}
      />
    </section>
  );
}
