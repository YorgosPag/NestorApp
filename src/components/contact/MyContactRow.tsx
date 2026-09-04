'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΣΤΙΣ «ΟΙ ΕΠΑΦΕΣ ΜΟΥ»** — κατάσταση, ημερομηνίες, απόσυρση.
 * @related ADR-843 §10 Κ10 · components/contact/MyContactsContent.tsx
 * @module components/contact/MyContactRow
 *
 * ⛔ **Η ΔΙΑΤΥΠΩΣΗ ΤΗΣ ΑΠΟΣΥΡΣΗΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ** — ζει στο `MINE_KEYS.withdrawBody`
 * (Κ10, περνά από δικηγόρο). Αυτή η γραμμή δείχνει μόνο το **κουμπί** που την ανοίγει·
 * το κείμενο της επιβεβαίωσης το φέρνει ο γονέας μέσα στο `ConfirmDialog`.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { FirstContactForSeeker } from '@/types/first-contact';

import { FIRST_CONTACT_NS, MINE_KEYS } from './first-contact-labels';

export interface MyContactRowProps {
  readonly contact: FirstContactForSeeker;
  /** Τρέχει αυτή τη στιγμή η απόσυρση **αυτής** της γραμμής; */
  readonly busy: boolean;
  /** Το αποτέλεσμα της τελευταίας απόσυρσης που **δεν** πέτυχε, αν αφορά αυτή τη γραμμή. */
  readonly notice: 'failed' | 'absent' | null;
  readonly onWithdraw: () => void;
}

/** Το είδος του στόχου — αγγελία ή γραφείο. Κανένας σύνδεσμος: δεν ζητήθηκε εδώ. */
function targetLabelKey(contact: FirstContactForSeeker): string {
  return contact.target.kind === 'listing' ? MINE_KEYS.targetListing : MINE_KEYS.targetProfessional;
}

export function MyContactRow({
  contact,
  busy,
  notice,
  onWithdraw,
}: MyContactRowProps): React.ReactElement {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const isOpen = contact.lifecycle === 'open';

  return (
    <li className="rounded-md border border-border bg-card p-4">
      <article>
        <header className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{t(targetLabelKey(contact))}</span>
          <Badge variant={isOpen ? 'success' : 'muted'}>
            {t(isOpen ? MINE_KEYS.openBadge : MINE_KEYS.withdrawnBadge)}
          </Badge>
        </header>

        <p className="mt-2 text-sm text-muted-foreground">
          {t(MINE_KEYS.requestedAt, { date: formatDate(contact.createdAt) })}
        </p>

        {/* 🔑 Κ10 — ο ζητών δικαιούται να ξέρει τι έφτασε στον άλλο. */}
        <p className="mt-1 text-sm text-muted-foreground">
          {contact.seenAt === null
            ? t(MINE_KEYS.seenNever)
            : t(MINE_KEYS.seenAt, { date: formatDate(contact.seenAt) })}
        </p>

        {!isOpen && contact.withdrawnAt !== null && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t(MINE_KEYS.withdrawnAt, { date: formatDate(contact.withdrawnAt) })}
          </p>
        )}

        {notice !== null && (
          <p className="mt-2 text-sm text-foreground" role="status">
            {t(notice === 'absent' ? MINE_KEYS.withdrawAbsent : MINE_KEYS.withdrawFailed)}
          </p>
        )}

        {isOpen && (
          <footer className="mt-3">
            <Button variant="outline" size="sm" disabled={busy} onClick={onWithdraw}>
              {t(busy ? MINE_KEYS.withdrawing : MINE_KEYS.withdraw)}
            </Button>
          </footer>
        )}
      </article>
    </li>
  );
}
