/**
 * @fileoverview Η προσυμπλήρωση επαφής από την πινακίδα (ADR-759 Φ1, Άξονας Γ).
 *
 * 🔴 **Το τελευταίο `describe` είναι το σημαντικότερο και δεν είναι για τον mapper.** Αποδεικνύει
 * τον **κύκλο**: πινακίδα → προσυμπλήρωση → επαφή → **ξανά ο ίδιος Λ2** → `name-exact`. Αυτό
 * είναι το κριτήριο 3 του «τελείωσε» (§Θ), και είναι το μόνο που πιάνει την πραγματική αστοχία
 * της ροής: μια προσυμπλήρωση που σώζει το όνομα σε μορφή που ο ταιριαστής **δεν ξαναβρίσκει**
 * — δηλαδή ο χρήστης καταχωρεί επαφή και η γραμμή μένει «δεν βρέθηκε».
 *
 * Τρέχει **χωρίς Firestore και χωρίς React**: η επαφή που θα γραφόταν συντίθεται από τα ίδια
 * πεδία που παράγει ο mapper, με τον **πραγματικό** `resolvePersonProposal` απέναντι.
 */

import { buildContactPrefill, findProposalPerson } from '@/lib/title-block/contact-prefill';
import { resolvePersonProposal, type ContactSnapshotEntry } from '@/lib/title-block/resolve-people';
import type { TitleBlockField, TitleBlockPerson, TitleBlockReading } from '@/types/title-block-reading';

/** Το κελί μελετητών του G753 — **δύο** μηχανικοί, **μία** γραμμή γραφείου. */
const OFFICE = {
  phones: ['2310-788493', '6949727121'],
  emails: ['info@nikolaou.com.gr'],
  websites: ['www.nikolaou.com.gr'],
  officeSeat: 'ΝΕΟΧΩΡΟΥΔΑ',
} as const;

const NIKOLAOU: TitleBlockPerson = {
  displayName: 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ',
  professionText: 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.',
  ...OFFICE,
};

const MAVROMICHALIS: TitleBlockPerson = {
  displayName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ',
  professionText: 'ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.',
  ...OFFICE,
};

const CELL: readonly TitleBlockPerson[] = [MAVROMICHALIS, NIKOLAOU];

/** Ο ίδιος άνθρωπος **μόνος** στο κελί — τότε τα στοιχεία δεν είναι κοινά με κανέναν. */
const ALONE: readonly TitleBlockPerson[] = [NIKOLAOU];

describe('buildContactPrefill — τι γνωρίζει το σχέδιο για το πρόσωπο', () => {
  it('όνομα, ειδικότητα, έδρα και στοιχεία επικοινωνίας φτάνουν όλα στη φόρμα', () => {
    const { formData } = buildContactPrefill(NIKOLAOU, CELL);

    expect(formData.type).toBe('individual');
    expect(formData.lastName).toBe('ΝΙΚΟΛΑΟΥ');
    expect(formData.firstName).toBe('ΙΩΑΝΝΗΣ');
    // Η **ωμή** ειδικότητα: το «Τ.Ε.» είναι πληροφορία που η γέφυρα ρόλων δεν κουβαλά.
    expect(formData.profession).toBe('ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.');
    expect(formData.city).toBe('ΝΕΟΧΩΡΟΥΔΑ');
    expect(formData.phones?.map((p) => p.number)).toEqual(['2310-788493', '6949727121']);
    expect(formData.emails?.map((e) => e.email)).toEqual(['info@nikolaou.com.gr']);
  });

  it('🔴 το αρχικό πατρωνύμου ΔΕΝ πετιέται — φτάνει στο πεδίο του, ωμό', () => {
    // ADR-745 §8 κανόνας 3: ό,τι διαβάστηκε και δεν χωράει, **φαίνεται**. Το «ΕΥ.» δεν είναι
    // όνομα· είναι ό,τι γνωρίζει το σχέδιο, και ο άνθρωπος το συμπληρώνει ή το σβήνει.
    expect(buildContactPrefill(NIKOLAOU, CELL).formData.fatherName).toBe('ΕΥ.');
  });

  it('🔑 το ΓΥΜΝΟ host αποκτά σχήμα — αλλιώς η ίδια η αποθήκευση θα το απέρριπτε', () => {
    // Ο Λ1 εξάγει `www.…` χωρίς σχήμα (`WEB_URL_EXTRACT_REGEX`), ενώ ο `isValidUrl` που φυλά
    // την εγγραφή απαιτεί http/https. Παραγωγός και επικυρωτής διαφωνούσαν εκ κατασκευής.
    expect(buildContactPrefill(NIKOLAOU, CELL).formData.websites?.[0].url).toBe(
      'https://www.nikolaou.com.gr',
    );
  });

  it('ESCO μόνο όταν η ειδικότητα ονομάζει ΕΝΑΝ ρόλο', () => {
    const single = buildContactPrefill(MAVROMICHALIS, CELL);
    expect(single.role).toBe('surveyor');
    expect(single.formData.iscoCode).toBe('2165');

    // «Μηχανικός» σκέτο ανήκει σε 5 από τους 7 ρόλους — καμία αυθαίρετη επιλογή.
    const vague = buildContactPrefill(
      { ...NIKOLAOU, professionText: 'ΜΗΧΑΝΙΚΟΣ' },
      [{ ...NIKOLAOU, professionText: 'ΜΗΧΑΝΙΚΟΣ' }],
    );
    expect(vague.role).toBeNull();
    expect(vague.formData.iscoCode).toBeUndefined();
  });
});

describe('🔴 τα στοιχεία του ΓΡΑΦΕΙΟΥ δηλώνονται — δεν γράφονται σιωπηλά ως προσωπικά', () => {
  it('ό,τι γράφεται κάτω από ΔΥΟ μηχανικούς αναγνωρίζεται ως γραφείου', () => {
    const { officeDetails } = buildContactPrefill(MAVROMICHALIS, CELL);

    // Στο G753 ο Μαυρομιχάλης φέρει το e-mail του **συνεργάτη** του (domain `nikolaou.com.gr`).
    // Χωρίς αυτή τη δήλωση, το ψέμα μπαίνει στη βάση και από εκεί και πέρα το ταίριασμα
    // «ταιριάζει το e-mail» γίνεται αληθινό — ακριβώς αυτό που ο Λ2 αρνείται να πιστέψει.
    expect(officeDetails).toEqual([
      { kind: 'phone', value: '2310-788493' },
      { kind: 'phone', value: '6949727121' },
      { kind: 'email', value: 'info@nikolaou.com.gr' },
      { kind: 'website', value: 'www.nikolaou.com.gr' },
    ]);
  });

  it('🔑 ΜΟΝΟΣ του στο κελί ⇒ τίποτα δεν είναι κοινό, καμία ψεύτικη προειδοποίηση', () => {
    // Ο φρουρός του ίδιου του ελέγχου: αν ο εντοπισμός επέστρεφε «όλα κοινά» πάντα, το
    // προηγούμενο test θα περνούσε δωρεάν και η προειδοποίηση θα εμφανιζόταν σε κάθε οθόνη —
    // δηλαδή θα έπαυε να σημαίνει κάτι.
    expect(buildContactPrefill(NIKOLAOU, ALONE).officeDetails).toEqual([]);
  });

  it('🔴 ΑΚΡΙΒΩΣ ένα πρωτεύον ανά πίνακα — αλλιώς η επικύρωση φράζει δεδομένα που δεν πληκτρολόγησε κανείς', () => {
    const { formData } = buildContactPrefill(MAVROMICHALIS, CELL);
    expect(formData.phones?.filter((p) => p.isPrimary)).toHaveLength(1);
    expect(formData.emails?.filter((e) => e.isPrimary)).toHaveLength(1);
  });

  it('🔑 πρωτεύον γίνεται το ΜΗ κοινό, όταν υπάρχει', () => {
    const own = '2310-999999';
    const soloPhone: TitleBlockPerson = { ...MAVROMICHALIS, phones: [...OFFICE.phones, own] };
    const { formData } = buildContactPrefill(soloPhone, [soloPhone, NIKOLAOU]);
    expect(formData.phones?.find((p) => p.isPrimary)?.number).toBe(own);
  });
});

describe('findProposalPerson — η πρώτη ύλη πίσω από την πρόταση', () => {
  const reading = { people: CELL } as unknown as TitleBlockReading;
  // 🔴 **ΔΕΥΤΕΡΟΣ του κελιού, επίτηδες.** Η πρώτη γραφή στόχευε τον `CELL[0]` και η μετάλλαξη
  // «επίστρεψε πάντα το πρώτο πρόσωπο» **πέρασε πράσινη** — το test δεν έλεγχε καθόλου την
  // αναζήτηση, έλεγχε ότι ο πίνακας δεν είναι κενός. Το ίδιο σχήμα με το «0 = κανείς δεν
  // κοίταξε»: ένα fixture που συμπίπτει με την προεπιλογή δεν διακρίνει τίποτα.
  const base = { titleBlockIndex: 0, personName: 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ', candidates: [] };

  it('🔑 βρίσκει τον ΣΥΓΚΕΚΡΙΜΕΝΟ άνθρωπο της πρότασης, όχι απλώς κάποιον του κελιού', () => {
    const found = findProposalPerson(base as never, [reading]);
    expect(found?.person).toBe(NIKOLAOU);
    expect(found?.person).not.toBe(MAVROMICHALIS);
    expect(found?.everyone).toHaveLength(2);
  });

  it('και τον πρώτο, όταν η πρόταση αφορά εκείνον', () => {
    const first = { ...base, personName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ' };
    expect(findProposalPerson(first as never, [reading])?.person).toBe(MAVROMICHALIS);
  });

  it('🔴 όνομα που δεν υπάρχει στο κελί ⇒ κανένα υποκείμενο, ΠΟΤΕ «ό,τι βρεθεί»', () => {
    const stranger = { ...base, personName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ' };
    expect(findProposalPerson(stranger as never, [reading])).toBeNull();
  });

  it('πρόταση χωρίς πρόσωπο (δήμος, Ο.Τ.) δεν παράγει υποκείμενο', () => {
    expect(findProposalPerson({ ...base, personName: undefined } as never, [reading])).toBeNull();
  });

  it('άγνωστος δείκτης πινακίδας δεν σκάει', () => {
    expect(findProposalPerson({ ...base, titleBlockIndex: 7 } as never, [reading])).toBeNull();
  });
});

describe('🔑 Ο ΚΥΚΛΟΣ — προσυμπλήρωση ⇒ επαφή ⇒ ο ΙΔΙΟΣ Λ2 ⇒ name-exact (§Θ κριτήριο 3)', () => {
  const field = {
    key: 'designers',
    rawValue: '',
    sourceHandle: 'mtext_7',
    labelHandle: 'mtext_6',
    at: { x: 0, y: 0 },
    matchedBy: 'same-cell',
  } as TitleBlockField;

  /** Ό,τι θα έβλεπε ο ταιριαστής αφού η φόρμα αποθηκευτεί **χωρίς καμία αλλαγή**. */
  const asStoredContact = (person: TitleBlockPerson, everyone: readonly TitleBlockPerson[]) => {
    const { formData } = buildContactPrefill(person, everyone);
    return {
      id: 'cont_new',
      // Ο `ContactNameResolver` για φυσικό πρόσωπο συνθέτει `firstName + ' ' + lastName`.
      displayName: `${formData.firstName} ${formData.lastName}`.trim(),
      phones: (formData.phones ?? []).map((p) => p.number),
      emails: (formData.emails ?? []).map((e) => e.email),
    } satisfies ContactSnapshotEntry;
  };

  it.each([
    ['ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ (αρχικό στη μέση)', NIKOLAOU],
    ['ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ (συστολή)', MAVROMICHALIS],
  ])('%s ⇒ ο Λ2 τον ξαναβρίσκει με name-exact', (_label, person) => {
    const stored = asStoredContact(person, CELL);

    const after = resolvePersonProposal(person, field, {
      projectId: 'proj_1',
      titleBlockIndex: 0,
      contacts: [stored],
    });

    expect(after.blockedBy).toBeUndefined();
    expect(after.candidates.length).toBeGreaterThan(0);
    // 🔴 `name-exact` και όχι `abbrev`: το «ΚΩΝ/ΝΟΣ» αποθηκεύεται **όπως γράφτηκε**, οπότε τα
    // δύο συστατικά ταυτίζονται κατά λέξη. Αν κάποια μέρα η προσυμπλήρωση «αναπτύξει» τη
    // συστολή σε «ΚΩΝΣΤΑΝΤΙΝΟΣ», αυτό εδώ γίνεται `abbrev` και κοκκινίζει — δηλαδή η
    // εφεύρεση ονόματος γίνεται ορατή αντί να περάσει ως βελτίωση.
    expect(after.candidates[0].evidence.some((e) => e.kind === 'name-exact')).toBe(true);
  });

  it('🔴 ο έλεγχος έχει νόημα: ΠΡΙΝ την καταχώριση η ίδια πρόταση είναι no-match', () => {
    // Χωρίς αυτό, το προηγούμενο test θα περνούσε ακόμη κι αν ο Λ2 ταίριαζε τα πάντα με όλα.
    const before = resolvePersonProposal(NIKOLAOU, field, {
      projectId: 'proj_1',
      titleBlockIndex: 0,
      contacts: [],
    });
    expect(before.blockedBy).toBe('no-match');
  });

  it('🔴 και ΔΕΝ ταιριάζει με τον ΑΛΛΟΝ μηχανικό, παρότι μοιράζονται e-mail και τηλέφωνα', () => {
    // Η καρδιά της §3.1: αν κάποιος χαλαρώσει το «όνομα = αναγκαία συνθήκη» για να «βρίσκει
    // περισσότερα», ο Νικολάου γίνεται υποψήφιος για τον Μαυρομιχάλη — με μαρτυρία που
    // *φαίνεται ισχυρότερη* από τη σωστή.
    const nikolaouStored = asStoredContact(NIKOLAOU, CELL);

    const forMavromichalis = resolvePersonProposal(MAVROMICHALIS, field, {
      projectId: 'proj_1',
      titleBlockIndex: 0,
      contacts: [nikolaouStored],
    });

    expect(forMavromichalis.blockedBy).toBe('no-match');
  });
});
