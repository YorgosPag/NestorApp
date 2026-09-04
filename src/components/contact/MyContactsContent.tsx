'use client';

/**
 * @fileoverview **«Οι επαφές μου»** — όσους πλησίασε ο ζητών, με το υπόλοιπο χωρητικότητας.
 * @related ADR-843 §10 · lib/contact/first-contact-capacity.ts · services/contact/first-contact.client.ts
 * @module components/contact/MyContactsContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΧΩΡΗΤΙΚΟΤΗΤΑ ΦΤΑΝΕΙ ΕΤΟΙΜΗ, ΚΑΙ ΔΕΝ ΞΑΝΑΜΕΤΡΙΕΤΑΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `view.capacity` έρχεται από την **ίδια ανάγνωση** με το `view.contacts`
 * ({@link fetchMyFirstContacts}). Ένας δεύτερος μετρητής πάνω στη λίστα θα ήταν
 * δεύτερος αριθμός που μπορεί να διαφωνήσει με τον πρώτο — και ο άνθρωπος βλέπει
 * **και τους δύο**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΠΟΣΥΡΣΗ ΞΑΝΑΦΟΡΤΩΝΕΙ, ΔΕΝ «ΔΙΟΡΘΩΝΕΙ» ΤΗ ΓΡΑΜΜΗ ΤΟΠΙΚΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ίδιο μάθημα με το γειτονικό `hooks/mandate/useMandateInbox.ts`: μια αισιόδοξη
 * τοπική ενημέρωση θα ήταν τρίτος ταξινομητής (μετά τον διακομιστή και το
 * `first-contact-capacity.ts`) — και η χωρητικότητα θα έμενε πίσω.
 *
 * ⚠️ **Περιμένει την ταυτότητα πριν ρωτήσει** — μετρημένο ζωντανά 2026-08-28 στο ίδιο
 * γειτονικό υποσύστημα: ο `apiClient` πετά `401` όσο ο `auth.currentUser` είναι
 * ακόμη `null`, και το `onAuthStateChanged` απλώς καταγράφει τον χρήστη αργότερα.
 */

import React, { useCallback, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageErrorState, PageLoadingState } from '@/core/states';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ContactCapacity } from '@/lib/contact/first-contact-capacity';
import {
  fetchMyFirstContacts,
  withdrawFirstContactFromScreen,
} from '@/services/contact/first-contact.client';
import type { FirstContactForSeeker } from '@/types/first-contact';

import { FIRST_CONTACT_NS, MINE_KEYS } from './first-contact-labels';
import { MyContactRow } from './MyContactRow';
import { useIdentityGatedLoad } from './use-identity-gated-load';

/** Το αποτέλεσμα της **τελευταίας** απόσυρσης που δεν πέτυχε, ανά επαφή. */
interface WithdrawNotice {
  readonly contactId: string;
  readonly kind: 'failed' | 'absent';
}

/** Η απόσυρση: ζητά, ρωτά, ξαναφορτώνει — ΠΟΤΕ τοπική διόρθωση της γραμμής. */
function useWithdraw(reload: () => void) {
  const [target, setTarget] = useState<FirstContactForSeeker | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<WithdrawNotice | null>(null);

  const request = useCallback((contact: FirstContactForSeeker) => {
    setNotice(null);
    setTarget(contact);
  }, []);

  const cancel = useCallback(() => setTarget(null), []);

  const confirm = useCallback(() => {
    if (target === null) return;
    const contactId = target.id;
    setBusyId(contactId);

    void withdrawFirstContactFromScreen(contactId).then((result) => {
      setBusyId(null);
      setTarget(null);

      if (result.kind === 'withdrawn') {
        reload();
        return;
      }
      setNotice({ contactId, kind: result.kind === 'absent' ? 'absent' : 'failed' });
    });
  }, [target, reload]);

  return { target, busyId, notice, request, cancel, confirm };
}

function MyContactsHeader({ capacity }: { readonly capacity: ContactCapacity }): React.ReactElement {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-foreground">{t(MINE_KEYS.title)}</h1>
      <p className="text-sm text-muted-foreground">{t(MINE_KEYS.lead)}</p>
      {/* 🔴 SSoT: αυτός ο αριθμός έρχεται από `view.capacity`, ΟΧΙ από `contacts.length`. */}
      <p className="text-sm text-foreground">
        {t(MINE_KEYS.capacity, {
          open: capacity.open,
          capacity: capacity.capacity,
          remaining: capacity.remaining,
        })}
      </p>
      {capacity.full && <p className="text-sm text-foreground">{t(MINE_KEYS.capacityFull)}</p>}
    </header>
  );
}

export function MyContactsContent(): React.ReactElement {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const { load, reload } = useIdentityGatedLoad(fetchMyFirstContacts);
  const withdraw = useWithdraw(reload);

  if (load.kind === 'loading') {
    return (
      <main className="flex w-full flex-col gap-6">
        <PageLoadingState message={t(MINE_KEYS.loading)} layout="contained" />
      </main>
    );
  }

  if (load.kind === 'failed') {
    return (
      <main className="flex w-full flex-col gap-6">
        <PageErrorState
          title={t(MINE_KEYS.failed)}
          onRetry={reload}
          retryLabel={t(MINE_KEYS.retry)}
          layout="contained"
        />
      </main>
    );
  }

  const { contacts, capacity } = load.view;

  return (
    // ΚΑΝΕΝΑ `p-*`/`max-w-*`/`PageContainer` εδώ (ADR-797 · CHECK 3.63): σελίδα του
    // `(me)` — το κενό, το μέτρο και το ύψος τα κατέχει το `ShellSurface` του
    // `PrivateSpaceShell`. Ίδια σύμβαση με `MyDemandsContent`/`MyOwnerPropertiesContent`.
    <main className="flex w-full flex-col gap-6">
      <MyContactsHeader capacity={capacity} />

      {contacts.length === 0 ? (
        <EmptyState title={t(MINE_KEYS.empty)} description={t(MINE_KEYS.emptyLead)} />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {contacts.map((contact) => {
            // ⚠️ Μεταβλητή, όχι `withdraw.notice?.…`: ο TS δεν στενεύει `withdraw.notice`
            //    μέσα από optional chaining σε συνθήκη — χρειάζεται ρητό `!== null`.
            const notice = withdraw.notice;
            return (
              <MyContactRow
                key={contact.id}
                contact={contact}
                busy={withdraw.busyId === contact.id}
                notice={notice !== null && notice.contactId === contact.id ? notice.kind : null}
                onWithdraw={() => withdraw.request(contact)}
              />
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={withdraw.target !== null}
        onOpenChange={(open) => {
          if (!open) withdraw.cancel();
        }}
        title={t(MINE_KEYS.withdrawTitle)}
        description={t(MINE_KEYS.withdrawBody)}
        onConfirm={withdraw.confirm}
        confirmText={t(MINE_KEYS.withdrawConfirm)}
        cancelText={t(MINE_KEYS.withdrawCancel)}
        variant="destructive"
        loading={withdraw.busyId !== null}
      />
    </main>
  );
}
