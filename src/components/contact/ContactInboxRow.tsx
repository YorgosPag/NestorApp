'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΣΤΑ «ΠΟΙΟΙ ΜΕ ΠΛΗΣΙΑΣΑΝ»** — Κ7 #1, δίπλα, χωρίς κλικ.
 * @related ADR-843 §10 Κ7 #1 · Κ7 §10.2 (κανένα μέγεθος) · components/contact/ContactInboxContent.tsx
 * @module components/contact/ContactInboxRow
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΣΤΟΙΧΕΙΑ ΤΟΥ ΖΗΤΟΥΝΤΟΣ ΔΕΝ ΚΡΥΒΟΝΤΑΙ ΠΙΣΩ ΑΠΟ ΤΙΠΟΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καμία δεύτερη οθόνη, κανένα «δες περισσότερα». Ο διακομιστής σφραγίζει `seenAt`
 * **μόλις ανοίξει η λίστα** (`fetchFirstContactInbox`) — αν τα στοιχεία έμεναν πίσω
 * από κλικ, η σφραγίδα θα έλεγε ψέματα για το τι όντως είδε ο άνθρωπος.
 *
 * ⚠️ **Κανένα μέγεθος στο «γιατί ταιριάζει»** — το `MatchReason` έχει μόνο άξονες,
 * επίτηδες (ADR-843 §10.2): οι ακριβείς αποκλίσεις θα πρόδιδαν την οροφή
 * προϋπολογισμού του ζητούντος.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { FirstContactInboxEntry } from '@/services/contact/first-contact-vocabulary';

import { demandBlockerKey, FIRST_CONTACT_NS, INBOX_KEYS } from './first-contact-labels';

export interface ContactInboxRowProps {
  readonly entry: FirstContactInboxEntry;
}

/** Για ποιον από τους δύο στόχους μιλάμε. */
function targetLabelKey(entry: FirstContactInboxEntry): string {
  return entry.target.kind === 'listing' ? INBOX_KEYS.targetListing : INBOX_KEYS.targetProfessional;
}

/** Τα στοιχεία του ζητούντος — **δίπλα, πάντα, χωρίς κλικ** (Κ7 #1). */
function Disclosure({ entry }: { readonly entry: FirstContactInboxEntry }): React.ReactElement {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  if (entry.disclosure === null) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        {t(INBOX_KEYS.withdrawnNotice, {
          date: entry.withdrawnAt === null ? '—' : formatDate(entry.withdrawnAt),
        })}
      </p>
    );
  }

  const { displayName, email, phone, acceptsPlatformMessages } = entry.disclosure;

  return (
    <section className="mt-2">
      <h3 className="m-0 text-sm font-semibold text-foreground">{t(INBOX_KEYS.contactHeading)}</h3>
      <p className="mt-1 text-sm text-foreground">{displayName}</p>
      <p className="mt-1 text-sm text-foreground">{email ?? t(INBOX_KEYS.noEmail)}</p>
      <p className="mt-1 text-sm text-foreground">{phone ?? t(INBOX_KEYS.noPhone)}</p>
      {acceptsPlatformMessages && (
        <p className="mt-1 text-sm text-muted-foreground">{t(INBOX_KEYS.acceptsMessages)}</p>
      )}
    </section>
  );
}

/** «Γιατί ταιριάζει» — άξονες μόνο, ΠΟΤΕ μεγέθη (§10.2). `null` = δεν ξέρουμε. */
function WhySection({ entry }: { readonly entry: FirstContactInboxEntry }): React.ReactElement | null {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const { matchReason } = entry;
  if (matchReason === null) return null;

  const { unmetAxes, declaredAxes } = matchReason;

  return (
    <section className="mt-2">
      <h3 className="m-0 text-sm font-semibold text-foreground">{t(INBOX_KEYS.whyHeading)}</h3>
      <p className="mt-1 text-sm text-foreground">
        {unmetAxes.length === 0 ? t(INBOX_KEYS.whyAllMet) : t(INBOX_KEYS.whyUnmet)}
      </p>
      {unmetAxes.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
          {unmetAxes.map((axis) => (
            <li key={axis}>{t(demandBlockerKey(axis))}</li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {t(INBOX_KEYS.whyDeclared, { declaredAxes })}
      </p>
    </section>
  );
}

export function ContactInboxRow({ entry }: ContactInboxRowProps): React.ReactElement {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  return (
    <li className="rounded-md border border-border bg-card p-4">
      <article>
        <header className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{t(targetLabelKey(entry))}</span>
          {/* 🔑 Το «νέο» λέγεται με ΛΕΞΗ, ποτέ μόνο με χρώμα (CHECK 3.41). */}
          {entry.seenAt === null && <Badge variant="info">{t(INBOX_KEYS.newBadge)}</Badge>}
        </header>

        <p className="mt-1 text-sm text-muted-foreground">
          {t(INBOX_KEYS.requestedAt, { date: formatDate(entry.requestedAt) })}
        </p>

        <Disclosure entry={entry} />
        <WhySection entry={entry} />
      </article>
    </li>
  );
}
