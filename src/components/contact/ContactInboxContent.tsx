'use client';

/**
 * @fileoverview **«Ποιοι με πλησίασαν»** — Κ7 #1: στοιχεία δίπλα, πάντα, χωρίς κλικ.
 * @related ADR-843 §10 Κ7 #1 · services/contact/first-contact.client.ts
 * @module components/contact/ContactInboxContent
 *
 * 🔴 **Η ΑΝΑΓΝΩΣΗ ΣΦΡΑΓΙΖΕΙ**: το `fetchFirstContactInbox()` γράφει `seenAt`
 * (write-once) στον διακομιστή τη στιγμή που ανοίγει **αυτή** η λίστα. Γι' αυτό η
 * οθόνη δεν κρύβει τα στοιχεία πίσω από κλικ ή δεύτερη οθόνη — θα σφράγιζε πράξεις
 * που κανείς δεν κοίταξε, και ο ζητών ρωτά *«το είδε;»* περιμένοντας αλήθεια (Κ10).
 * ⛔ **ΜΗΝ** καλέσεις τη μεταφορά αυτή για προανάκτηση σε φόντο.
 *
 * ⚠️ **Περιμένει την ταυτότητα πριν ρωτήσει** — ίδιο μάθημα με το γειτονικό
 * `hooks/mandate/useMandateInbox.ts` (μετρημένο ζωντανά 2026-08-28): ο `apiClient`
 * πετά `401` όσο ο `auth.currentUser` είναι ακόμη `null`.
 */

import React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { PageErrorState, PageLoadingState } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  fetchFirstContactInbox,
} from '@/services/contact/first-contact.client';

import { ContactInboxRow } from './ContactInboxRow';
import { FIRST_CONTACT_NS, INBOX_KEYS } from './first-contact-labels';
import { useIdentityGatedLoad } from './use-identity-gated-load';

export function ContactInboxContent(): React.ReactElement {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const { load, reload } = useIdentityGatedLoad(fetchFirstContactInbox);

  if (load.kind === 'loading') {
    return (
      <main className="flex w-full flex-col gap-6">
        <PageLoadingState message={t(INBOX_KEYS.loading)} layout="contained" />
      </main>
    );
  }

  if (load.kind === 'failed') {
    return (
      <main className="flex w-full flex-col gap-6">
        <PageErrorState
          title={t(INBOX_KEYS.failed)}
          onRetry={reload}
          retryLabel={t(INBOX_KEYS.retry)}
          layout="contained"
        />
      </main>
    );
  }

  const { entries } = load;

  return (
    // ΚΑΝΕΝΑ `p-*`/`max-w-*`/`PageContainer` εδώ (ADR-797 · CHECK 3.63) — ίδια σύμβαση
    // με `MyContactsContent`/`MyDemandsContent`: το κενό/μέτρο/ύψος τα κατέχει το
    // `ShellSurface` του `PrivateSpaceShell` (`(me)/layout.tsx`).
    <main className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{t(INBOX_KEYS.title)}</h1>
        <p className="text-sm text-muted-foreground">{t(INBOX_KEYS.lead)}</p>
      </header>

      {entries.length === 0 ? (
        <EmptyState title={t(INBOX_KEYS.empty)} description={t(INBOX_KEYS.emptyLead)} />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {entries.map((entry) => (
            <ContactInboxRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </main>
  );
}
