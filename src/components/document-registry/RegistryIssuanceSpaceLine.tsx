'use client';

/**
 * @fileoverview ADR-915 §39 — **«Χώρος συνεργασίας»** στην κάρτα ανάθεσης του γραφείου: στάλθηκε · ανοίχτηκε · έληξε ·
 *   αρνήθηκε · μπήκε — και το «Νέος σύνδεσμος εισόδου» (μοτίβο Procore «Re-invite»· ο παλιός σύνδεσμος ακυρώνεται).
 * @related lib/document-validity/issuance-space.ts (η παραγωγή) · server/issuance-invitations/issuance-space-invite.ts
 * @module components/document-registry/RegistryIssuanceSpaceLine
 *
 * 🔑 Η κατάσταση **παράγεται** από την πρόσκληση — τίποτα δεν αποθηκεύεται στην ανάθεση· το `ballInCourt` μένει ό,τι ήταν.
 * 🔑 Πάνω από Procore: το γραφείο βλέπει και **αν άνοιξε** τη σελίδα ο επαγγελματίας, όχι μόνο αν απάντησε.
 * 🔑 Η πράξη **δεν** είναι αισιόδοξη: το αποτέλεσμα (email δεκτό ή όχι) το λέει ο διακομιστής, και το μητρώο ξαναδιαβάζεται.
 * Χωρίς δικαίωμα (`canAct: false`) η γραμμή λέει την κατάσταση **χωρίς** κουμπί (εργονομία, όχι ασφάλεια — ADR-801).
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import {
  ISSUANCE_SPACE_KEYS,
  ISSUANCE_SPACE_REFUSAL_KEYS,
  ISSUANCE_SPACE_STATUS_KEYS,
} from '@/components/document-registry/issuance-labels';
import type { RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { canResendSpaceInvitation, type IssuanceSpaceStatus } from '@/lib/document-validity/issuance-space';
import { formatDate } from '@/lib/intl-formatting';
import { useNotifications } from '@/providers/NotificationProvider';
import { sendIssuanceSpaceInvitation } from '@/services/document-registry/document-registry.client';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Η κατάσταση ως **μία** πρόταση με ημερομηνία — λέξη, όχι χρώμα. */
function statusText(t: Translate, status: IssuanceSpaceStatus): string {
  switch (status.kind) {
    case 'none':
      return t(ISSUANCE_SPACE_STATUS_KEYS.none);
    case 'invited': {
      const sent = t(ISSUANCE_SPACE_STATUS_KEYS.invited, { date: formatDate(status.sentAt), expires: formatDate(status.expiresAt) });
      const opened = status.openedAt === null
        ? t(ISSUANCE_SPACE_KEYS.notOpened)
        : t(ISSUANCE_SPACE_KEYS.opened, { date: formatDate(status.openedAt) });
      return `${sent} · ${opened}`;
    }
    case 'expired':
      return t(ISSUANCE_SPACE_STATUS_KEYS.expired, { date: formatDate(status.sentAt) });
    case 'declined':
      return t(ISSUANCE_SPACE_STATUS_KEYS.declined, { date: formatDate(status.at) });
    case 'entered':
      return t(ISSUANCE_SPACE_STATUS_KEYS.entered, { date: formatDate(status.at) });
  }
}

function useSpaceInvitation(view: RegistryIssuanceView) {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const { success, warning, error } = useNotifications();
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    const result = await sendIssuanceSpaceInvitation({ propertyId: view.propertyId, documentKind: view.kind });
    setSending(false);
    if (result.kind === 'failed') {
      error(t(ISSUANCE_SPACE_REFUSAL_KEYS[result.code ?? 'generic'] ?? ISSUANCE_SPACE_REFUSAL_KEYS.generic));
      return;
    }
    // Η πρόσκληση **υπάρχει** σε κάθε περίπτωση· το email μπορεί να μην ταξίδεψε — λέγεται, ποτέ σιωπηλό «στάλθηκε».
    if (result.data.delivery === 'accepted') success(t(ISSUANCE_SPACE_KEYS.sent));
    else warning(t(ISSUANCE_SPACE_KEYS.sentUndelivered));
    await actions?.revalidate();
  };
  return { send, sending, canAct: actions?.canAct ?? false };
}

export function RegistryIssuanceSpaceLine({ view }: { readonly view: RegistryIssuanceView }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const { send, sending, canAct } = useSpaceInvitation(view);
  const status = view.space;
  if (status === null) return null;
  return (
    <section className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label={t(ISSUANCE_SPACE_KEYS.label)}>
      <span className="text-muted-foreground">{t(ISSUANCE_SPACE_KEYS.label)}</span>
      <span className="text-foreground">{statusText(t, status)}</span>
      {canAct && canResendSpaceInvitation(status) ? (
        <Button type="button" size="sm" variant="outline" disabled={sending} aria-busy={sending} onClick={() => { void send(); }}>
          {sending ? t(ISSUANCE_SPACE_KEYS.sending) : t(status.kind === 'none' ? ISSUANCE_SPACE_KEYS.send : ISSUANCE_SPACE_KEYS.resend)}
        </Button>
      ) : null}
    </section>
  );
}
