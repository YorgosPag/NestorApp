'use client';

/**
 * @fileoverview ADR-943 Φ5δ — **ο πίνακας «Προκαταβολή» του γραφείου**: όροι · ποσά (εισπράχθηκαν / επεστράφησαν /
 *   αποδόθηκαν / κρατούνται) · η κίνηση που οφείλεται και γιατί · ΜΑΡΚ · χρονολόγιο. Φορτώνεται με `next/dynamic` **μόνο**
 *   όταν ανοίξει ο διάλογος (CHECK 3.34).
 * @related lib/document-validity/issuance-advance.ts (`advanceGlanceOf` · `advanceLedgerOf` · `advanceTimelineOf`) ·
 *   lib/document-validity/issuance-advance-settlement.ts (`advanceSettlementDueOf`) · RegistryIssuanceAdvanceLine.tsx (πού ζει)
 * @module components/document-registry/RegistryIssuanceAdvancePanel
 *
 * 🏆 Stripe Dashboard «payment»: ποσά + χρονολόγιο σε μία σελίδα. Πέρα από αυτό: η **εκκρεμής** κίνηση με τον λόγο της,
 *    από την ΙΔΙΑ κρίση που εκτελεί ο εκτελεστής χρημάτων — ποτέ μια δεύτερη αλήθεια της οθόνης.
 * 🔑 Μόνο ανάγνωση: κάθε πράξη (ΜΑΡΚ · αντίρρηση · διαφορά · σύνδεσμος) ζει στη γραμμή, με τα δικά της δικαιώματα.
 */

import React from 'react';

import { policyText } from '@/components/document-registry/issuance-advance-labels';
import { advanceTimelineText, settlementBasisText } from '@/components/document-registry/issuance-advance-timeline-labels';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { ISSUANCE_ADVANCE_PANEL_KEYS } from '@/components/document-registry/issuance-labels';
import { IssuanceAdvanceTimelineList } from '@/components/document-registry/IssuanceAdvanceTimelineList';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { advanceGlanceOf, advanceLedgerOf, advanceTimelineOf, type AdvanceLedger } from '@/lib/document-validity/issuance-advance';
import { advanceSettlementDueOf } from '@/lib/document-validity/issuance-advance-settlement';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { formatDate } from '@/lib/intl-formatting';
import { formatMinor } from '@/lib/money/money';
import { formatOperatorDateTime } from '@/lib/operator-time-format';

const K = ISSUANCE_ADVANCE_PANEL_KEYS;

function Amounts({ ledger }: { readonly ledger: AdvanceLedger }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const rows = [
    [K.funded, ledger.fundedMinor], [K.refunded, ledger.refundedMinor], [K.released, ledger.releasedMinor], [K.held, ledger.heldMinor],
  ] as const;
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([key, minor]) => (
        <React.Fragment key={key}>
          <dt className="text-muted-foreground">{t(key)}</dt>
          <dd className="m-0 text-right tabular-nums text-foreground">{formatMinor(minor)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** Η κίνηση που οφείλεται — **ό,τι μένει** να κινηθεί (σύνολο της κρίσης − ό,τι έχει ήδη βεβαιώσει ο πάροχος). */
function Pending({ record, ledger }: { readonly record: IssuanceAssignmentRecord; readonly ledger: AdvanceLedger }): React.ReactElement | null {
  const { t, i18n } = useTranslation([REGISTRY_NS]);
  const due = advanceSettlementDueOf(record);
  if (due === null) return null;
  const refund = Math.max(0, due.refundMinor - ledger.refundedMinor);
  const release = Math.max(0, due.releaseMinor - ledger.releasedMinor);
  return (
    <p className="m-0 text-sm text-foreground" role="status">
      {t(K.pending, {
        basis: settlementBasisText(t, due.basis), refund: formatMinor(refund), release: formatMinor(release),
        date: formatOperatorDateTime(due.dueAt, i18n.language),
      })}
    </p>
  );
}

export function RegistryIssuanceAdvancePanel({ record }: { readonly record: IssuanceAssignmentRecord }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const glance = advanceGlanceOf(record);
  if (glance === null) return null;
  const ledger = advanceLedgerOf(record);
  const { terms, receipt } = glance;
  return (
    <section className="flex flex-col gap-3" aria-label={t(K.title)}>
      {terms === null ? null : (
        <p className="m-0 text-sm text-foreground">{t(K.terms, { amount: formatMinor(terms.amountMinor), policy: policyText(t, terms.policy) })}</p>
      )}
      <h3 className="m-0 text-sm font-semibold">{t(K.amountsHeading)}</h3>
      <Amounts ledger={ledger} />
      <Pending record={record} ledger={ledger} />
      <h3 className="m-0 text-sm font-semibold">{t(K.receiptHeading)}</h3>
      {receipt !== null ? (
        <p className="m-0 text-sm text-foreground">{t(K.receipt, { mark: receipt.mark, date: formatDate(receipt.issuedOn) })}</p>
      ) : glance.receiptDue ? (
        <p className="m-0 text-sm text-muted-foreground">{t(K.receiptDue, { amount: formatMinor(glance.collectedMinor) })}</p>
      ) : null}
      {glance.refundedAfterReceipt ? <p className="m-0 text-sm text-destructive" role="alert">{t(K.refundedAfterReceipt)}</p> : null}
      <h3 className="m-0 text-sm font-semibold">{t(K.timelineHeading)}</h3>
      <IssuanceAdvanceTimelineList timeline={advanceTimelineOf(record)} textOf={(entry) => advanceTimelineText(t, entry)} />
    </section>
  );
}
