/**
 * ADR-798 Φάση 3 — ΑΓΚΥΡΕΣ για τον **αναγνώστη** του δηλωμένου επαγγέλματος.
 *
 * Δεν ελέγχουν «τρέχει ο κώδικας». Χαρακτηρίζουν τις τέσσερις αναλλοίωτες που,
 * αν σπάσουν σιωπηλά, κάνουν μια **αυτο-δήλωση** να μοιάζει με **γνώση**:
 *
 *   Ρ-1  `null` = «δεν ρωτήθηκε» — ΠΟΤΕ «δεν έχει»
 *   Ρ-2  🔴 Η **απουσία δήλωσης ΔΕΝ είναι δήλωση** — κενό αντικείμενο ⇒ `unknown`
 *   Ρ-3  Ελεύθερο κείμενο είναι **νόμιμη** δήλωση, όχι ημιτελής
 *   Ρ-4  🔴 Το `escoUri` **φυλάει** το `iscoCode` — ορφανός κωδικός δεν εκτίθεται
 *   Ρ-5  Καμία κατάσταση `verified` πριν από τη Φάση 5
 *   Ρ-6  Η τιμή **ακολουθεί** το προφίλ (το σφάλμα εξαρτήσεων της Φάσης 2)
 */

import { renderHook } from '@testing-library/react';
import type { DeclaredOccupation } from '@/types/professional-identity';
import { useDeclaredOccupation } from '../useDeclaredOccupation';
import { resolveJobAffinity } from '@/config/isco-job-affinity';
import { PERSONAS } from '../../../scripts/lib/emulator/personas';

/**
 * Ό,τι θα επέστρεφε το `AuthContext`. Μεταβλητή ώστε οι μεταλλάξεις να γίνονται
 * **ΣΤΗΝ ΕΙΣΟΔΟ** — ποτέ στον κώδικα του αναγνώστη.
 */
let currentOccupation: DeclaredOccupation | null = null;

jest.mock('@/auth', () => ({
  useAuth: () => ({ declaredOccupation: currentOccupation }),
}));

/** Πραγματικές τιμές ESCO/ISCO: αρχιτέκτονας (ISCO-08 2161). */
const CLASSIFIED: DeclaredOccupation = {
  profession: 'Αρχιτέκτονας',
  escoUri: 'http://data.europa.eu/esco/occupation/8c3f536e-ba66-4321-ba40-363dc39f129b',
  escoLabel: 'αρχιτέκτονας',
  iscoCode: '2161',
};

function read(occupation: DeclaredOccupation | null) {
  currentOccupation = occupation;
  return renderHook(() => useDeclaredOccupation()).result.current;
}

// ============================================================================

describe('Ρ-1 — `null` σημαίνει «δεν ρωτήθηκε»', () => {
  it('δεν ισχυρίζεται ότι ο άνθρωπος δεν έχει επάγγελμα', () => {
    const view = read(null);
    expect(view.confidence).toBe('unknown');
    expect(view.occupation).toBeNull();
    expect(view.isClassified).toBe(false);
    expect(view.iscoCode).toBeNull();
  });
});

describe('Ρ-2 🔴 — η ΑΠΟΥΣΙΑ δήλωσης ΔΕΝ είναι δήλωση', () => {
  it('κενό αντικείμενο ⇒ `unknown`, όχι `declared`', () => {
    // Η Φάση 2 επιστρέφει `{}` για νέο χρήστη: το αντικείμενο **υπάρχει πάντα**.
    // Χωρίς αυτόν τον έλεγχο, κάθε νέος λογαριασμός θα φαινόταν «δηλωμένος» —
    // δηλαδή θα λέγαμε ότι ξέρουμε κάτι που δεν μας είπε κανείς.
    expect(read({}).confidence).toBe('unknown');
    expect(read({}).occupation).toBeNull();
  });

  it('κενά και κενές συμβολοσειρές δεν είναι τιμές', () => {
    expect(read({ profession: '' }).confidence).toBe('unknown');
    expect(read({ profession: '   ' }).confidence).toBe('unknown');
    expect(read({ profession: '\n\t' }).confidence).toBe('unknown');
  });
});

describe('Ρ-3 — το ελεύθερο κείμενο είναι ΝΟΜΙΜΗ δήλωση', () => {
  it('χωρίς ESCO: `declared`, μη ταξινομημένο, χωρίς κωδικό', () => {
    // ADR-132 §1 — η οπισθόδρομη συμβατότητα δεν είναι ημιτελής κατάσταση.
    const view = read({ profession: 'Εργολάβος οικοδομών' });
    expect(view.confidence).toBe('declared');
    expect(view.isClassified).toBe(false);
    expect(view.iscoCode).toBeNull();
    expect(view.occupation?.profession).toBe('Εργολάβος οικοδομών');
  });

  it('με ESCO: ταξινομημένο, και ο κωδικός εκτίθεται', () => {
    const view = read(CLASSIFIED);
    expect(view.confidence).toBe('declared');
    expect(view.isClassified).toBe(true);
    expect(view.iscoCode).toBe('2161');
  });
});

describe('Ρ-4 🔴 — το `escoUri` ΦΥΛΑΕΙ το `iscoCode`', () => {
  it('κωδικός ΧΩΡΙΣ ταξινόμηση ΔΕΝ εκτίθεται', () => {
    // Ο μοναδικός γραφέας (`EscoOccupationPicker`) εκπέμπει και τα τρία μαζί ή
    // κανένα. Άρα `iscoCode` χωρίς `escoUri` = εγγραφή αγνώστου προελεύσεως,
    // και ένα ορφανό ψηφίο ΔΕΝ επιτρέπεται να οδηγήσει την πρόταση δουλειάς.
    const view = read({ profession: 'Κάτι', iscoCode: '2611' });
    expect(view.confidence).toBe('declared');
    expect(view.isClassified).toBe(false);
    expect(view.iscoCode).toBeNull();
  });

  it('η ταξινόμηση κρίνεται από το URI, ΟΧΙ από την ετικέτα', () => {
    // Το `escoLabel` είναι αντίγραφο εμφάνισης — μπορεί να έχει μείνει από παλιά.
    const view = read({ profession: 'Δικηγόρος', escoLabel: 'δικηγόρος', iscoCode: '2611' });
    expect(view.isClassified).toBe(false);
    expect(view.iscoCode).toBeNull();
  });
});

describe('Ρ-5 — καμία κατάσταση `verified` πριν από τη Φάση 5', () => {
  it('τίποτα δηλωμένο από τον χρήστη δεν παράγει `verified`', () => {
    // Το `verified` θα προκύψει **μόνο** από το server-owned
    // `occupationVerification` (firestore.rules). Αν κάποια μέρα βγει από εδώ,
    // σημαίνει ότι μια αυτο-δήλωση πέρασε για επαληθευμένη.
    for (const input of [null, {}, CLASSIFIED, { profession: 'x' }]) {
      expect(read(input).confidence).not.toBe('verified');
    }
  });
});

describe('Ρ-6 — η τιμή ΑΚΟΛΟΥΘΕΙ το προφίλ', () => {
  it('🔴 ΣΤΟ ΙΔΙΟ στιγμιότυπο: το προφίλ φτάνει αργότερα και η τιμή ΞΕΠΑΓΩΝΕΙ', () => {
    // 🔴 Το σφάλμα της Φάσης 2: αν το `declaredOccupation` λείψει από τις
    // εξαρτήσεις του `useMemo`, η τιμή **παγώνει** στην πρώτη απόδοση — όταν το
    // προφίλ δεν έχει φορτώσει ακόμη — και το επάγγελμα φαίνεται «μη δηλωμένο»
    // ΓΙΑ ΠΑΝΤΑ. Σφάλμα που **καμία πύλη δεν πιάνει**.
    //
    // ⚠️ Απαιτεί **`rerender`**, όχι δεύτερο `renderHook`: καινούργιο στιγμιότυπο
    // ξαναϋπολογίζει έτσι κι αλλιώς, άρα θα έβγαινε πράσινο και με κενές
    // εξαρτήσεις — δηλαδή θα ήταν άγκυρα που δεν κοιτάζει τίποτα.
    currentOccupation = null;
    const { result, rerender } = renderHook(() => useDeclaredOccupation());
    expect(result.current.confidence).toBe('unknown');

    currentOccupation = CLASSIFIED;
    rerender();

    expect(result.current.confidence).toBe('declared');
    expect(result.current.iscoCode).toBe('2161');
  });

  it('όσο το προφίλ δεν αλλάζει, η ταυτότητα του αποτελέσματος μένει σταθερή', () => {
    // Το `useMemo` υπάρχει για να μην ξαναγεννιέται αντικείμενο σε κάθε απόδοση:
    // αλλιώς κάθε καταναλωτής με αυτό στις δικές του εξαρτήσεις ξαναϋπολογίζει
    // σε **κάθε** render του sidebar.
    currentOccupation = CLASSIFIED;
    const { result, rerender } = renderHook(() => useDeclaredOccupation());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('δύο διαφορετικά επαγγέλματα δίνουν διαφορετικό κωδικό', () => {
    expect(read({ ...CLASSIFIED, iscoCode: '2165' }).iscoCode).toBe('2165');
    expect(read({ ...CLASSIFIED, iscoCode: '2611' }).iscoCode).toBe('2611');
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Ρ-7 — 🔴 **Η ΔΙΑΔΡΟΜΗ, ΟΧΙ Ο ΠΙΝΑΚΑΣ** (ADR-798 §19)
 *
 * Η άγκυρα `Κ2` του rig (`scripts/__tests__/emulator-seed-personas.test.ts`)
 * καλεί `resolveJobAffinity(persona.occupation.iscoCode)` **απευθείας**. Η οθόνη
 * όμως δεν βλέπει ποτέ αυτό το πεδίο: βλέπει ό,τι της δίνει **αυτός** ο
 * αναγνώστης, που κατά το `Ρ-4` **αρνείται** ορφανό κωδικό.
 *
 * 🔴 Μετρημένο 2026-08-26, **πριν** τη θεραπεία: `Κ2` **πράσινο** με 6 στους 8 να
 * λύνονται σε τρεις δουλειές — και **8 στους 8** να φτάνουν στην οθόνη ως
 * **σιωπή**, γιατί κανένας δεν είχε `escoUri`. Δύο όργανα, δύο απαντήσεις, καμία
 * σύγκριση (σχήμα **ADR-749**).
 *
 * ⚠️ **ΕΔΩ ΖΕΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ, ΚΑΙ ΓΙ ΑΥΤΟ Η ΑΓΚΥΡΑ ΕΙΝΑΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ RIG**:
 * το `scripts/` δεν έχει React harness, οπότε μια άγκυρα εκεί θα **ξανάγραφε**
 * τον κανόνα του `escoUri` — δεύτερη διάλεκτος της ίδιας ερώτησης. Εδώ τρέχει ο
 * **πραγματικός** hook πάνω στα **πραγματικά** δεδομένα του rig.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe('Ρ-7 — οι άνθρωποι του rig φτάνουν στην ΟΘΟΝΗ, όχι μόνο στον πίνακα', () => {
  const WITH_OCCUPATION = PERSONAS.filter((p) => p.occupation);

  it('ο παρονομαστής: το rig ΕΧΕΙ επαγγελματίες να δοκιμάσει', () => {
    // Χωρίς αυτό, τα δύο επόμενα θα ήταν πράσινα πάνω σε **κενό σύνολο** —
    // ακριβώς το «0 = κανείς δεν κοίταξε» που η άγκυρα υπάρχει για να πιάσει.
    expect(WITH_OCCUPATION.length).toBeGreaterThanOrEqual(10);
  });

  it('ΚΑΘΕ επαγγελματίας του rig εκθέτει κωδικό μέσα από τον ΠΡΑΓΜΑΤΙΚΟ αναγνώστη', () => {
    const silent = WITH_OCCUPATION
      .filter((p) => read(p.occupation as DeclaredOccupation).iscoCode === null)
      .map((p) => p.email);
    expect(silent).toEqual([]);
  });

  it('ΚΑΘΕ επαγγελματίας του rig φτάνει σε δουλειά μέσα από τη ΔΙΑΔΡΟΜΗ', () => {
    const unreachable = WITH_OCCUPATION
      .filter((p) => resolveJobAffinity(read(p.occupation as DeclaredOccupation).iscoCode) === null)
      .map((p) => `${p.email} -> ${p.occupation?.iscoCode}`);
    expect(unreachable).toEqual([]);
  });

  it('ο πολίτης παραμένει ΣΙΩΠΗΛΟΣ: η θεραπεία δεν έδωσε επάγγελμα σε όποιον δεν δήλωσε', () => {
    // ⚠️ Ο **αντίστροφος** φρουρός. Χωρίς αυτόν, μια «διόρθωση» που δίνει σε
    // όλους κωδικό θα έβαφε τα δύο παραπάνω πράσινα ενώ θα κατέστρεφε τη
    // σημασία του `unknown` (ADR-798 Α5: η απουσία δήλωσης ΔΕΝ είναι δήλωση).
    const citizens = PERSONAS.filter((p) => !p.occupation);
    expect(citizens.length).toBeGreaterThanOrEqual(2);
    for (const c of citizens) {
      expect(c.occupation).toBeUndefined();
    }
    expect(read(null).confidence).toBe('unknown');
  });
});
