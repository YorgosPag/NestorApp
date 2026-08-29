/**
 * ADR-820 §5.2 — **Η ΔΗΛΩΣΗ ΧΩΡΟΥ**: ο υπάλληλος μαθαίνει ότι καταχωρεί **προσωπικά**,
 * και ο ιδιώτης δεν ακούει απάντηση σε ερώτηση που δεν έκανε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΤΟ Β5, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΟ ΑΠΟ ΤΑ ΥΠΟΛΟΙΠΑ
 * ────────────────────────────────────────────────────────────────────────────
 * Τα Β1-Β4 δοκιμάζουν **τον κριτή** *(ποιος βλέπει τη δήλωση)*. Το **Β5 δοκιμάζει
 * ότι η δήλωση ΦΤΑΝΕΙ στη φόρμα** — δηλαδή ότι το `DraftFormShell` την **αποδίδει**.
 *
 * ⚠️ Μετρήθηκε **2026-08-26** ότι μετάλλαξη σε σημείο **χρήσης** επιβιώνει όταν η
 * άγκυρα ρωτά για το **import**: το σύμβολο μένει, το JSX φεύγει, όλα πράσινα. Το
 * Β5 αποδίδει το **πραγματικό** κέλυφος και ψάχνει το **κείμενο** — αν κάποιος
 * σβήσει το `<PersonalCustodyNotice />` αφήνοντας την εισαγωγή, **κοκκινίζει**.
 *
 * 🔑 Και επειδή το `DraftFormShell` είναι το **ΕΝΑ** κέλυφος **ΤΡΙΩΝ** επιφανειών
 * *(ζήτηση Α9 · προσφορά Α14 · **εντολή §8.33**)*, το Β5 τις καλύπτει με μία απόδοση
 * — χωρίς δίδυμο αρχείο test, που θα ήταν το ίδιο λάθος του N.18 σε άλλο επίπεδο.
 *
 * 🔴 **ΚΑΙ Η ΤΡΙΤΗ ΕΙΝΑΙ ΠΟΥ ΑΝΕΤΡΕΨΕ ΤΗΝ ΠΡΩΤΗ ΓΡΑΦΗ.** Το `Β7` υπάρχει επειδή η
 * δήλωση αποδιδόταν **άνευ όρων** και θα έλεγε στον μεσίτη το **αντίθετο** από την
 * αλήθεια. Το βρήκε ο **γεννήτορας** των route slices — όχι η κρίση, όχι η οθόνη.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PersonalCustodyNotice } from '@/components/shared/PersonalCustodyNotice';
import { DraftFormShell } from '@/components/shared/forms/DraftFormShell';

// ---------------------------------------------------------------------------
// Η ΜΟΝΗ είσοδος που μεταλλάσσεται: «έχω γραφείο;»
// ---------------------------------------------------------------------------

let currentCompanyId: string | null | undefined;

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'usr_test', companyId: currentCompanyId } }),
}));

/** Το i18n επιστρέφει **το κλειδί** — κλειδώνουμε *ποια πρόταση ειπώθηκε*. */
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const TITLE = 'property-market:custody.personal.title';
const BODY = 'property-market:custody.personal.body';
const BROKERED = 'property-market:custody.personal.brokered';

const EMPLOYEE = 'comp_alpha_emulator';

beforeEach(() => {
  currentCompanyId = undefined;
});

describe('ADR-820 §5.2 — η δήλωση χώρου', () => {
  test('Β1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο ΥΠΑΛΛΗΛΟΣ γραφείου ΒΛΕΠΕΙ τη δήλωση', () => {
    // Χωρίς αυτό, κάθε «δεν τη βλέπει ο Χ» παρακάτω μπορεί να σημαίνει
    // «δεν αποδίδεται ΠΟΤΕ» — το σχήμα «πράσινο επειδή κανείς δεν κοίταξε».
    currentCompanyId = EMPLOYEE;
    render(<PersonalCustodyNotice custody="personal" />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
    expect(screen.getByText(BROKERED)).toBeInTheDocument();
  });

  test('Β2 — ο ΠΟΛΙΤΗΣ ΔΕΝ τη βλέπει: δεν υπάρχει δεύτερος χώρος να συγχυστεί', () => {
    currentCompanyId = undefined;
    render(<PersonalCustodyNotice custody="personal" />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  test('Β3 — ο ΑΥΤΟΝΟΜΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΔΕΝ τη βλέπει — το επάγγελμα ΔΕΝ είναι χώρος', () => {
    // 🔑 ADR-798 §4: η επαγγελματική ιδιότητα «ΠΟΤΕ δεν δίνει δικαίωμα».
    //    Ο `ext.architect@solo.local` έχει ESCO 2161 και **κανένα** γραφείο ⇒
    //    η δήλωση θα ήταν θόρυβος. Ο κριτής ρωτά **χώρο**, όχι ιδιότητα.
    currentCompanyId = null;
    render(<PersonalCustodyNotice custody="personal" />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  test('Β4 — ΚΕΝΗ συμβολοσειρά ΔΕΝ είναι οργανισμός (fail-closed, όπως ο server)', () => {
    currentCompanyId = '';
    render(<PersonalCustodyNotice custody="personal" />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  test('Β5 — Η ΧΡΗΣΗ: το κέλυφος ΠΡΟΣΩΠΙΚΗΣ φόρμας την αποδίδει', () => {
    currentCompanyId = EMPLOYEE;
    render(<DraftShellHarness custody="personal" />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  test('Β6 — ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Β5: το ίδιο κέλυφος ΣΙΩΠΑ για τον πολίτη', () => {
    // Χωρίς αυτό, το Β5 θα μπορούσε να είναι πράσινο επειδή το κέλυφος αποδίδει
    // τη δήλωση **άνευ όρων** — δηλαδή θα έλεγε στον ιδιώτη κάτι που δεν τον αφορά.
    currentCompanyId = undefined;
    render(<DraftShellHarness custody="personal" />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  test('Β7 — 🔴 Η ΡΟΗ ΕΝΤΟΛΗΣ ΣΙΩΠΑ: εκεί η αγγελία ΑΝΗΚΕΙ στο γραφείο', () => {
    // 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΒΡΗΚΕ Ο ΓΕΝΝΗΤΟΡΑΣ, ΟΧΙ Η ΚΡΙΣΗ (ADR-820 §5.2).
    //    Το `BrokeredListingPageContent` ξαναχρησιμοποιεί το ΙΔΙΟ
    //    `OwnerPropertyFormContent` για το `/o/<χώρος>/listings/mandates/new`.
    //    Η πρώτη γραφή απέδιδε τη δήλωση ΑΝΕΥ ΟΡΩΝ ⇒ ο μεσίτης θα διάβαζε
    //    «ανήκει σε εσένα, όχι στο γραφείο σου» για αγγελία που ανήκει **στο
    //    γραφείο**. Το ίδιο ψέμα που το component γράφτηκε να σβήσει, σε νέα θέση.
    currentCompanyId = EMPLOYEE;
    render(<DraftShellHarness custody="company" />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Η ΧΡΗΣΗ ΣΤΟΥΣ ΔΥΟ ΚΑΛΟΥΝΤΕΣ — ΕΛΕΓΧΟΣ ΤΟΥ **ΓΡΑΜΜΕΝΟΥ JSX**
  // -------------------------------------------------------------------------
  //
  // 🔴 Οι δύο φόρμες είναι πολύ βαριές για απόδοση εδώ *(δυναμικά πεδία, χάρτης,
  //    μνήμη προσχεδίου)*, και ο κίνδυνος που μένει είναι **συγκεκριμένος**: να
  //    περάσει κάποιος τη **λάθος σταθερά**. Το ίδιο πρότυπο με το
  //    `workspace-segment.test.ts`, που ελέγχει το **JSX** και όχι το όνομα
  //    συμβόλου — ακριβώς επειδή μετάλλαξη προορισμού είχε επιβιώσει (26/08).

  test('Β8 — η ΠΡΟΣΦΟΡΑ παράγει τον χώρο από το `mandate`, ποτέ από σταθερά', () => {
    const source = readFileSync(
      resolve(__dirname, '../../owner-property/OwnerPropertyFormContent.tsx'),
      'utf8',
    );
    expect(source).toMatch(
      /custody=\{mandate === undefined \? 'personal' : 'company'\}/,
    );
  });

  test('Β9 — η ΖΗΤΗΣΗ δηλώνει ρητά προσωπικό χώρο', () => {
    const source = readFileSync(
      resolve(__dirname, '../../demand/DemandFormContent.tsx'),
      'utf8',
    );
    expect(source).toMatch(/custody="personal"/);
  });
});

/**
 * Το **πραγματικό** κέλυφος, με το ελάχιστο που απαιτεί η υπογραφή του.
 *
 * ⚠️ **Κανένα mock του `DraftFormShell`** — ένα mock εδώ θα δοκίμαζε τον διπλό του,
 * και το Β5 θα έμενε πράσινο ακόμη κι αν το πραγματικό κέλυφος έσβηνε τη δήλωση.
 */
function DraftShellHarness({
  custody,
}: {
  readonly custody: 'personal' | 'company';
}): React.ReactElement {
  const form = useForm<{ dummy: string }>({ defaultValues: { dummy: '' } });

  return (
    <DraftFormShell
      // ⚠️ **Κείμενα, όχι `keyBase` (2026-08-29).** Το κέλυφος δεν χτίζει πια κλειδί —
      //    τα παίρνει έτοιμα από τον μεταφραστή της βάσης του. Εδώ δίνονται ρητά
      //    ώστε η άγκυρα να μένει πάνω στη **δήλωση χώρου**, που είναι το θέμα της,
      //    και να μην εξαρτάται από τα locale. Δες `lib/forms/draft-form-labels.ts`.
      // ⚠️ Ταυτοτικός μεταφραστής: η άγκυρα μένει πάνω στη **δήλωση χώρου**, που
      //    είναι το θέμα της, και δεν εξαρτάται από τα locale.
      text={(id) => id}
      custody={custody}
      form={form}
      editing={false}
      validation={{ kind: 'ready', draft: {} }}
      submitState="idle"
      onSubmit={() => undefined}
      onCancel={() => undefined}
    >
      <p>πεδία</p>
    </DraftFormShell>
  );
}
