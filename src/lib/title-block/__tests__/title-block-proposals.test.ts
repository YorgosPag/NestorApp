/**
 * @fileoverview Λ2 άκρη-σε-άκρη πάνω στην ΠΡΑΓΜΑΤΙΚΗ πινακίδα (ADR-745 Φ3β).
 *
 * Η είσοδος δεν είναι χειροποίητη: τρέχει ο πραγματικός Λ1 πάνω στο fixture του
 * `G753_ergasia F.dxf`, ώστε ό,τι αλλάξει στην ανάγνωση να φαίνεται **εδώ**.
 */

import { readTitleBlocks } from '@/subapps/dxf-viewer/text-engine/title-block/reading/title-block-reading';
import { G753_TITLEBLOCK_ROWS } from '@/subapps/dxf-viewer/text-engine/title-block/reading/__tests__/fixtures/g753-titleblock.fixture';
import { BINDABLE_PROJECT_FIELDS, type BindingProposal } from '@/types/title-block-binding';
import type { TitleBlockPerson } from '@/types/title-block-reading';
import { resolveTitleBlockProposals } from '../title-block-proposals';
import { isDrawingMetaField } from '../resolve-drawing-meta';
import { type ContactSnapshotEntry, evidenceFor } from '../resolve-people';
import type { SurveySnapshot } from '../resolve-survey-record';

const PROJECT = 'proj_g753';
const LEVEL = 'lvl_topo';

const readings = () => readTitleBlocks('PINAKAKI 500', G753_TITLEBLOCK_ROWS);

/** Οι επαφές όπως θα ήταν στη βάση — με τόνους, πεζά και άλλη σειρά ονομάτων. */
const CONTACTS: readonly ContactSnapshotEntry[] = [
  {
    id: 'cont_mavro',
    displayName: 'Κωνσταντίνος Μαυρομιχάλης',
    phones: ['2310 788493'],
    emails: [],
  },
  {
    id: 'cont_nikolaou',
    displayName: 'Ιωάννης Νικολάου',
    phones: [],
    emails: ['INFO@nikolaou.com.gr'],
  },
  { id: 'cont_zerva', displayName: 'Γεωργία Ζέρβα', phones: [], emails: [] },
  { id: 'cont_other', displayName: 'Δημήτριος Παπαδόπουλος', phones: [], emails: [] },
];

/**
 * Το έργο έχει **ένα** τοπογραφικό, ανοιχτό (ADR-759 Φ3γ).
 *
 * ⚠️ Μέρος της **βασικής** κατάστασης και όχι ειδικό σενάριο: από τη Φ3γ ο προορισμός των
 * δηλώσεων του τοπογράφου είναι προϋπόθεση για δύο γραμμές της πινακίδας («Π.Ε.» και «ΧΡΟΝΟΣ
 * ΜΕΛΕΤΗΣ»). Χωρίς αυτό, το «κανονικό» σενάριο θα έλεγχε μονίμως τη μπλοκαρισμένη διαδρομή.
 */
const SURVEY: SurveySnapshot = {
  records: [{ id: 'srv_g753', isConfirmed: false, label: 'ΙΟΥΛΙΟΣ 2026' }],
  activeId: null,
};

const resolve = (contacts = CONTACTS) =>
  resolveTitleBlockProposals(readings(), {
    projectId: PROJECT,
    levelId: LEVEL,
    contacts,
    hasPrimaryAddress: true,
    survey: SURVEY,
  });

/**
 * ⚠️ Χωριστός βοηθός, **όχι** `resolve(CONTACTS, undefined)`: περνώντας `undefined` σε παράμετρο
 * με προεπιλογή, η προεπιλογή **ενεργοποιείται** — δηλαδή το «χωρίς έργο» θα είχε έργο και το
 * test θα ήταν πράσινο χωρίς να ελέγχει τίποτα.
 */
const resolveWithoutProject = () =>
  resolveTitleBlockProposals(readings(), { levelId: LEVEL, contacts: CONTACTS });

const forField = (all: BindingProposal[], key: string) => all.filter((p) => p.fieldKey === key);
const person = (all: BindingProposal[], name: string) => all.find((p) => p.personName === name);

describe('Λ2 — μελετητές', () => {
  it('🔴 ο τοπογράφος βρίσκεται με μαρτυρία ΤΗΛΕΦΩΝΟΥ παρά τη συστολή του ονόματος', () => {
    const p = person(resolve(), 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ');
    expect(p?.candidates[0].target).toEqual({
      kind: 'contact',
      contactId: 'cont_mavro',
      role: 'surveyor',
      projectId: PROJECT,
    });
    // Το τηλέφωνο της πινακίδας είναι «2310-788493», της βάσης «2310 788493».
    expect(p?.candidates[0].evidence.map((e) => e.kind)).toContain('phone');
    expect(p?.candidates[0].evidence.map((e) => e.kind)).toContain('name-abbrev');
  });

  it('ο δεύτερος μηχανικός παίρνει τον δικό του ρόλο από την ειδικότητά του', () => {
    const p = person(resolve(), 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ');
    expect(p?.candidates[0].target).toMatchObject({
      contactId: 'cont_nikolaou',
      role: 'structural_engineer',
    });
    // e-mail με άλλα πεζά/κεφαλαία — ταυτότητα, όχι συμβολοσειρά.
    expect(p?.candidates[0].evidence[0].kind).toBe('email');
  });

  it('🔴 το e-mail κατατάσσεται ΠΑΝΩ από το όνομα — η μαρτυρία είναι η βεβαιότητα', () => {
    const p = person(resolve(), 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ');
    const kinds = p?.candidates[0].evidence.map((e) => e.kind) ?? [];
    expect(kinds[0]).toBe('email');
  });

  it('άγνωστο πρόσωπο δηλώνεται «δεν βρέθηκε» — ποτέ σιωπηλά κενό', () => {
    const p = person(resolve([CONTACTS[3]]), 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ');
    expect(p?.candidates).toEqual([]);
    expect(p?.blockedBy).toBe('no-match');
  });

  it('🔴 «τον βρήκα αλλά δεν ξέρω με τι ιδιότητα» είναι ΑΛΛΟ μήνυμα από «δεν τον βρήκα»', () => {
    // Δύο διαφορετικά προβλήματα με διαφορετική θεραπεία — δεν επιτρέπεται να συγχέονται.
    const kinds = new Set(resolve().map((p) => p.blockedBy));
    expect(kinds.has('no-match')).toBe(false); // στο πλήρες στιγμιότυπο βρίσκονται όλοι
    const poor = resolve([{ id: 'c', displayName: 'Κωνσταντίνος Μαυρομιχάλης', phones: [], emails: [] }]);
    expect(person(poor, 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ')?.candidates.length).toBeGreaterThan(0);
  });
});

describe('Λ2 — ο «ΕΡΓΟΔΟΤΗΣ» πάει στους οικοπεδούχους, ΠΟΤΕ στον πελάτη', () => {
  it('προτείνεται ως οικοπεδούχος σε κατάσταση «prospective»', () => {
    const [p] = forField(resolve(), 'employer');
    expect(p.snapshotValue).toBe('ΖΕΡΒΑ ΓΕΩΡΓΙΑ');
    expect(p.candidates[0].target).toEqual({
      kind: 'landowner',
      projectId: PROJECT,
      contactId: 'cont_zerva',
      acquisitionStatus: 'prospective',
    });
  });

  it('🔴 ΚΑΜΙΑ πρόταση δεν δείχνει ποτέ στο Project.client', () => {
    const targets = resolve().flatMap((p) => p.candidates.map((c) => c.target));
    // Η λίστα είναι **η δηλωμένη ένωση** (`BindableProjectField`), όχι χειρόγραφη: όταν η Φ3
    // πρόσθεσε το `plotNumber`, ένα σκέτο `!== 'buildingBlock'` θα κοκκίνιζε ζητώντας να
    // «διορθωθεί» — δηλαδή θα εκπαίδευε τον επόμενο να χαλαρώνει τον φύλακα του `client`.
    const allowedProjectFields = new Set(BINDABLE_PROJECT_FIELDS);
    expect(
      targets.some((t) => t.kind === 'project-field' && !allowedProjectFields.has(t.field)),
    ).toBe(false);
    expect(JSON.stringify(targets)).not.toContain('client');
  });
});

describe('Λ2 — η ΘΕΣΗ σπάει σε ξεχωριστές αποφάσεις', () => {
  it('ο δήμος, η περιοχή και το Ο.Τ. γίνονται τρεις ανεξάρτητες προτάσεις', () => {
    const located = forField(resolve(), 'location');
    const byTarget = located
      .flatMap((p) => p.candidates)
      .map((c) => (c.target.kind === 'project-address' ? `${c.target.field}=${c.target.value}` : `${c.target.kind}=${'value' in c.target ? c.target.value : ''}`));

    expect(byTarget).toContain('municipality=ΚΟΡΔΕΛΙΟΥ ΕΥΟΣΜΟΥ');
    expect(byTarget).toContain('neighborhood=ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ');
    expect(byTarget).toContain('project-field=Ο.Τ. Γ 753');
  });

  it('🔴 το Ο.Τ. ΔΕΝ ρουφά την υπόλοιπη πρόταση — κάθε σημαδούρα τερματίζει την προηγούμενη', () => {
    const ot = forField(resolve(), 'location').find((p) => p.snapshotValue.startsWith('Ο.Τ.'));
    expect(ot?.snapshotValue).toBe('Ο.Τ. Γ 753');
    expect(ot?.snapshotValue).not.toContain('ΟΙΚ');
    expect(ot?.snapshotValue).not.toContain('Οδός');
  });

  /**
   * 🔴 **Η ΣΥΜΠΕΡΙΦΟΡΑ ΑΛΛΑΞΕ ΣΚΟΠΙΜΑ ΣΤΗ Φ3 — και τα δύο tests ξαναγράφτηκαν, δεν σβήστηκαν.**
   *
   * Πριν: και οι **τέσσερις** άδετες σημαδούρες έδιναν `unsupported-field` («κανείς δεν το
   * ζητά»). Η §2.2 μέτρησε ότι αυτό ήταν **ψευδές και στις τέσσερις**: δύο ζητούσαν πεδίο που
   * τώρα υπάρχει, μία ζητά σύνδεση που δεν γράφτηκε, και μία δεν μπορεί να αποφασιστεί από τη
   * μορφή. Τέσσερις θεραπείες, τέσσερις καταστάσεις.
   *
   * Το αναλλοίωτο του παλιού test **δεν χάθηκε** — «τίποτα δεν εξαφανίζεται σιωπηλά» ελέγχεται
   * τώρα αυστηρότερα: κάθε τιμή είναι **παρούσα** *και* φέρει **τη δική της** αιτία. Ένα test
   * που ζητούσε απλώς `unsupported-field` θα ήταν πράσινο και για τους τέσσερις λόγους, δηλαδή
   * για κανέναν.
   */
  it('🔴 Δ.Ε. και ΟΙΚ. ΑΠΕΚΤΗΣΑΝ πεδίο — προτείνονται, δεν δηλώνονται πια άδετα', () => {
    const located = forField(resolve(), 'location');

    const de = located.find((p) => p.snapshotValue.startsWith('Δ.Ε.'));
    expect(de?.blockedBy).toBeUndefined();
    expect(de?.candidates[0].target).toEqual({
      kind: 'project-address',
      projectId: PROJECT,
      field: 'municipalUnit',
      // Κρατά τη σημαδούρα, όπως το αδελφό `regionalUnit` («Π.Ε. Θεσσαλονίκης») — ένα λεξιλόγιο.
      value: 'Δ.Ε. ΕΥΟΣΜΟΥ',
    });

    const oik = located.find((p) => p.snapshotValue === '01β');
    expect(oik?.blockedBy).toBeUndefined();
    expect(oik?.candidates[0].target).toEqual({
      kind: 'project-field',
      projectId: PROJECT,
      field: 'plotNumber',
      // 🔴 ΧΩΡΙΣ το «ΟΙΚ.:» — ο καταναλωτής (`lib/obligations/content.ts:25`) τυπώνει δική του
      // ετικέτα «Αριθμός Οικοπέδου:», οπότε η σημαδούρα θα εμφανιζόταν δύο φορές.
      value: '01β',
    });
  });

  it('🔴 οι 4 ΟΔΟΙ γίνονται 4 ΞΕΧΩΡΙΣΤΕΣ γραμμές «resolver-gap» — το χρέος μετριέται', () => {
    const streets = forField(resolve(), 'location').filter((p) => p.blockedBy === 'resolver-gap');

    // Το ADR-745 §7 μέτρησε **4 πρόσωπα**· το `frontagesCount` του ADR-186 τα περιμένει ένα-ένα.
    expect(streets.map((p) => p.snapshotValue)).toEqual([
      'Προέκταση Σμύρνης',
      'Δημ. Κολοκυθά',
      'Ξενοκράτη',
      'Αναγεννήσεως',
    ]);
    // Κενό υλοποίησης ≠ «δεν χωράει»: το πεδίο υπάρχει από το ADR-186 Φ2.5.
    expect(streets.every((p) => p.candidates.length === 0)).toBe(true);
    expect(streets.some((p) => p.blockedBy === 'unsupported-field')).toBe(false);
  });

  /**
   * 🔴 **Η ΣΥΜΠΕΡΙΦΟΡΑ ΑΛΛΑΞΕ ΣΚΟΠΙΜΑ ΣΤΗ Φ3γ — και η αλλαγή είναι στο ΠΟΙΟΣ αποφασίζει.**
   *
   * Μέχρι τη Φ3β το «Π.Ε. 39» ήταν **φραγμός** (`ambiguous-abbreviation`) με ενέργεια
   * «περίμενε τη Φ5». Η §2β.3 είχε μετρήσει **τρεις** σημασίες του ακρωνυμίου στο ίδιο αρχείο
   * και το συμπέρασμα ήταν σωστό: *η μορφή δεν αποφασίζει*. Αυτό **δεν άλλαξε**.
   *
   * Αυτό που άλλαξε είναι ότι ο φραγμός ήταν **λάθος εργαλείο** για τη δουλειά: το πεδίο
   * υποδοχής υπήρχε από τη Φ2 και ο μηχανικός που κοιτάζει το σχέδιο **ξέρει** τι είναι το
   * «Π.Ε. 39». Ένα αδιέξοδο χωρίς ενέργεια είναι το κάτοπτρο του `resolver-gap` που «υπόσχεται
   * διόρθωση που κανείς δεν μπορεί να κάνει».
   *
   * ⇒ Πρόταση **με δηλωμένη επιφύλαξη**. Η αβεβαιότητα δεν κρύφτηκε — άλλαξε παραλήπτη.
   */
  it('🔴 το «Π.Ε. 39» ΠΡΟΤΕΙΝΕΤΑΙ πλέον, με ρητή επιφύλαξη — ο άνθρωπος αποφασίζει, όχι η μορφή', () => {
    const pe = forField(resolve(), 'location').find((p) => p.snapshotValue.includes('Π.Ε.'));
    expect(pe).toBeDefined();
    expect(pe?.blockedBy).toBeUndefined();
    expect(pe?.caution).toBe('ambiguous-abbreviation');

    // Ο προορισμός είναι **ονομαστικός**: ποια εγγραφή, ποιο πεδίο — και η τιμή είναι το «39»,
    // χωρίς τη σημαδούρα, γιατί το πεδίο τεκμηριώνεται ως αριθμός πράξης.
    expect(pe?.candidates).toHaveLength(1);
    expect(pe?.candidates[0].target).toEqual({
      kind: 'survey-record',
      projectId: PROJECT,
      recordId: 'srv_g753',
      field: 'implementationActNumber',
      value: { kind: 'text', value: '39' },
    });
  });

  it('🔒 σε ΠΑΓΩΜΕΝΟ τοπογραφικό το «Π.Ε. 39» μπλοκάρει ΟΡΑΤΑ — ποτέ σιωπηλή παράκαμψη', () => {
    const frozen = resolveTitleBlockProposals(readings(), {
      projectId: PROJECT,
      levelId: LEVEL,
      contacts: CONTACTS,
      hasPrimaryAddress: true,
      survey: { records: [{ id: 'srv_g753', isConfirmed: true, label: 'x' }], activeId: 'srv_g753' },
    });
    const pe = forField(frozen, 'location').find((p) => p.snapshotValue.includes('Π.Ε.'));
    expect(pe?.candidates).toEqual([]);
    expect(pe?.blockedBy).toBe('survey-record-locked');
  });

  it('🔴 χωρίς κύρια διεύθυνση, τα διοικητικά πεδία ΜΠΛΟΚΑΡΟΥΝ ΠΡΙΝ το κλικ — όχι μετά', () => {
    const noAddress = resolveTitleBlockProposals(readings(), {
      projectId: PROJECT,
      levelId: LEVEL,
      contacts: CONTACTS,
      hasPrimaryAddress: false,
    });
    const de = forField(noAddress, 'location').find((p) => p.snapshotValue.startsWith('Δ.Ε.'));
    expect(de?.blockedBy).toBe('no-primary-address');

    // …αλλά το Ο.Τ. είναι **βαθμωτό πεδίο έργου**, δεν χρειάζεται διεύθυνση: ένας φύλακας που
    // κλείνει και ό,τι δεν αφορά, είναι θόρυβος που εκπαιδεύει τον χρήστη να τον αγνοεί.
    const ot = forField(noAddress, 'location').find((p) => p.snapshotValue.startsWith('Ο.Τ.'));
    expect(ot?.blockedBy).toBeUndefined();
  });

  it('🔑 άγνωστη κύρια διεύθυνση (αποτυχία ανάγνωσης) ΔΕΝ μπλοκάρει — ο φύλακας του κλικ μένει', () => {
    // `undefined` σημαίνει «δεν ξέρω», ποτέ «δεν υπάρχει». Μια αποτυχία δικτύου που βάφεται
    // «το έργο δεν έχει διεύθυνση» είναι λάθος συμπέρασμα με σωστή μορφή.
    const unknown = resolveTitleBlockProposals(readings(), {
      projectId: PROJECT,
      levelId: LEVEL,
      contacts: CONTACTS,
    });
    const de = forField(unknown, 'location').find((p) => p.snapshotValue.startsWith('Δ.Ε.'));
    expect(de?.blockedBy).toBeUndefined();
    expect(de?.candidates).toHaveLength(1);
  });
});

describe('Λ2 — μεταδεδομένα σχεδίου', () => {
  /**
   * 🔴 **Η συμπεριφορά ΑΛΛΑΞΕ ΣΚΟΠΙΜΑ ΔΥΟ ΦΟΡΕΣ, και τα tests ξαναγράφτηκαν και τις δύο.**
   *
   * Φ3β: παρήγαν υποψήφιο ⇒ έγιναν `not-yet-writable`, γιατί το `DxfLevelDocument` δεν είχε τα
   * πεδία. **Φ3**: τα πεδία υπάρχουν πλέον σε **τρεις** θέσεις (τύπος · `UpdateDxfLevelSchema` ·
   * allowlist του `handleUpdateDxfLevel`) ⇒ ξαναγίνονται υποψήφιοι, και η κατάσταση
   * `not-yet-writable` **αφαιρέθηκε** από την ένωση αντί να μείνει χωρίς παραγωγό.
   */
  it('κλίμακα/χρόνος/αριθμός/είδος γίνονται ΟΛΑ εγγράψιμοι υποψήφιοι του ΕΠΙΠΕΔΟΥ', () => {
    // ⚠️ **Το φίλτρο είναι ο ΣΤΟΧΟΣ, όχι το `fieldKey` — και αυτό ΕΙΝΑΙ το test.** Από τη Φ3γ
    // το κελί «ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ» δίνει **δύο** προτάσεις με το ίδιο `fieldKey: 'studyDate'`
    // (φύλλο + τοπογραφικό). Ένα φίλτρο ανά `fieldKey` θα τις μάζευε και τις δύο και θα
    // απαιτούσε από την πρόταση **του τοπογραφικού** να είναι μεταδεδομένο σχεδίου — δηλαδή θα
    // κοκκίνιζε για σωστή συμπεριφορά.
    const meta = resolve().filter((p) =>
      p.candidates.some((c) => c.target.kind === 'drawing-meta'),
    );

    expect(meta.map((p) => `${p.fieldKey}=${p.snapshotValue}`)).toEqual(
      expect.arrayContaining(['scale=1:200', 'studyDate=ΙΟΥΛΙΟΣ 2026', 'drawingNumber=Τ1']),
    );
    expect(meta.length).toBeGreaterThanOrEqual(3);
    expect(meta.every((p) => p.blockedBy === undefined)).toBe(true);
    expect(meta.every((p) => isDrawingMetaField(p.fieldKey))).toBe(true);

    const scale = meta.find((p) => p.fieldKey === 'scale');
    expect(scale?.candidates[0].target).toEqual({
      kind: 'drawing-meta',
      levelId: LEVEL,
      projectId: PROJECT,
      field: 'scale',
      value: '1:200',
    });
  });

  /**
   * 🔴 **Ένα κελί, δύο αληθή γεγονότα** (ADR-759 Φ3γ).
   *
   * «ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ» λέει *πότε σχεδιάστηκε το φύλλο* **και** *πότε δήλωσε ο τοπογράφος*. Οι
   * δύο προτάσεις είναι **ξεχωριστές γραμμές** ώστε ο μηχανικός να δεχτεί τη μία και να
   * απορρίψει την άλλη, και **δεν αλληλοαναιρούνται**: το slot είναι το πεδίο
   * (`studyDate` ≠ `surveyDate`), όχι το κελί.
   *
   * ⚠️ Και το `value` του τοπογραφικού είναι **`null`**: «ΙΟΥΛΙΟΣ 2026» είναι μήνας, όχι
   * ημερομηνία. Το `rawText` το κρατά ακέραιο και η καρτέλα το δείχνει· μια εφευρημένη 1η
   * Ιουλίου θα διαβαζόταν ως γεγονός.
   */
  it('🔴 ο «ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ» δίνει ΔΥΟ προτάσεις — φύλλο ΚΑΙ τοπογραφικό, χωρίς να συγκρούονται', () => {
    const studyDate = resolve().filter((p) => p.fieldKey === 'studyDate');
    expect(studyDate).toHaveLength(2);

    const kinds = studyDate.flatMap((p) => p.candidates.map((c) => c.target.kind));
    expect(kinds.sort()).toEqual(['drawing-meta', 'survey-record']);

    const toSurvey = studyDate.find((p) =>
      p.candidates.some((c) => c.target.kind === 'survey-record'),
    );
    expect(toSurvey?.caution).toBe('partial-value');
    expect(toSurvey?.candidates[0].target).toEqual({
      kind: 'survey-record',
      projectId: PROJECT,
      recordId: 'srv_g753',
      field: 'surveyDate',
      value: { kind: 'text', value: null },
    });
  });

  /**
   * 🔑 Το αναλλοίωτο του ADR-745 §7: ένα έργο έχει **δεκάδες** σχέδια, και ένα μεταδεδομένο
   * σχεδίου γραμμένο στο έργο σημαίνει ότι το τελευταίο που ανοίγεις σβήνει σιωπηλά το
   * προηγούμενο.
   *
   * ⚠️ **Η διατύπωση ΣΤΕΝΕΨΕ στη Φ3γ, δεν χαλάρωσε.** Το αρχικό test έλεγε «κάθε στόχος είναι
   * `drawing-meta`», που ήταν *σωστό όσο υπήρχε ένας μόνο προορισμός* — αλλά μετρούσε τον
   * **αριθμό των ειδών**, ενώ το αναλλοίωτο αφορά **το έγγραφο του έργου**. Πλέον ρωτά αυτό
   * ακριβώς: κανένα κελί μεταδεδομένου δεν γράφει στο `projects/{id}`.
   *
   * Η προσγείωση στο **τοπογραφικό** δεν το παραβιάζει και δεν είναι εξαίρεση: το
   * `survey_records` είναι **χωριστή** συλλογή με **δική της** εγγραφή ανά έγγραφο (ADR-759
   * Q1), δηλαδή δεν υπάρχει μοναδικό πεδίο να επιγραφεί από το επόμενο σχέδιο. Ακριβώς ο λόγος
   * που το Q1 επέλεξε χωριστή συλλογή αντί για πεδία μέσα στο έργο.
   */
  it('🔑 η ΤΙΜΗ ανήκει στο φύλλο — κανένα κελί μεταδεδομένου δεν γράφει στο ΕΓΓΡΑΦΟ του έργου', () => {
    const targets = resolve()
      .filter((p) => isDrawingMetaField(p.fieldKey))
      .flatMap((p) => p.candidates.map((c) => c.target));
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.some((t) => t.kind === 'drawing-meta')).toBe(true);
    expect(targets.filter((t) => t.kind === 'project-field' || t.kind === 'project-address')).toEqual([]);
  });

  it('🔴 χωρίς έργο ΔΕΝ γράφονται — η ΤΙΜΗ ανήκει στο φύλλο, η ΑΠΟΔΕΙΞΗ όμως θέλει έργο', () => {
    const meta = resolveWithoutProject().filter((p) => p.fieldKey === 'scale');

    expect(meta).toHaveLength(1);
    // Το `TitleBlockBinding.projectId` είναι υποχρεωτικό επειδή το διαβάζει ο καταρράκτης
    // διαγραφής έργου. Χωρίς έργο, η έγκριση θα άφηνε provenance που **κανείς δεν μπορεί ποτέ
    // να ξαναβρεί ή να διαγράψει** — ορφανή απόδειξη, χειρότερη από καμία.
    expect(meta[0].blockedBy).toBe('no-project');
    expect(meta[0].candidates).toEqual([]);
  });
});

describe('Λ2 — σχέδιο χωρίς έργο', () => {
  it('🔴 τα πεδία έργου δηλώνονται ΚΛΕΙΣΤΑ με αιτία, δεν εξαφανίζονται', () => {
    const withoutProject = resolveWithoutProject();
    for (const key of ['employer', 'location', 'designers']) {
      const found = forField(withoutProject, key);
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((p) => p.blockedBy === 'no-project')).toBe(true);
    }
  });
});

describe('Λ2 — καμία σιωπηλή απώλεια', () => {
  it('κάθε πεδίο που διάβασε ο Λ1 εμφανίζεται σε τουλάχιστον μία πρόταση', () => {
    const readFields = readings().flatMap((r) => r.fields.map((f) => f.key));
    const proposed = new Set(resolve().map((p) => p.fieldKey));
    for (const key of readFields) expect(proposed.has(key)).toBe(true);
  });

  it('κάθε πρόταση χωρίς υποψήφιο έχει ΑΙΤΙΑ, και κάθε πρόταση με υποψήφιο δεν έχει', () => {
    for (const p of resolve()) {
      if (p.candidates.length === 0) expect(p.blockedBy).toBeDefined();
      else expect(p.blockedBy).toBeUndefined();
    }
  });

  it('ο δείκτης πινακίδας διατηρείται — το layer φέρει ΔΥΟ πινακίδες', () => {
    expect(readings()).toHaveLength(2);
    expect(resolve().every((p) => Number.isInteger(p.titleBlockIndex))).toBe(true);
  });
});

/**
 * 🔴 **Το πλήθος μαρτυριών είναι ΚΡΙΤΗΡΙΟ ΚΑΤΑΤΑΞΗΣ, όχι διακόσμηση.**
 *
 * Ο Λ1 συσσωρεύει ό,τι βρίσκει στο κελί χωρίς απο-διπλοτύπωση (`title-block-people.ts`,
 * `push(...phones)`). Το ίδιο τηλέφωνο γραμμένο σε δύο μορφές είναι **ένα** τηλέφωνο για το
 * `phoneKey` — αλλά παρήγαγε **δύο** μαρτυρίες. Έτσι μια επαφή μπορούσε να **σπάσει την
 * ισοπαλία** χωρίς να προσθέτει καμία πληροφορία, ο `unambiguousWinner` να την αυτο-επιλέξει και
 * το κουμπί να είναι **ενεργό**: λάθος **πρόσωπο** στη βάση, από άλλη πόρτα από εκείνη που
 * έκλεισε ο Τομέας Δ2.
 */
describe('Λ2 — μία μαρτυρία ανά ταυτότητα, όχι ανά γραφή', () => {
  const twoWritings: TitleBlockPerson = {
    displayName: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ',
    professionText: 'ΑΡΧΙΤΕΚΤΩΝ ΜΗΧΑΝΙΚΟΣ',
    // Το ΙΔΙΟ τηλέφωνο σε τρεις μορφές· το ΙΔΙΟ e-mail σε δύο γραφές πεζών-κεφαλαίων.
    phones: ['2310-788493', '2310 788493', '+30 2310 788493'],
    emails: ['info@nikolaou.com.gr', 'INFO@nikolaou.com.gr'],
  };
  const contact: ContactSnapshotEntry = {
    id: 'cont_p',
    displayName: 'Γεώργιος Παπαδόπουλος',
    phones: ['2310788493'],
    emails: ['info@nikolaou.com.gr'],
  };

  it('🔴 τρεις γραφές ενός τηλεφώνου δίνουν ΜΙΑ μαρτυρία', () => {
    const kinds = evidenceFor(twoWritings, contact).map((e) => e.kind);
    expect(kinds.filter((k) => k === 'phone')).toHaveLength(1);
  });

  it('🔴 δύο γραφές ενός e-mail δίνουν ΜΙΑ μαρτυρία', () => {
    const kinds = evidenceFor(twoWritings, contact).map((e) => e.kind);
    expect(kinds.filter((k) => k === 'email')).toHaveLength(1);
  });

  it('🔴 η επανάληψη ΔΕΝ προσθέτει ΒΑΡΟΣ — ίδιο πλήθος με μία και μόνη γραφή', () => {
    // Αυτό είναι όλο το διακύβευμα: το `evidence.length` ζυγίζει στο `compareBindingCandidates`.
    // Χωρίς απο-διπλοτύπωση οι ίδιες πληροφορίες μετρούσαν 6 αντί για 3, και το βάρος ήταν
    // **τυπογραφικό γεγονός της πινακίδας**, όχι απόδειξη ταυτότητας.
    const once: TitleBlockPerson = {
      ...twoWritings,
      phones: ['2310788493'],
      emails: ['info@nikolaou.com.gr'],
    };
    expect(evidenceFor(twoWritings, contact)).toHaveLength(evidenceFor(once, contact).length);
  });

  it('ο φρουρός: χωρίς επανάληψη οι μαρτυρίες παραμένουν ΔΥΟ ξεχωριστά τηλέφωνα', () => {
    const distinct: TitleBlockPerson = { ...twoWritings, phones: ['2310788493', '6949727121'] };
    const both: ContactSnapshotEntry = { ...contact, phones: ['2310788493', '6949727121'] };
    expect(evidenceFor(distinct, both).filter((e) => e.kind === 'phone')).toHaveLength(2);
  });
});
