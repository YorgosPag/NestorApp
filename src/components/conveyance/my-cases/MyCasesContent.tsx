'use client';

/**
 * =============================================================================
 * «Οι υποθέσεις μου» — η λίστα του επαγγελματία (ADR-901 Φ2 §5.4 · ADR-862 Φ1)
 * =============================================================================
 *
 * Είναι η «Κοινόχρηστα μαζί μου» του ADR-862 Φ1, για το πρότυπο `legal` — **φίλτρο**, όχι δεύτερη λίστα:
 * collection-group στις συμμετοχές του ανθρώπου, ποτέ ανάγνωση χώρου.
 *
 * 🔑 Κεφαλίδα και καταστάσεις λίστας από τα SSoT του προσωπικού χώρου (`PrivatePageHeader` · `OwnedListStatus`)
 *    — ίδια όψη με «Οι αγγελίες μου» / «Οι φάκελοί μου» (CHECK 3.28). «Δεν φορτώθηκε» ≠ «δεν έχετε υποθέσεις».
 *
 * @module components/conveyance/my-cases/MyCasesContent
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`: κρύβει το ωμό κλειδί από το CHECK 3.51).
import routeSlice from '@/i18n/generated/routes/cases.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { OwnedListStatus } from '@/components/private-space/OwnedListStatus';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { useNotifications } from '@/providers/NotificationProvider';
import { useMyCases } from '@/hooks/useMyCases';
import type { MyCaseCard } from '@/types/conveyance-case';
import { MyCaseCardView } from './MyCaseCardView';

registerRouteSlice(routeSlice);

interface CaseListProps {
  readonly cards: readonly MyCaseCard[];
  readonly pending: ReadonlySet<string>;
  readonly onRespond: (engagementId: string, decision: 'accept' | 'decline') => void;
}

function CaseList({ cards, pending, onRespond }: CaseListProps) {
  const { t } = useTranslation(['conveyance']);
  if (cards.length === 0) return <p className="text-muted-foreground">{t('engagement.myCases.empty')}</p>;
  return (
    <ul className="grid gap-3">
      {cards.map((card) => (
        <li key={card.engagementId}>
          <MyCaseCardView card={card} busy={pending.has(card.engagementId)} onRespond={onRespond} />
        </li>
      ))}
    </ul>
  );
}

export function MyCasesContent() {
  const { t } = useTranslation(['conveyance']);
  const { error: notifyError } = useNotifications();
  const { list, pending, respond } = useMyCases();

  const onRespond = useCallback((engagementId: string, decision: 'accept' | 'decline') => {
    void respond(engagementId, decision).then((outcome) => {
      if (!outcome.ok) notifyError(t(`engagement.myCases.respondRejections.${outcome.rejection}`));
    });
  }, [notifyError, respond, t]);

  return (
    <main className="flex w-full flex-col gap-6">
      <PrivatePageHeader title={t('engagement.myCases.title')} lead={t('engagement.myCases.subtitle')} />
      <OwnedListStatus
        state={list}
        loadingText={t('engagement.myCases.loading')}
        errorText={t('engagement.myCases.loadError')}
        renderReady={(ready) => <CaseList cards={ready.cards} pending={pending} onRespond={onRespond} />}
      />
    </main>
  );
}
