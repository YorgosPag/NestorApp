'use client';

/**
 * @fileoverview Μία γραμμή πρότασης — **μαρτυρία και κουμπί** (ADR-745 Φ3β, Τομέας Δ2).
 *
 * Δείχνει το **«γιατί»**, όχι ποσοστό βεβαιότητας: «ταιριάζει το τηλέφωνο», «το όνομα ταιριάζει
 * σε συντομογραφία». Εκεί ξεπερνάμε τα εμπορικά CAD — κανένα δεν εξηγεί την πρόταση που κάνει,
 * οπότε ο χρήστης είτε την εμπιστεύεται τυφλά είτε την αγνοεί.
 *
 * 🔴 **Ό,τι δεν συνδέεται εμφανίζεται ΜΕ ΑΙΤΙΑ**, ποτέ κρυμμένο (§8 κανόνας 3) — και το ίδιο
 * ισχύει για το **κουμπί**: απενεργοποιημένο χωρίς εξήγηση είναι σφάλμα αναφοράς.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockProposalRow
 */

import React, { useState } from 'react';
import { AlertCircle, Check, Link2Off, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseGreekDecimal } from '@/lib/number/greek-decimal';
import type { BindingProposal } from '@/types/title-block-binding';
import {
  BLOCKED_LABEL,
  BLOCKER_LABEL,
  EVIDENCE_LABEL,
  FIELD_LABEL,
  TARGET_LABEL,
} from './proposal-labels';
import type { ApproveRequest, ApprovalBlocker } from './useTitleBlockApproval';

interface Props {
  readonly proposal: BindingProposal;
  readonly approved: boolean;
  readonly busy: boolean;
  readonly blockerFor: (req: ApproveRequest) => ApprovalBlocker | null;
  readonly onApprove: (req: ApproveRequest) => void;
  readonly onDismiss: () => void;
}

export const TitleBlockProposalRow: React.FC<Props> = ({
  proposal,
  approved,
  busy,
  blockerFor,
  onApprove,
  onDismiss,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  // Γ6 — η πινακίδα αποδεικνύει ΟΝΟΜΑ, ποτέ μερίδιο. Το κρατάμε ως κείμενο ώστε το άδειο πεδίο
  // να είναι «δεν δηλώθηκε», όχι `0` — που θα σήμαινε «δεν κατέχει τίποτα».
  const [pctText, setPctText] = useState('');

  const best = proposal.candidates[0];
  const needsPercent = best?.target.kind === 'landowner';
  // Ελληνικό πληκτρολόγιο: «12,5» και «12.5» είναι το ΙΔΙΟ ποσοστό — το ερμηνεύει το SSoT
  // (ADR-397), όχι inline replace. Άκυρο κείμενο → `undefined` ⇒ ο φύλακας το κόβει ως
  // `needsPercent`, ακριβώς όπως το παλιό `NaN`.
  const parsedPct = parseGreekDecimal(pctText) ?? undefined;

  const request: ApproveRequest | null = best
    ? {
        proposal,
        target: best.target,
        ...(parsedPct !== undefined ? { landOwnershipPct: parsedPct } : {}),
      }
    : null;
  const blocker = request ? blockerFor(request) : null;

  return (
    <li className="rounded-md border border-border bg-card px-3 py-2">
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(FIELD_LABEL[proposal.fieldKey])}
        </h4>
        {best ? (
          <span className="text-[11px] text-muted-foreground">
            {t(TARGET_LABEL[best.target.kind])}
          </span>
        ) : null}
      </header>

      <p className="mt-1 break-words text-sm text-foreground">
        {proposal.personName ?? proposal.snapshotValue}
      </p>

      {best ? (
        <section className="mt-1.5">
          <p className="text-sm font-medium text-primary">→ {best.label}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {best.evidence.map((item) => (
              <li
                key={`${item.kind}:${item.value}`}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {t(EVIDENCE_LABEL[item.kind])}
              </li>
            ))}
          </ul>
          {proposal.candidates.length > 1 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('titleBlockBinding.moreCandidates', { count: proposal.candidates.length - 1 })}
            </p>
          ) : null}

          {needsPercent ? (
            <div className="mt-2 flex items-center gap-2">
              <label
                className="text-[11px] text-muted-foreground"
                htmlFor={`tbb-pct-${proposal.sourceHandle}-${proposal.fieldKey}`}
              >
                {t('titleBlockBinding.landowner.percentLabel')}
              </label>
              <Input
                id={`tbb-pct-${proposal.sourceHandle}-${proposal.fieldKey}`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={pctText}
                onChange={(e) => setPctText(e.target.value)}
                className="h-7 w-20 text-sm"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
            </div>
          ) : null}
          {needsPercent ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('titleBlockBinding.landowner.percentHint')}
            </p>
          ) : null}

          <footer className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-7"
              disabled={approved || busy || blocker !== null || !request}
              title={
                blocker
                  ? t(BLOCKER_LABEL[blocker])
                  : t('titleBlockBinding.approveTitle')
              }
              onClick={() => request && onApprove(request)}
            >
              <Check className="mr-1 size-3" aria-hidden />
              {approved
                ? t('titleBlockBinding.approved')
                : busy
                  ? t('titleBlockBinding.approving')
                  : t('titleBlockBinding.approve')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              disabled={busy}
              title={t('titleBlockBinding.dismissTitle')}
              onClick={onDismiss}
            >
              <X className="mr-1 size-3" aria-hidden />
              {t('titleBlockBinding.dismiss')}
            </Button>
          </footer>

          {/* Η αιτία ΔΙΠΛΑ στο κουμπί, όχι μόνο σε tooltip: ένα κλειστό κουμπί που δεν λέει
              γιατί, μοιάζει με σπασμένη εφαρμογή. */}
          {blocker && !approved ? (
            <p role="status" className="mt-1 text-[11px] text-muted-foreground">
              {t(BLOCKER_LABEL[blocker])}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          {proposal.blockedBy === 'no-match' ? (
            <Link2Off className="mt-px size-3 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
          )}
          {proposal.blockedBy ? t(BLOCKED_LABEL[proposal.blockedBy]) : null}
        </p>
      )}
    </li>
  );
};
