'use client';

/**
 * =============================================================================
 * «Οι υποθέσεις μου» — η λίστα του επαγγελματία (ADR-901 Φ2 §5.4 · ADR-862 Φ1)
 * =============================================================================
 *
 * Είναι η «Κοινόχρηστα μαζί μου» του ADR-862 Φ1, για το πρότυπο `legal` — **φίλτρο**, όχι δεύτερη λίστα:
 * collection-group στις συμμετοχές του ανθρώπου, ποτέ ανάγνωση χώρου.
 *
 * 🔑 §15 Γ2 (Α6) — **μία λίστα, δύο κελύφη**: το κέλυφος (γραφείο · προσωπικός) δηλώνει το `home` του και κατέχει
 *    το ορόσημο `<main>`· ο server επιστρέφει **μόνο** όσες φαίνονται σε αυτόν τον χώρο (οι προτάσεις που
 *    περιμένουν απάντηση φαίνονται παντού). Καμία δεύτερη λίστα για το γραφείο.
 * 🔑 Κεφαλίδα και καταστάσεις λίστας από τα SSoT του προσωπικού χώρου (`PrivatePageHeader` · `OwnedListStatus`)
 *    — ίδια όψη με «Οι αγγελίες μου» / «Οι φάκελοί μου» (CHECK 3.28). «Δεν φορτώθηκε» ≠ «δεν έχετε υποθέσεις».
 *
 * @module components/conveyance/my-cases/MyCasesContent
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// ⚠️ ΚΑΝΕΝΑ route slice εδώ (ADR-744 §15): η σελίδα υπηρετεί ΔΥΟ διαδρομές — το καταχωρεί το `page.tsx` κάθε κελύφους.
import { OwnedListStatus } from '@/components/private-space/OwnedListStatus';
import { PrivatePageHeader } from '@/components/private-space/PrivatePageHeader';
import { useNotifications } from '@/providers/NotificationProvider';
import { useMyCases } from '@/hooks/useMyCases';
import type { MyCaseCard } from '@/types/conveyance-case';
import type { ActingWorkspaceRequest } from '@/lib/auth/acting-workspace';
import type { CaseHome } from '@/lib/conveyance/conveyance-routes';
import type { CaseEngagementAnswer, CredentialDeclarationInput } from '@/lib/conveyance/declared-credential';
import { AcceptEngagementDialog } from './AcceptEngagementDialog';
import { MyCaseCardView } from './MyCaseCardView';

interface CaseListProps {
  readonly home: CaseHome;
  readonly cards: readonly MyCaseCard[];
  readonly pending: ReadonlySet<string>;
  readonly onRespond: (engagementId: string, decision: 'accept' | 'decline') => void;
}

function CaseList({ home, cards, pending, onRespond }: CaseListProps) {
  const { t } = useTranslation(['conveyance']);
  if (cards.length === 0) return <p className="text-muted-foreground">{t('engagement.myCases.empty')}</p>;
  return (
    <ul className="grid gap-3">
      {cards.map((card) => (
        <li key={card.engagementId}>
          <MyCaseCardView card={card} home={home} busy={pending.has(card.engagementId)} onRespond={onRespond} />
        </li>
      ))}
    </ul>
  );
}

export function MyCasesContent({ home }: { readonly home: CaseHome }) {
  const { t } = useTranslation(['conveyance']);
  const { error: notifyError } = useNotifications();
  const { list, pending, respond } = useMyCases(home);
  /** Η πρόταση που αναλαμβάνεται — ο διάλογος δήλωσης ανοίγει **πριν** φύγει οτιδήποτε (Ε-4). */
  const [accepting, setAccepting] = useState<MyCaseCard | null>(null);

  const send = useCallback((engagementId: string, answer: CaseEngagementAnswer) => {
    void respond(engagementId, answer).then((outcome) => {
      if (!outcome.ok) notifyError(t(`engagement.myCases.respondRejections.${outcome.rejection}`));
    });
  }, [notifyError, respond, t]);

  const onRespond = useCallback((engagementId: string, decision: 'accept' | 'decline') => {
    if (decision === 'decline') { send(engagementId, { decision }); return; }
    const card = list.state === 'ready' ? list.cards.find((c) => c.engagementId === engagementId) ?? null : null;
    setAccepting(card);
  }, [list, send]);

  // Optimistic: ο διάλογος κλείνει αμέσως, η κάρτα γίνεται «Έχει πρόσβαση»· αποτυχία ⇒ επαναφορά + ονομασμένος λόγος.
  const onConfirmAccept = useCallback((engagementId: string, credential: CredentialDeclarationInput, actingRequest?: ActingWorkspaceRequest) => {
    setAccepting(null);
    // §15 Γ1 — το αίτημα χώρου φεύγει **μόνο** όταν ο άνθρωπος διάλεξε (2+ γραφεία)· αλλιώς το πεδίο λείπει.
    send(engagementId, { decision: 'accept', credential, ...(actingRequest ? { actingRequest } : {}) });
  }, [send]);

  return (
    <section className="flex w-full flex-col gap-6">
      <PrivatePageHeader title={t('engagement.myCases.title')} lead={t('engagement.myCases.subtitle')} />
      <OwnedListStatus
        state={list}
        loadingText={t('engagement.myCases.loading')}
        errorText={t('engagement.myCases.loadError')}
        renderReady={(ready) => <CaseList home={home} cards={ready.cards} pending={pending} onRespond={onRespond} />}
      />
      <AcceptEngagementDialog
        card={accepting}
        busy={accepting !== null && pending.has(accepting.engagementId)}
        onCancel={() => setAccepting(null)}
        onConfirm={onConfirmAccept}
      />
    </section>
  );
}
