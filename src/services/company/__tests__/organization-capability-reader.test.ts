/**
 * @jest-environment node
 *
 * @fileoverview **ΑΓΚΥΡΑ Κ12 (ADR-824 §8)** — *«ποιους να κρίνω;»*, και γιατί η απάντηση
 * **δεν επιτρέπεται** να είναι σιωπηλά κενή.
 * @related ADR-824 §8 Κ12 · §12.13 · services/company/organization-capability.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΣΤΟΧΙΑ ΠΟΥ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ **ΔΕΝ ΠΑΡΑΓΕΙ ΣΦΑΛΜΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας γράφει σε `capabilities.<ικανότητα>` · ο αναγνώστης ρωτά
 * `capabilities.<ικανότητα>.status`. Αν οι δύο διαδρομές αποκλίνουν έστω κατά χαρακτήρα, το
 * Firestore **δεν παραπονιέται**: ένα ερώτημα ισότητας πάνω σε πεδίο που δεν υπάρχει
 * επιστρέφει **κενό**. Δηλαδή ο πίνακας του ρυθμιστή θα έλεγε ήρεμα *«κανένα γραφείο δεν
 * περιμένει»* — για πάντα, χωρίς κανένα κόκκινο πουθενά.
 *
 * 🔑 Γι' αυτό το **Κ12ζ** δεν σπέρνει έγγραφο στο χέρι: καλεί τον **πραγματικό γραφέα** και
 * μετά τον **πραγματικό αναγνώστη**. Είναι ο μόνος έλεγχος που πιάνει την απόκλιση, επειδή
 * είναι ο μόνος που δεν επαναλαμβάνει την υπόθεση.
 *
 * ⚠️ **Η βάση δεν πλάθεται** — `FakeFirestore`, ίδιο ιδίωμα με το `organization-capability.test.ts`.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readCapabilityApplicants } from '@/services/company/organization-capability.reader';
import { declareBrokerage } from '@/services/company/organization-capability.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type {
  BrokerageDeclaration,
  CapabilityStatus,
  OrganizationCapabilityRecord,
} from '@/types/organization-capability';

const CAPABILITY = 'brokerage_listings' as const;
const SUPER_ADMIN = 'user_super';

const DECLARATION: BrokerageDeclaration = {
  gemiNumber: '123456789000',
  chamberRegistryNumber: 'EE-4821',
  legalRepresentativeName: 'Δοκιμαστικός Εκπρόσωπος',
  declaredAt: '2026-08-20T10:00:00.000Z',
  declaredByUserId: 'user_founder',
};

function recordOf(status: CapabilityStatus): OrganizationCapabilityRecord {
  return {
    status,
    requirements: [],
    declaration: DECLARATION,
    decidedByUserId: status === 'pending' ? null : SUPER_ADMIN,
    decidedAt: status === 'pending' ? null : '2026-08-28T17:30:00.000Z',
    revocationReason: status === 'revoked' ? 'Διαγραφή από το μητρώο μεσιτών' : null,
  };
}

/**
 * Σπέρνει εταιρεία **με όλα τα ευαίσθητα πεδία του πραγματικού εγγράφου** — ώστε το Κ12γ να
 * ελέγχει διαρροή πάνω σε ό,τι πράγματι υπάρχει, όχι σε καθαρό δείγμα.
 */
function seedCompany(fake: FakeFirestore, id: string, status: CapabilityStatus | null): void {
  fake.seed(COLLECTIONS.COMPANIES, id, {
    name: `ΓΡΑΦΕΙΟ ${id.toUpperCase()}`,
    createdBy: 'user_founder',
    _lastModifiedByName: 'Γεώργιος Παγώνης',
    settings: { theme: 'dark' },
    plan: 'enterprise',
    ...(status === null ? {} : { capabilities: { [CAPABILITY]: recordOf(status) } }),
  });
}

const db = (fake: FakeFirestore) => fake as unknown as AdminFirestore;

// ═══ Κ12 — η απαρίθμηση ══════════════════════════════════════════════════════

describe('Κ12 — ο αναγνώστης του ρυθμιστή', () => {
  test('Κ12α: επιστρέφει ΜΟΝΟ τη ζητούμενη κατάσταση', () => {
    const fake = new FakeFirestore();
    seedCompany(fake, 'comp_a', 'pending');
    seedCompany(fake, 'comp_b', 'active');
    seedCompany(fake, 'comp_c', 'revoked');
    seedCompany(fake, 'comp_d', null); // ποτέ δεν ζήτησε

    return readCapabilityApplicants(db(fake), CAPABILITY, 'pending').then((page) => {
      expect(page?.applicants.map((a) => a.companyId)).toEqual(['comp_a']);
      expect(page?.truncated).toBe(false);
    });
  });

  test('Κ12β: κάθε γραμμή αναγνωρίζεται — επωνυμία ΚΑΙ δήλωση', () => {
    // Χωρίς αυτά ο ρυθμιστής βλέπει λίστα από `comp_9c7c1a50-…` και δεν ξέρει ποιον κρίνει.
    const fake = new FakeFirestore();
    seedCompany(fake, 'comp_a', 'pending');

    return readCapabilityApplicants(db(fake), CAPABILITY, 'pending').then((page) => {
      const row = page?.applicants[0];
      expect(row?.companyName).toBe('ΓΡΑΦΕΙΟ COMP_A');
      expect(row?.disclosure.declaration?.gemiNumber).toBe('123456789000');
      expect(row?.disclosure.status).toBe('pending');
    });
  });

  test('Κ12γ: ΤΙΠΟΤΑ ευαίσθητο του εγγράφου δεν ταξιδεύει — ούτε στον ρυθμιστή', () => {
    // Ένα ερώτημα γυρίζει ΠΟΛΛΑ έγγραφα ταυτόχρονα: ένα `{...doc.data()}` θα διέρρεε
    // **σε πλήθος**, όχι ένα-ένα. Ό,τι δεν γυρίζει, δεν μπορεί να διαρρεύσει.
    const fake = new FakeFirestore();
    seedCompany(fake, 'comp_a', 'revoked');

    return readCapabilityApplicants(db(fake), CAPABILITY, 'revoked').then((page) => {
      // 🔴 **ΚΟΙΤΑΞΕ ΚΑΤΙ ΠΡΩΤΑ.** Χωρίς αυτή τη γραμμή ο έλεγχος είναι ΑΡΝΗΤΙΚΟΣ πάνω σε
      //    κενή λίστα, δηλαδή **κενά πράσινος**: μετρήθηκε ότι επιβίωνε μετάλλαξη που
      //    χαλούσε τη διαδρομή πεδίου — «τίποτα δεν διέρρευσε» επειδή **τίποτα δεν ήρθε**.
      //    Το ακριβές σχήμα «0 = κανείς δεν κοίταξε», μέσα στην άγκυρα που το κυνηγά.
      expect(page?.applicants).toHaveLength(1);

      const serialized = JSON.stringify(page);
      expect(serialized).not.toContain('Γεώργιος Παγώνης'); // _lastModifiedByName
      expect(serialized).not.toContain('user_founder ');    // createdBy (όχι το declaredByUserId)
      expect(serialized).not.toContain('enterprise');       // plan
      expect(serialized).not.toContain('theme');            // settings
      // Το «ποιος αποφάσισε» ανήκει στο ίχνος ελέγχου, όχι εδώ.
      expect(serialized).not.toContain(SUPER_ADMIN);
    });
  });

  test('Κ12δ: το `unrequested` ΔΕΝ απαριθμείται — `null`, ποτέ κενή λίστα', () => {
    // 🔴 Κενή λίστα θα ΜΟΙΑΖΕ με απάντηση: «κανείς δεν είναι unrequested» — ενώ η αλήθεια
    // είναι ότι σχεδόν όλοι είναι, και απλώς δεν υπάρχει πεδίο να ρωτηθεί.
    const fake = new FakeFirestore();
    seedCompany(fake, 'comp_d', null);

    return readCapabilityApplicants(db(fake), CAPABILITY, 'unrequested').then((page) => {
      expect(page).toBeNull();
    });
  });

  test('Κ12ε: πάνω από το ταβάνι ⇒ ΡΗΤΟ `truncated`, ποτέ σιωπηλή κοπή', () => {
    const fake = new FakeFirestore();
    for (let i = 0; i < 205; i += 1) seedCompany(fake, `comp_${i}`, 'pending');

    return readCapabilityApplicants(db(fake), CAPABILITY, 'pending').then((page) => {
      expect(page?.applicants).toHaveLength(200);
      expect(page?.truncated).toBe(true);
    });
  });

  test('Κ12στ: η βάση δεν απαντά ⇒ κενή σελίδα, ποτέ εξαίρεση προς την οθόνη', () => {
    const fake = new FakeFirestore();
    seedCompany(fake, 'comp_a', 'pending');
    fake.failReads = true;

    return readCapabilityApplicants(db(fake), CAPABILITY, 'pending').then((page) => {
      expect(page).toEqual({ applicants: [], truncated: false });
    });
  });
});

// ═══ Κ12ζ — ο γραφέας και ο αναγνώστης συμφωνούν στη ΔΙΑΔΡΟΜΗ ═══════════════

describe('Κ12ζ — η απόκλιση που ΔΕΝ σκάει', () => {
  test('δήλωση από τον ΠΡΑΓΜΑΤΙΚΟ γραφέα ⇒ ο ΠΡΑΓΜΑΤΙΚΟΣ αναγνώστης τη βρίσκει', async () => {
    // 🔑 Κανένα χειρόγραφο έγγραφο εδώ, επίτηδες: αν σπέρναμε το σχήμα με το χέρι, θα
    // επαναλαμβάναμε την ΥΠΟΘΕΣΗ και για τις δύο πλευρές, και η άγκυρα θα ήταν πράσινη
    // ακριβώς όταν ο γραφέας κι ο αναγνώστης αποκλίνουν — δηλαδή θα φύλαγε τον εαυτό της.
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.COMPANIES, 'comp_new', { name: 'ΝΕΟ ΓΡΑΦΕΙΟ' });

    const declared = await declareBrokerage(db(fake), 'comp_new', DECLARATION);
    expect(declared.kind).toBe('applied');

    const page = await readCapabilityApplicants(db(fake), CAPABILITY, 'pending');

    expect(page?.applicants).toHaveLength(1);
    expect(page?.applicants[0]?.companyId).toBe('comp_new');
    expect(page?.applicants[0]?.companyName).toBe('ΝΕΟ ΓΡΑΦΕΙΟ');
    expect(page?.applicants[0]?.disclosure.declaration?.gemiNumber).toBe('123456789000');
  });
});
