/**
 * @fileoverview 🔴 **ΤΑ ΣΤΟΙΧΕΙΑ ΤΟΥ ΖΗΤΟΥΝΤΟΣ ΕΙΝΑΙ ΔΙΠΛΑ — ΧΩΡΙΣ ΚΑΝΕΝΑ ΚΛΙΚ** (Κ7 #1).
 * @related ADR-843 §10 Κ7 #1 · components/contact/ContactInboxRow.tsx · services/contact/first-contact.client.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΟΡΘΟΤΗΤΑΣ, ΟΧΙ ΑΙΣΘΗΤΙΚΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο διακομιστής σφραγίζει `seenAt` **μόλις ανοίξει η λίστα** ({@link
 * fetchFirstContactInbox} — write-once). Η σφραγίδα λέει *«αυτό το είδες»*, και ο
 * **ζητών τη διαβάζει** στη δική του οθόνη («το είδε;», Κ10).
 *
 * Άρα η σφραγίδα είναι αληθής **μόνο όσο τα στοιχεία φαίνονται χωρίς αλληλεπίδραση**.
 * Την ώρα που κάποιος «βελτιώνει» την οθόνη με σύμπτυξη, «δες περισσότερα», ή δεύτερη
 * οθόνη λεπτομέρειας, η σφραγίδα **αρχίζει να λέει ψέματα** — και ο ζητών παίρνει
 * λάθος απάντηση σε ερώτηση που τον αφορά.
 *
 * 🔴 **ΚΑΜΙΑ ΑΛΛΗ ΠΥΛΗ ΔΕΝ ΤΟ ΒΛΕΠΕΙ.** Δεν είναι τύπος (ο TS δέχεται χαρά-χαρά ένα
 * `<details>`), δεν είναι i18n, δεν είναι μέγεθος αρχείου. Ήταν **σχόλιο** μέχρι εδώ —
 * και σχόλιο δεν είναι πύλη (ίδιο μάθημα με ADR-776 §διαμέριση).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΩΣ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΟΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΚΟΚΚΙΝΙΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το κριτήριο ζει σε **μία** συνάρτηση ({@link disclosureVerdict}) και **εκτελείται σε
 * δύο** αποδόσεις: την **αληθινή** γραμμή, και ένα **αντι-παράδειγμα** που κρύβει τα
 * ίδια στοιχεία πίσω από `<details>`. Αν το κριτήριο ήταν κενό, το αντι-παράδειγμα θα
 * περνούσε — και το τεστ το **απαιτεί να πέσει**.
 *
 * ⚠️ Επίτηδες **χωρίς μετάλλαξη** του `ContactInboxRow.tsx`: μετρήθηκε 2026-09-04 ότι
 * παράλληλος πράκτορας **διάβασε** τη μετάλλαξη ενός tracked αρχείου και την ανέφερε
 * ως εύρημα, ενώ άλλος **έκανε commit** τα ίδια αρχεία.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';

import { ContactInboxRow } from '@/components/contact/ContactInboxRow';
import type { FirstContactInboxEntry } from '@/services/contact/first-contact-vocabulary';

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

// =============================================================================
// 1. ΤΟ FIXTURE — ένας ζητών με ΚΑΙ ΤΑ ΤΡΙΑ στοιχεία συμπληρωμένα
// =============================================================================

const DISPLAY_NAME = 'Μαρία Παπαδοπούλου';
const EMAIL = 'maria@example.com';
const PHONE = '+30 210 0000000';

const ENTRY: FirstContactInboxEntry = {
  id: 'fcnt_alfa',
  target: { kind: 'listing', listingId: 'lst_alfa' },
  disclosure: {
    displayName: DISPLAY_NAME,
    email: EMAIL,
    phone: PHONE,
    acceptsPlatformMessages: false,
  },
  matchReason: { unmetAxes: [], declaredAxes: 3 },
  requestedAt: '2026-09-01T10:00:00.000Z',
  lifecycle: 'open',
  withdrawnAt: null,
  seenAt: null,
};

// =============================================================================
// 2. ΤΟ ΚΡΙΤΗΡΙΟ — ΜΙΑ συνάρτηση, δύο ασκήσεις
// =============================================================================

/** Τι βρήκε το κριτήριο σε μια αποδοθείσα γραμμή. `null` = **περνά**. */
type Verdict = string | null;

/**
 * **Φαίνονται και τα τρία στοιχεία χωρίς να αγγίξει κανείς τίποτα;**
 *
 * Δύο σκέλη, γιατί το «φαίνεται» έχει δύο τρόπους να χαλάσει:
 *
 * 1. **Απουσία** — το κείμενο δεν έφτασε καν στο έγγραφο.
 * 2. **Παρουσία πίσω από εμπόδιο** — έφτασε, αλλά ζει μέσα σε αποκαλυπτήρα
 *    (`<details>`/`<summary>`, `aria-expanded`, `[hidden]`, κουμπί, σύνδεσμος).
 *    ⚠️ Το RTL `getByText` **βρίσκει** κείμενο μέσα σε κλειστό `<details>`, άρα
 *    το πρώτο σκέλος **μόνο του δεν φυλάει τίποτα** — αυτό ακριβώς είναι το εύρημα
 *    που κάνει το αντι-παράδειγμα απαραίτητο.
 */
function disclosureVerdict(container: HTMLElement): Verdict {
  for (const value of [DISPLAY_NAME, EMAIL, PHONE]) {
    if (!container.textContent?.includes(value)) return `λείπει από το έγγραφο: ${value}`;
  }

  const revealers = container.querySelectorAll(
    'details, summary, [aria-expanded], [hidden], button, a[href], [role="button"]',
  );
  if (revealers.length > 0) {
    const names = Array.from(revealers)
      .map((element) => element.tagName.toLowerCase())
      .join(', ');
    return `τα στοιχεία ζουν πίσω από αποκαλυπτήρα: ${names}`;
  }

  return null;
}

// =============================================================================
// 3. Η ΑΛΗΘΙΝΗ ΓΡΑΜΜΗ
// =============================================================================

describe('ADR-843 Κ7 #1 — τα στοιχεία του ζητούντος, δίπλα, χωρίς κλικ', () => {
  it('αποδίδει όνομα, email και τηλέφωνο ΧΩΡΙΣ καμία αλληλεπίδραση', () => {
    const { container } = render(
      <ul>
        <ContactInboxRow entry={ENTRY} />
      </ul>,
    );

    expect(disclosureVerdict(container)).toBeNull();
  });

  it('τα βάζει στο ΙΔΙΟ στοιχείο λίστας με τη γραμμή — όχι σε δεύτερη οθόνη', () => {
    render(
      <ul>
        <ContactInboxRow entry={ENTRY} />
      </ul>,
    );

    // 🔑 `within(listitem)`: αν κάποιος μετακινούσε τα στοιχεία σε πλαϊνό πάνελ ή
    //    modal, το κείμενο θα υπήρχε ακόμη στο έγγραφο — αλλά ΟΧΙ εδώ.
    const row = screen.getByRole('listitem');
    expect(within(row).getByText(DISPLAY_NAME)).toBeInTheDocument();
    expect(within(row).getByText(EMAIL)).toBeInTheDocument();
    expect(within(row).getByText(PHONE)).toBeInTheDocument();
  });

  it('η αποσυρμένη πράξη ΔΕΝ αποκαλύπτει στοιχεία (`disclosure: null`)', () => {
    const { container } = render(
      <ul>
        <ContactInboxRow
          entry={{ ...ENTRY, disclosure: null, lifecycle: 'withdrawn', withdrawnAt: '2026-09-02T10:00:00.000Z' }}
        />
      </ul>,
    );

    for (const value of [DISPLAY_NAME, EMAIL, PHONE]) {
      expect(container.textContent).not.toContain(value);
    }
  });
});

// =============================================================================
// 4. 🔴 Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ ΚΡΙΤΗΡΙΟ ΚΟΚΚΙΝΙΖΕΙ — το αντι-παράδειγμα
// =============================================================================

/**
 * **Η οθόνη που ΔΕΝ επιτρέπεται να γραφτεί ποτέ.** Ίδια στοιχεία, ίδια δεδομένα —
 * αλλά πίσω από `<details>`. Αν αυτή περνούσε το κριτήριο, το κριτήριο θα ήταν
 * διακοσμητικό.
 */
function ForbiddenCollapsedRow({ entry }: { readonly entry: FirstContactInboxEntry }): React.ReactElement {
  const disclosure = entry.disclosure;
  return (
    <li>
      <article>
        <details>
          <summary>Δες τα στοιχεία</summary>
          <p>{disclosure?.displayName}</p>
          <p>{disclosure?.email}</p>
          <p>{disclosure?.phone}</p>
        </details>
      </article>
    </li>
  );
}

describe('η άγκυρα ΟΝΤΩΣ κοκκινίζει — αλλιώς είναι σχόλιο', () => {
  it('απορρίπτει τη σύμπτυξη, ΑΚΟΜΗ ΚΑΙ όταν το κείμενο υπάρχει στο έγγραφο', () => {
    const { container } = render(
      <ul>
        <ForbiddenCollapsedRow entry={ENTRY} />
      </ul>,
    );

    // Πρώτα η απόδειξη ότι το πρώτο σκέλος από μόνο του ΔΕΝ θα έπιανε τίποτα:
    expect(container.textContent).toContain(DISPLAY_NAME);

    // Και μετά ότι το κριτήριο, ολόκληρο, πέφτει.
    expect(disclosureVerdict(container)).toMatch(/αποκαλυπτήρα/);
  });

  it('απορρίπτει και τη σκέτη απουσία στοιχείου', () => {
    const { container } = render(
      <ul>
        <li>
          <p>{DISPLAY_NAME}</p>
          <p>{EMAIL}</p>
        </li>
      </ul>,
    );

    expect(disclosureVerdict(container)).toBe(`λείπει από το έγγραφο: ${PHONE}`);
  });
});
