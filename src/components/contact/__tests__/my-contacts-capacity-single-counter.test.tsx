/**
 * @fileoverview 🔴 **Η ΧΩΡΗΤΙΚΟΤΗΤΑ ΤΥΠΩΝΕΤΑΙ ΑΠΟ ΤΗΝ ΑΝΑΓΝΩΣΗ, ΠΟΤΕ ΑΠΟ ΤΗ ΛΙΣΤΑ** (Κ9).
 * @related ADR-843 §10 Κ9 · components/contact/MyContactsContent.tsx · lib/contact/first-contact-capacity.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΥΛΑΕΙ — ΔΥΟ ΑΡΙΘΜΟΙ ΣΤΗΝ ΙΔΙΑ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `view.capacity` και το `view.contacts` έρχονται από την **ίδια ανάγνωση**
 * ({@link fetchMyFirstContacts}). Ένα `contacts.filter(open).length` στην οθόνη θα ήταν
 * **δεύτερος μετρητής** — και ο άνθρωπος βλέπει **και τους δύο** ταυτόχρονα: τη λίστα
 * κάτω, τον αριθμό πάνω. Την πρώτη φορά που διαφωνήσουν, δεν υπάρχει σωστή απάντηση
 * στην ερώτηση *«ποιον να πιστέψω;»*.
 *
 * Οι δύο μπορούν **νόμιμα** να διαφέρουν: η λίστα φέρνει και **αποσυρμένες** πράξεις,
 * ο μετρητής μετρά **μόνο ανοιχτές** ({@link contactCapacityOf}), και ο διακομιστής
 * μπορεί να σελιδοποιήσει. Δηλαδή **η ισότητα δεν είναι εγγυημένη ούτε σήμερα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΤΟ FIXTURE ΕΙΝΑΙ ΑΣΥΜΦΩΝΟ ΕΠΙΤΗΔΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `capacity.open = 3` ενώ η λίστα έχει **7 ανοιχτές**. Αν ήταν σύμφωνα, το τεστ θα
 * περνούσε **και με τους δύο τρόπους υλοποίησης** — δηλαδή δεν θα φύλαγε τίποτα. Η
 * ασυμφωνία είναι το **όργανο**: μόνο η σωστή πηγή τυπώνει `3`.
 *
 * ⚠️ Επίτηδες **χωρίς μετάλλαξη** του `MyContactsContent.tsx` (handoff 2026-09-04 §8):
 * η απόδειξη ότι το κριτήριο κοκκινίζει ζει στο **αντι-παράδειγμα** στο §4.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { MyContactsContent } from '@/components/contact/MyContactsContent';
import { MINE_KEYS } from '@/components/contact/first-contact-labels';
import type { ContactCapacity } from '@/lib/contact/first-contact-capacity';
import type { FirstContactForSeeker } from '@/types/first-contact';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values === undefined
        ? key
        : `${key}[${Object.entries(values)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join('|')}]`,
  }),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'usr_zitwn' }, loading: false }),
}));

jest.mock('@/services/contact/first-contact.client', () => ({
  fetchMyFirstContacts: jest.fn(),
  withdrawFirstContactFromScreen: jest.fn(),
}));

import { fetchMyFirstContacts } from '@/services/contact/first-contact.client';

const fetchMock = fetchMyFirstContacts as jest.MockedFunction<typeof fetchMyFirstContacts>;

// =============================================================================
// 1. ΤΟ ΑΣΥΜΦΩΝΟ FIXTURE — 7 ανοιχτές στη λίστα, «3» στην ανάγνωση
// =============================================================================

/** Ο αριθμός που **ΠΡΕΠΕΙ** να τυπωθεί: έρχεται από τον έναν, κανονικό μετρητή. */
const AUTHORITATIVE_OPEN = 3;
/** Ο αριθμός που θα τύπωνε ένας **δεύτερος** μετρητής πάνω στη λίστα. */
const LIST_OPEN = 7;

const CAPACITY: ContactCapacity = {
  open: AUTHORITATIVE_OPEN,
  remaining: 2,
  capacity: 5,
  full: false,
};

function openContact(index: number): FirstContactForSeeker {
  return {
    id: `fcnt_${index}`,
    target: { kind: 'listing', listingId: `lst_${index}` },
    matchReason: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    lifecycle: 'open',
    withdrawnAt: null,
    seenAt: null,
  };
}

const CONTACTS: readonly FirstContactForSeeker[] = Array.from({ length: LIST_OPEN }, (_, index) =>
  openContact(index),
);

// =============================================================================
// 2. ΤΟ ΚΡΙΤΗΡΙΟ — ΜΙΑ συνάρτηση, δύο ασκήσεις
// =============================================================================

/** Ο αριθμός που **όντως** τυπώθηκε στη γραμμή χωρητικότητας, ή `null` αν δεν βρέθηκε. */
function printedOpenCount(container: HTMLElement): number | null {
  const text = container.textContent ?? '';
  const line = text.split(MINE_KEYS.capacity)[1];
  if (line === undefined) return null;

  const match = /open=(\d+)/.exec(line);
  return match === null ? null : Number(match[1]);
}

// =============================================================================
// 3. Η ΑΛΗΘΙΝΗ ΟΘΟΝΗ
// =============================================================================

describe('ADR-843 Κ9 — η οθόνη ΔΕΝ ξαναμετρά τη χωρητικότητα', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ kind: 'ready', view: { contacts: CONTACTS, capacity: CAPACITY } });
  });

  it('τυπώνει το `capacity.open` της ανάγνωσης, ΟΧΙ το πλήθος της λίστας', async () => {
    const { container } = render(<MyContactsContent />);

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(LIST_OPEN));

    // 🔑 Η λίστα ΟΝΤΩΣ έχει 7 ανοιχτές — δηλαδή ένας δεύτερος μετρητής θα είχε
    //    διαφορετική, εξίσου «εύλογη» απάντηση διαθέσιμη στην ίδια απόδοση.
    expect(printedOpenCount(container)).toBe(AUTHORITATIVE_OPEN);
    expect(printedOpenCount(container)).not.toBe(LIST_OPEN);
  });

  it('τυπώνει και το όριο από την ανάγνωση — Κ9: κανένα όριο δεν γεννιέται στην οθόνη', async () => {
    const { container } = render(<MyContactsContent />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(LIST_OPEN));

    expect(container.textContent).toContain('capacity=5');
    expect(container.textContent).toContain('remaining=2');
  });

  it('η άδεια λίστα ΔΕΝ σβήνει τη χωρητικότητα — «καμία επαφή» δεν σημαίνει «κανένα όριο»', async () => {
    fetchMock.mockResolvedValue({
      kind: 'ready',
      view: { contacts: [], capacity: { open: 0, remaining: 5, capacity: 5, full: false } },
    });

    const { container } = render(<MyContactsContent />);
    await waitFor(() => expect(container.textContent).toContain(MINE_KEYS.capacity));

    expect(printedOpenCount(container)).toBe(0);
    expect(container.textContent).toContain('capacity=5');
  });
});

// =============================================================================
// 4. 🔴 Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ ΚΡΙΤΗΡΙΟ ΚΟΚΚΙΝΙΖΕΙ — το αντι-παράδειγμα
// =============================================================================

/**
 * **Ο δεύτερος μετρητής, γραμμένος.** Ακριβώς η «βελτίωση» που φαίνεται αθώα σε
 * review: *«γιατί να περιμένω τον διακομιστή, τη λίστα την έχω μπροστά μου»*.
 */
function ForbiddenRecountedHeader({
  contacts,
  capacity,
}: {
  readonly contacts: readonly FirstContactForSeeker[];
  readonly capacity: ContactCapacity;
}): React.ReactElement {
  const recounted = contacts.filter((contact) => contact.lifecycle === 'open').length;
  return (
    <p>
      {`${MINE_KEYS.capacity}[open=${recounted}|capacity=${capacity.capacity}|remaining=${capacity.remaining}]`}
    </p>
  );
}

describe('η άγκυρα ΟΝΤΩΣ κοκκινίζει — αλλιώς είναι σχόλιο', () => {
  it('απορρίπτει τον δεύτερο μετρητή, που τυπώνει το πλήθος της λίστας', () => {
    const { container } = render(
      <ForbiddenRecountedHeader contacts={CONTACTS} capacity={CAPACITY} />,
    );

    expect(printedOpenCount(container)).toBe(LIST_OPEN);
    expect(printedOpenCount(container)).not.toBe(AUTHORITATIVE_OPEN);
  });

  it('το ίδιο το κριτήριο διακρίνει «δεν τυπώθηκε» από «τυπώθηκε μηδέν»', () => {
    const { container } = render(<p>καμία γραμμή χωρητικότητας εδώ</p>);
    expect(printedOpenCount(container)).toBeNull();
  });
});
