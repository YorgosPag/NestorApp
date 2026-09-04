/**
 * Άγκυρα του **ΠΕ5** — η χωρητικότητα, και ο φρουρός **Κ9**.
 *
 * 🔴 **Η ΚΡΙΣΙΜΗ ΕΡΩΤΗΣΗ ΔΕΝ ΕΙΝΑΙ «ΜΕΤΡΑΕΙ ΣΩΣΤΑ;» — ΕΙΝΑΙ «ΜΕΤΡΑΕΙ ΕΝΑ;»**
 * Ένα test που ρίχνει δέκα αγγελίες και ελέγχει `full === true` θα ήταν πράσινο **και**
 * με δύο χωριστούς μετρητές. Το ερώτημα του ADR-843 είναι αν έξι αγγελίες **συν**
 * τέσσερις επαγγελματίες γεμίζουν — γιατί εκεί κρίνεται αν το όριο μετρά την
 * **προσοχή** ή τα **κουβαδάκια**.
 *
 * ⚠️ Μεταλλάξεις που ΠΡΕΠΕΙ να ρίξουν αυτό το αρχείο:
 *   • φιλτράρισμα κατά `target.kind` μέσα στο `contactCapacityOf`  *(δύο μετρητές)*
 *   • `OPEN_CONTACT_CAPACITY` που διαβάζεται από πεδίο χρήστη/πακέτου  *(Κ9)*
 *   • `full: open === CAPACITY`  *(αντί για `>=`)*
 */

import { contactCapacityOf, canOpenAnotherContact } from '../first-contact-capacity';
import { OPEN_CONTACT_CAPACITY } from '../first-contact-limits';
import type { FirstContact, FirstContactLifecycle } from '@/types/first-contact';

type Kind = 'listing' | 'professional';

function contact(index: number, kind: Kind, lifecycle: FirstContactLifecycle): FirstContact {
  return {
    id: `fcon_test_${index}`,
    seekerUserId: 'user-eleni',
    target: kind === 'listing'
      ? { kind: 'listing', listingId: `ownp_${index}` }
      : { kind: 'professional', agencyCompanyId: `company-${index}` },
    // ⚠️ Ο παραλήπτης ακολουθεί το είδος του στόχου: η βιτρίνα **είναι** χώρος
    //    εταιρείας, η αγγελία ιδιώτη προσωπικός (ADR-843 §10.16).
    offerer: kind === 'listing'
      ? { kind: 'personal', userId: `owner-${index}` }
      : { kind: 'company', companyId: `company-${index}` },
    demandId: null,
    disclosure: {
      displayName: 'Ελένη Π.',
      email: 'eleni@example.gr',
      phone: null,
      acceptsPlatformMessages: false,
    },
    matchReason: null,
    lifecycle,
    createdAt: '2026-09-03T10:00:00.000Z',
    withdrawnAt: lifecycle === 'withdrawn' ? '2026-09-04T09:00:00.000Z' : null,
    seenAt: null,
  };
}

function many(count: number, kind: Kind, lifecycle: FirstContactLifecycle = 'open') {
  return Array.from({ length: count }, (_, i) => contact(i, kind, lifecycle));
}

describe('ΠΕ5 — ΕΝΑΣ μετρητής, όχι δύο', () => {
  it('🔴 έξι αγγελίες + τέσσερις επαγγελματίες = ΓΕΜΑΤΟ', () => {
    // Αυτό είναι ΟΛΗ η απόφαση: η προσοχή ενός ανθρώπου είναι ΜΙΑ, και δεν
    // χωρίζεται σε κουβαδάκια επειδή ΕΜΕΙΣ χωρίσαμε τους παραλήπτες σε δύο είδη.
    const mixed = [...many(6, 'listing'), ...many(4, 'professional')];

    const capacity = contactCapacityOf(mixed);

    expect(capacity.open).toBe(OPEN_CONTACT_CAPACITY);
    expect(capacity.remaining).toBe(0);
    expect(capacity.full).toBe(true);
    expect(canOpenAnotherContact(mixed)).toBe(false);
  });

  it('🔑 και δέκα επαγγελματίες μόνοι τους γεμίζουν το ίδιο — η χωρητικότητα ΥΠΟΚΑΘΙΣΤΑ το fan-out', () => {
    // Χωρίς αυτό, θα χρειαζόταν δεύτερο όριο ανά αίτημα (μοτίβο Bark: 5/ζήτηση).
    expect(contactCapacityOf(many(OPEN_CONTACT_CAPACITY, 'professional')).full).toBe(true);
  });

  it('μία λιγότερη αφήνει ακριβώς μία θέση', () => {
    const almost = many(OPEN_CONTACT_CAPACITY - 1, 'listing');

    expect(contactCapacityOf(almost).remaining).toBe(1);
    expect(canOpenAnotherContact(almost)).toBe(true);
  });
});

describe('ΠΕ6 — η απόσυρση ΕΛΕΥΘΕΡΩΝΕΙ θέση', () => {
  it('οι αποσυρμένες δεν μετρούν, όσες κι αν είναι', () => {
    const history = [...many(3, 'listing'), ...many(40, 'professional', 'withdrawn')];

    const capacity = contactCapacityOf(history);

    expect(capacity.open).toBe(3);
    expect(capacity.full).toBe(false);
  });

  it('🔑 «κλείνω για θέση» και «αποσύρω» είναι Η ΙΔΙΑ πράξη — καμία τρίτη κατάσταση', () => {
    // Αν κάποτε μπει `closed-but-reachable`, αυτό το test ΔΕΝ θα το πιάσει μόνο του —
    // θα το πιάσει ο τύπος. Εδώ κλειδώνεται ότι το κλειστό σύνολο έχει ΔΥΟ τιμές.
    const full = many(OPEN_CONTACT_CAPACITY, 'listing');
    const freed = [...full.slice(1), contact(0, 'listing', 'withdrawn')];

    expect(contactCapacityOf(full).full).toBe(true);
    expect(contactCapacityOf(freed).remaining).toBe(1);
  });
});

describe('Κ9 — το όριο είναι ΣΤΑΘΕΡΑ ΤΟΥ ΣΥΣΤΗΜΑΤΟΣ, ίδια για όλους', () => {
  it('🔴 το `contactCapacityOf` δέχεται ΜΟΝΟ τις πράξεις — καμία δεύτερη παράμετρος', () => {
    // Αυτή είναι η άγκυρα του «πεδίο που δεν υπάρχει δεν το πουλάει κανείς»:
    // αν κάποτε μπει `contactCapacityOf(contacts, plan)`, η υπογραφή αλλάζει και
    // αυτό το test το δηλώνει ρητά αντί να το ανακαλύψει κανείς σε review.
    expect(contactCapacityOf).toHaveLength(1);
  });

  it('η αναφερόμενη χωρητικότητα είναι η ΜΙΑ σταθερά, όχι αντίγραφο', () => {
    expect(contactCapacityOf([]).capacity).toBe(OPEN_CONTACT_CAPACITY);
  });
});

describe('πάνω από το όριο — γιατί το `remaining` δεν γίνεται ποτέ αρνητικό', () => {
  it('🔑 άνθρωπος με περισσότερες από το όριο βλέπει 0 και «γέμισε», όχι «απομένουν −2»', () => {
    // Συμβαίνει αν το όριο ΚΑΤΕΒΕΙ (το ΠΕ5 λέει ρητά ότι ο αριθμός αλλάζει αν το
    // τεστ αποτύχει). Ο άνθρωπος δεν οφείλει να καταλάβει τη μετάβασή μας.
    const over = many(OPEN_CONTACT_CAPACITY + 2, 'listing');

    const capacity = contactCapacityOf(over);

    expect(capacity.open).toBe(OPEN_CONTACT_CAPACITY + 2);
    expect(capacity.remaining).toBe(0);
    expect(capacity.full).toBe(true);
  });
});

describe('κενή περίπτωση', () => {
  it('κανένας που δεν έχει πράξεις έχει ΟΛΟ το όριο διαθέσιμο', () => {
    expect(contactCapacityOf([])).toEqual({
      open: 0,
      remaining: OPEN_CONTACT_CAPACITY,
      capacity: OPEN_CONTACT_CAPACITY,
      full: false,
    });
  });
});
