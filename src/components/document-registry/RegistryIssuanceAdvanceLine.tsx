'use client';

/**
 * @fileoverview ADR-943 Φ5β2 (§8 #11) — **η προκαταβολή στην κάρτα ανάθεσης του γραφείου**: πού είναι τα χρήματα, και
 *   «Αίτημα πληρωμής» (περιμένει πληρωμή) / «Νέος σύνδεσμος στον ιδιοκτήτη» (τρέχει το παράθυρο αντίρρησης).
 * @related lib/document-validity/issuance-advance.ts (`advanceGlanceOf`) · server/issuance-invitations/issuance-advance-payment-request.ts ·
 *   RegistryIssuanceSpaceLine.tsx (το ίδιο ιδίωμα) · RegistryIssuanceAccessCode.tsx (ο κωδικός §29, μία εμφάνιση)
 * @module components/document-registry/RegistryIssuanceAdvanceLine
 *
 * 🏆 Stripe «Send invoice»: ένα πάτημα, νέος έγκυρος σύνδεσμος — και (πέρα από Stripe) **μόνο** όταν ο ιδιοκτήτης έχει κάτι
 *    να κάνει· η κατάσταση και το κουμπί βγαίνουν από την **ίδια** ματιά του τομέα με τις οθόνες μηχανικού και ιδιοκτήτη.
 * 🔑 Η πράξη **δεν** είναι αισιόδοξη: το αποτέλεσμα (email δεκτό ή όχι) το λέει ο διακομιστής, και το μητρώο ξαναδιαβάζεται.
 * Χωρίς δικαίωμα (`canAct: false`) η γραμμή λέει την κατάσταση **χωρίς** κουμπί (εργονομία, όχι ασφάλεια — ADR-801).
 */

import React, { useState } from 'react';

import { advanceStateText } from '@/components/document-registry/issuance-advance-labels';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { ISSUANCE_ADVANCE_LINK_KEYS, ISSUANCE_ADVANCE_LINK_REFUSAL_KEYS } from '@/components/document-registry/issuance-labels';
import type { RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { RegistryIssuanceAdvanceDispute } from '@/components/document-registry/RegistryIssuanceAdvanceDispute';
import { AccessCodeToggle, IssuedAccessCode } from '@/components/document-registry/RegistryIssuanceAccessCode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { advanceGlanceOf, type AdvanceStateKind } from '@/lib/document-validity/issuance-advance';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { useNotifications } from '@/providers/NotificationProvider';
import { sendIssuanceAdvanceLink } from '@/services/document-registry/document-registry.client';

/** Ο ιδιοκτήτης έχει κάτι να κάνει στη σελίδα του — να πληρώσει ή να φέρει αντίρρηση. Ίδιος κανόνας με τον διακομιστή. */
function actionKeyOf(state: AdvanceStateKind): string | null {
  if (state === 'awaiting-payment') return ISSUANCE_ADVANCE_LINK_KEYS.requestPayment;
  return state === 'release-pending' ? ISSUANCE_ADVANCE_LINK_KEYS.resend : null;
}

function useAdvanceLinkSend(view: RegistryIssuanceView) {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const { success, warning, error } = useNotifications();
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const send = async (requireAccessCode: boolean): Promise<boolean> => {
    setSending(true);
    const result = await sendIssuanceAdvanceLink({ propertyId: view.propertyId, documentKind: view.kind, requireAccessCode });
    setSending(false);
    if (result.kind === 'failed') {
      error(t(ISSUANCE_ADVANCE_LINK_REFUSAL_KEYS[result.code ?? 'generic'] ?? ISSUANCE_ADVANCE_LINK_REFUSAL_KEYS.generic));
      return false;
    }
    // Ο σύνδεσμος **υπάρχει** σε κάθε περίπτωση· το email μπορεί να μην ταξίδεψε — λέγεται, ποτέ σιωπηλό «στάλθηκε».
    if (result.data.delivery === 'accepted') success(t(ISSUANCE_ADVANCE_LINK_KEYS.sent));
    else warning(t(ISSUANCE_ADVANCE_LINK_KEYS.sentUndelivered));
    setCode(result.data.accessCode);
    await actions?.revalidate();
    return result.data.accessCode === null;
  };
  return { send, sending, code, clearCode: () => setCode(null), canAct: actions?.canAct ?? false };
}

interface AdvanceLineProps {
  readonly view: RegistryIssuanceView;
  /**
   * Η εγγραφή της ανάθεσης — η ανοιχτή, ή (Φ5γ) η ακυρωμένη όσο ζουν ακόμη χρήματα σε αυτήν (διαφορά που περιμένει απόφαση ·
   * επιστροφή σε εξέλιξη).
   */
  readonly record: IssuanceAssignmentRecord;
  /** Ο ιδιοκτήτης της απόφασης — ο αποδέκτης του email (όνομα για τον διάλογο και τον κωδικό). */
  readonly ownerName: string;
}

export function RegistryIssuanceAdvanceLine({ view, record, ownerName }: AdvanceLineProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const { send, sending, code, clearCode, canAct } = useAdvanceLinkSend(view);
  const [open, setOpen] = useState(false);
  const [withCode, setWithCode] = useState(false);
  const glance = advanceGlanceOf(record);
  if (glance === null) return null;
  // Ακυρωμένη ανάθεση: κανένας νέος σύνδεσμος (η πόρτα θέλει ανοιχτή ανάθεση) — μόνο η απόφαση της διαφοράς.
  const actionKey = record.cancellation === null ? actionKeyOf(glance.state) : null;
  const close = () => { setOpen(false); clearCode(); };
  const confirm = () => { if (!sending) void send(withCode).then((done) => { if (done) setOpen(false); }); };
  return (
    <section className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label={t(ISSUANCE_ADVANCE_LINK_KEYS.label)}>
      <span className="text-muted-foreground">{t(ISSUANCE_ADVANCE_LINK_KEYS.label)}</span>
      <span className="text-foreground">{advanceStateText(t, glance.state)}</span>
      {canAct && actionKey !== null ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>{t(actionKey)}</Button>
      ) : null}
      <RegistryIssuanceAdvanceDispute view={view} record={record} />
      <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent>
          {code === null ? (
            <>
              <DialogHeader>
                <DialogTitle>{t(ISSUANCE_ADVANCE_LINK_KEYS.confirmTitle, { name: ownerName })}</DialogTitle>
                <DialogDescription>{t(ISSUANCE_ADVANCE_LINK_KEYS.confirmBody)}</DialogDescription>
              </DialogHeader>
              <AccessCodeToggle checked={withCode} onChange={setWithCode} />
              <DialogActionFooter
                cancelLabel={t(ISSUANCE_ADVANCE_LINK_KEYS.cancel)} confirmLabel={t(ISSUANCE_ADVANCE_LINK_KEYS.send)}
                busyLabel={t(ISSUANCE_ADVANCE_LINK_KEYS.sending)} onCancel={close} onConfirm={confirm} isSubmitting={sending} canSubmit
              />
            </>
          ) : (
            <IssuedAccessCode code={code} recipientName={ownerName} onDone={close} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
