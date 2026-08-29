'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΤΩΝ ΕΙΣΕΡΧΟΜΕΝΩΝ** — τι ζητούν, με τι όρους, τι κάνω.
 * @related ADR-827 §9.21 · §8.2 · CHECK 3.41 (WCAG 1.4.1)
 * @module components/mandate/inbox/MandateInboxRow
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΚΑΤΑΣΤΑΣΗ ΔΕΝ ΞΕΧΩΡΙΖΕΙ ΜΕ ΧΡΩΜΑ — ΚΑΝΟΝΑΣ, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι ομάδες και οι αποφάσεις διακρίνονται από **λέξεις και θέση**. Είναι το μάθημα του
 * **CHECK 3.41** (WCAG 1.4.1) και η **μόνη** επιλογή που επιβιώνει στις πύλες
 * αντίθεσης: το `--destructive` σε σκοτεινό θέμα λύνεται σε `0 62.8% 30.6%` πάνω σε
 * κάρτα `217 33% 17%` — «επείγον» που **δεν διαβάζεται** (CHECK 3.38/3.39).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΤΡΙΑ ΚΟΥΜΠΙΑ ΕΧΟΥΝ ΤΟ ΚΑΘΕΝΑ ΤΗ ΔΙΚΗ ΤΟΥ ΠΡΟΤΑΣΗ — ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαφορά των δύο «όχι» είναι **εξουσία**, όχι ύφος: το ένα ξαναανοίγει την πόρτα,
 * το άλλο την κλείνει όσο ζει η αγγελία. Ένας μεσίτης που βλέπει δύο κουμπιά «Άρνηση»
 * θα πατήσει το πρώτο. Η υπόδειξη **δεν είναι διακόσμηση** — είναι το κείμενο που
 * κάνει την απόφαση συνειδητή, και γι' αυτό ζωγραφίζεται **δίπλα στο κουμπί**, όχι σε
 * tooltip *(που δεν υπάρχει στην αφή και δεν διαβάζεται από αναγνώστη οθόνης πριν το
 * πάτημα)*.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LISTING_AGREEMENT_I18N_KEYS } from '@/components/mandate/listing-agreement-labels';
import type { InboxFeedback } from '@/hooks/mandate/useMandateInbox';
import {
  MANDATE_REQUEST_DECISIONS,
  type MandateRequestDecision,
  type MandateRequestForAgency,
} from '@/types/mandate-request';

import {
  DECIDED_LABEL_KEYS,
  DECISION_HINT_KEYS,
  DECISION_LABEL_KEYS,
  INBOX_KEYS,
  INBOX_NS,
  REFUSAL_KEYS,
} from './mandate-inbox-labels';

export interface MandateInboxRowProps {
  readonly row: MandateRequestForAgency;
  /** Προσφέρονται κουμπιά απόφασης; — **μόνο** στην ομάδα `actionable`. */
  readonly decidable: boolean;
  readonly busy: boolean;
  readonly opened: boolean;
  readonly feedback: InboxFeedback | null;
  readonly onOpen: (requestId: string) => void;
  readonly onClose: () => void;
  readonly onDecide: (requestId: string, decision: MandateRequestDecision) => void;
}

/** ISO → ημερομηνία στη γλώσσα του ανθρώπου. */
function useDay(): (iso: string | null) => string {
  const { i18n } = useTranslation([INBOX_NS]);
  return (iso) => {
    if (iso === null) return '—';
    const parsed = Date.parse(iso);
    // ⚠️ **Άκυρη ημερομηνία δείχνεται ως άγνωστη, ΠΟΤΕ ως «Invalid Date»**: το δεύτερο
    //    είναι μήνυμα μηχανής σε οθόνη ανθρώπου (ίδιο δόγμα με το `Ζ3`).
    return Number.isNaN(parsed) ? '—' : new Date(parsed).toLocaleDateString(i18n.language);
  };
}

/** Η αμοιβή, σε μία φράση — διακριτή ένωση, χωρίς `any`. */
function compensationText(row: MandateRequestForAgency): string {
  const { compensation } = row.terms;
  return compensation.type === 'percentage'
    ? `${compensation.percentage}%`
    : `${compensation.amountEUR} €`;
}

/** Το μήνυμα της **τελευταίας** απόφασης πάνω σε αυτή τη γραμμή. */
function Feedback({ feedback }: { readonly feedback: InboxFeedback }): React.ReactElement | null {
  const { t } = useTranslation([INBOX_NS]);
  const { result } = feedback;

  if (result.kind === 'decided') return null;

  return (
    <p className="mt-2 text-sm text-muted-foreground" role="status">
      {result.kind === 'refused' ? t(REFUSAL_KEYS[result.reason]) : t(INBOX_KEYS.decidingFailed)}
    </p>
  );
}

export function MandateInboxRow({
  row,
  decidable,
  busy,
  opened,
  feedback,
  onOpen,
  onClose,
  onDecide,
}: MandateInboxRowProps): React.ReactElement {
  const { t } = useTranslation([INBOX_NS]);
  const day = useDay();
  const isDecided = row.status !== 'pending';

  return (
    <li className="rounded-md border border-border bg-card p-4">
      <article>
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-base font-medium text-foreground">{row.listing.title}</h3>
          {/* 🔑 **Το «νέο» λέγεται με ΛΕΞΗ**, ποτέ με κουκκίδα χρώματος (CHECK 3.41). */}
          {row.seenAt === null && (
            <span className="text-xs font-medium text-muted-foreground">
              {t(INBOX_KEYS.unseen, { count: 1 })}
            </span>
          )}
        </header>

        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t(INBOX_KEYS.agreement)}</dt>
          <dd className="m-0 text-foreground">
            {t(LISTING_AGREEMENT_I18N_KEYS[row.terms.agreement])}
          </dd>
          <dt className="text-muted-foreground">{t(INBOX_KEYS.compensation)}</dt>
          <dd className="m-0 text-foreground">{compensationText(row)}</dd>
          <dt className="text-muted-foreground">{t(INBOX_KEYS.expiresAt)}</dt>
          <dd className="m-0 text-foreground">{day(row.terms.expiresAt)}</dd>
          <dt className="text-muted-foreground">{t(INBOX_KEYS.requestedAt)}</dt>
          <dd className="m-0 text-foreground">{day(row.requestedAt)}</dd>
        </dl>

        {/* 🏆 Η αλυσίδα του Autodesk: η αναθεώρηση διαβάζεται **ως αναθεώρηση**, όχι ως
            δεύτερο ταυτόσημο ερώτημα. Δες `MandateRequestForAgency.supersedesRequestId`. */}
        {row.supersedesRequestId !== null && (
          <p className="mt-2 text-sm text-muted-foreground">{t(INBOX_KEYS.revision)}</p>
        )}

        {isDecided && (
          <p className="mt-2 text-sm font-medium text-foreground">
            {t(DECIDED_LABEL_KEYS[row.status as MandateRequestDecision])} · {day(row.decidedAt)}
          </p>
        )}

        <footer className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => (opened ? onClose() : onOpen(row.id))}
          >
            {t(opened ? INBOX_KEYS.close : INBOX_KEYS.open)}
          </Button>
        </footer>

        {/* 🔴 Τα κουμπιά απόφασης εμφανίζονται **μόνο μετά το άνοιγμα**, και είναι
            απόφαση σχεδιασμού: το `seenAt` σφραγίζεται στο άνοιγμα, άρα «απάντησα
            χωρίς να το δω» γίνεται **αδύνατο να συμβεί κατά λάθος**. */}
        {decidable && opened && (
          <section className="mt-3 border-t border-border pt-3">
            <p className="m-0 mb-2 text-sm text-muted-foreground">{t(INBOX_KEYS.anonymity)}</p>
            <ul className="m-0 grid gap-2 p-0">
              {MANDATE_REQUEST_DECISIONS.map((decision) => (
                <li key={decision} className="flex flex-wrap items-baseline gap-2">
                  <Button
                    size="sm"
                    variant={decision === 'accepted' ? 'default' : 'outline'}
                    disabled={busy}
                    onClick={() => onDecide(row.id, decision)}
                  >
                    {t(DECISION_LABEL_KEYS[decision])}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t(DECISION_HINT_KEYS[decision])}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {feedback !== null && feedback.requestId === row.id && <Feedback feedback={feedback} />}
      </article>
    </li>
  );
}
