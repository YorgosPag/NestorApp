/**
 * CHECK 3.44 / ADR-772 §9 — η πύλη του λεξιλογίου διευθύνσεων ελέγχεται από τη ΔΙΚΗ της σουίτα.
 *
 * ΔΟΜΗ (ίδια με τα CHECK 3.35/3.36/3.37/3.38/3.39/3.41):
 *   Μ0      — το ΖΩΝΤΑΝΟ δέντρο περνά καθαρό, με **παρονομαστή**
 *   Μ1..Μ8  — μία ΜΕΤΑΛΛΑΞΗ ανά ρητή κατάσταση· αν η πύλη δεν την πιάσει, δεν είναι πύλη
 *   Π1..Π7  — ο ΠΡΑΓΜΑΤΙΚΟΣ κώδικας, με **χειρόγραφη** λίστα προσδοκίας
 *   Κ1..Κ6  — κοκκίωση: τι ΔΕΝ πιάνει, δηλωμένο ως test και όχι ως ελπίδα
 *
 * 🔑 ΓΙΑΤΙ ΤΑ Π ΕΙΝΑΙ ΧΕΙΡΟΓΡΑΦΑ, ΕΠΙΤΗΔΕΣ. Ένα test που διαβάζει το συμβόλαιο **από το
 * ίδιο πράγμα που ελέγχει** είναι πράσινο και άχρηστο (ADR-587 §6.1). Ο σαρωτής παίρνει
 * τα οκτώ επίπεδα και τα πέντε δοχεία **από τον πίνακα**· τα Π τα ξαναγράφουν με το χέρι,
 * ώστε μια αθόρυβη αφαίρεση γραμμής να έχει **δεύτερη φωνή** να τη διαψεύσει.
 *
 * 🔑 ΓΙΑΤΙ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ **ΕΙΣΟΔΟΥΣ**, ΟΧΙ ΣΤΗΝ ΠΥΛΗ. Κάθε Μ αντιγράφει τα
 * **πραγματικά** αρχεία σε μίνι-repo και αλλάζει **μία** γραμμή — δηλαδή κάνει ακριβώς
 * αυτό που θα έκανε ένας άνθρωπος αύριο. Μετάλλαξη στον κώδικα της πύλης θα αποδείκνυε
 * μόνο ότι ο κώδικας εκτελείται· μετάλλαξη στην είσοδο αποδεικνύει ότι η πύλη **απαντά
 * το ερώτημα**.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const gate = require('../check-address-vocabulary-coverage');
const { readVocabularyTable, VOCABULARY_FILE } = require('../lib/address-vocabulary/vocabulary-table');
const { createResolver, isGeneratedSource } = require('../lib/address-vocabulary/type-index');
const {
  classifyVocabulary, adminFieldNames,
  ZERO_TOLERANCE_STATES, RATCHETED_STATES,
} = require('../lib/address-vocabulary/evaluate');

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Τα αρχεία που **ορίζουν** την απάντηση — πραγματικά, αντιγραμμένα αυτούσια. */
const FIXTURE_FILES = [
  'tsconfig.base.json',
  VOCABULARY_FILE,
  'src/components/shared/addresses/address-with-hierarchy-config.ts',
  'src/types/project/addresses.ts',
  'src/types/ContactFormTypes.ts',
  // Η ΠΡΑΓΜΑΤΙΚΗ αλυσίδα barrel: `@/types/contacts` → `src/types/contacts.ts`
  // (το `probe` του ADR-700 προτιμά αρχείο από φάκελο) → `./contacts/contracts`.
  'src/types/contacts.ts',
  'src/types/contacts/index.ts',
  'src/types/contacts/contracts.ts',
];

/**
 * Μίνι-repo με τα ΑΚΡΙΒΗ μονοπάτια που περιμένει ο σαρωτής.
 * `edits` = `{ 'σχετικό/μονοπάτι': (πηγή) => νέα πηγή }` — μία γραμμή, πραγματικό αρχείο.
 */
function miniRepo(edits = {}, extraFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'av44-'));
  for (const rel of FIXTURE_FILES) {
    let source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    if (edits[rel]) {
      const next = edits[rel](source);
      // Μια μετάλλαξη που δεν άλλαξε τίποτα είναι ο ορισμός του νεκρού test
      // (ADR-772 §9, μάθημα Μ11): ουρλιάζει αντί να περάσει πράσινη.
      if (next === source) throw new Error(`η μετάλλαξη στο ${rel} ΔΕΝ άλλαξε τίποτα.`);
      source = next;
    }
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }
  for (const [rel, source] of Object.entries(extraFiles)) {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }
  return root;
}

const run = (edits, extraFiles, args = []) => gate.measure(args, miniRepo(edits, extraFiles));
const statesOf = (m) => m.violations.map((v) => v.state).sort();

/**
 * ⚠️ ΤΟ ΜΙΝΙ-REPO ΔΕΝ ΕΙΝΑΙ ΚΑΘΑΡΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ: κουβαλά τα **πραγματικά**
 * αρχεία, άρα και δύο από τα τέσσερα ζωντανά `unregistered-vocabulary`
 * (`IndividualAddress`, `ContactFormData` — και τα δύο στο `ContactFormTypes.ts`).
 * Οι μεταλλάξεις κρίνονται στη **διαφορά**, όχι στο σύνολο· να τις συγκρίναμε με το
 * κενό σύνολο θα σήμαινε είτε ψεύτικο κόκκινο είτε — χειρότερα — προσαρμογή του
 * κριτηρίου μέχρι να «βγει» ο αριθμός.
 */
const MINI_BASE_IDS = new Set(run({}, {}, ['--all']).violationIds);
const newStates = (m) => m.violations
  .filter((v) => !MINI_BASE_IDS.has(`${v.state}::${v.id}`))
  .map((v) => v.state).sort();
const newViolations = (m) => m.violations.filter((v) => !MINI_BASE_IDS.has(`${v.state}::${v.id}`));

/** Ένα νέο, πραγματικά σχηματισμένο δοχείο — ο μοχλός των Μ5..Μ7. */
const sixthVocabulary = (fields, header = '') => `${header}export interface SixthAddressVocabulary {
${fields.map((f) => `  ${f};`).join('\n')}
}
`;

// ─── Μ0 — αγκύρωση παλινδρόμησης στο ζωντανό δέντρο ───────────────────────────

describe('Μ0 — το ζωντανό δέντρο', () => {
  it('περνά το Στρώμα 1 καθαρό, και ΕΧΕΙ κρίνει πεδία (ο παρονομαστής)', () => {
    const m = gate.measure([]);
    expect(m.violations).toEqual([]);
    // ⚠️ Χωρίς αυτή τη γραμμή, ένας σαρωτής που δεν άνοιξε κανένα δοχείο θα ήταν
    // εξίσου «πράσινος» — το «0 = κανείς δεν κοίταξε» μέσα στο test που το κυνηγά.
    expect(m.judgedContainerFields).toBeGreaterThanOrEqual(50);
  });

  it('περνά το μίνι-repo καθαρό — η βάση κάθε μετάλλαξης είναι όντως καθαρή', () => {
    expect(run({}, {}).violations).toEqual([]);
  });

  it('εκθέτει ρητή κατάσταση για ΚΑΘΕ δήλωση — καμία σιωπηλή κατηγορία', () => {
    const m = run({}, {}, ['--all']);
    const total = Object.values(m.byState).reduce((a, b) => a + b, 0);
    const declared = m.declarationCount;
    expect(total).toBe(declared);
    expect(m.byState['registered-vocabulary']).toBe(5);
  });

  it('η βάση του μίνι-repo είναι ΓΝΩΣΤΗ ονομαστικά — όχι «ό,τι βγει»', () => {
    expect([...MINI_BASE_IDS].sort()).toEqual([
      'unregistered-vocabulary::src/types/ContactFormTypes.ts::ContactFormData',
      'unregistered-vocabulary::src/types/ContactFormTypes.ts::IndividualAddress',
    ]);
  });

  it('το ΖΩΝΤΑΝΟ δέντρο βρίσκει ακριβώς τα τέσσερα γνωστά, ονομαστικά', () => {
    const baseline = JSON.parse(fs.readFileSync(gate.baselineFile(), 'utf8'));
    expect(baseline.violations).toEqual([
      'unregistered-vocabulary::src/components/contacts/pickers/AdministrativeAddressPicker.tsx::AdministrativeAddress',
      'unregistered-vocabulary::src/components/contacts/relationships/hooks/useDerivedWorkAddresses.ts::DerivedWorkAddress',
      'unregistered-vocabulary::src/types/ContactFormTypes.ts::ContactFormData',
      'unregistered-vocabulary::src/types/ContactFormTypes.ts::IndividualAddress',
    ]);
  });
});

// ─── Μ1..Μ8 — μία μετάλλαξη ανά ρητή κατάσταση ────────────────────────────────

describe('Μ1..Μ8 — μεταλλάξεις στις ΕΙΣΟΔΟΥΣ', () => {
  it('Μ1: `communityId` στο ProjectAddress ⇒ unmapped-administrative-field (το ακριβές σενάριο του §5)', () => {
    const m = run({
      'src/types/project/addresses.ts': (s) =>
        s.replace('  settlementId?: string | null;', '  communityId?: string | null;\n  settlementId?: string | null;'),
    }, {});
    expect(statesOf(m)).toEqual(['unmapped-administrative-field']);
    expect(m.violations[0].detail).toMatch(/communityId/);
    expect(m.violations[0].detail).toMatch(/community/);
  });

  it('Μ2: κόψε το `region` από την ΑΛΥΣΙΔΑ ⇒ το CompanyAddress.region μένει αδιεκδίκητο', () => {
    // Η αλυσίδα `['regionName', 'region']` είναι ο λόγος που ο σαρωτής διαβάζει ΟΛΑ τα
    // ονόματα, όχι το πρώτο. Χωρίς αυτό, ψευδώς θετικό — μετρημένο, ADR-772 §9.
    const m = run({
      [VOCABULARY_FILE]: (s) => s.replace("name: ['regionName', 'region']", "name: ['regionName']"),
    }, {});
    expect(statesOf(m)).toEqual(['unmapped-administrative-field']);
    expect(m.violations[0].id).toBe('companyAddress::region');
  });

  it('Μ3: νέο πεδίο σε ΒΑΣΗ (`GreekAdministrativeHierarchyFields`) ⇒ πιάνεται μέσω κληρονομιάς', () => {
    // Το `CompanyAddress` δηλώνει ΜΗΔΕΝ δικά του διοικητικά πεδία. Σαρωτής που διαβάζει
    // μόνο τα δικά μέλη θα έλεγε «καθαρό» — πράσινο που σημαίνει «δεν κοίταξα».
    const m = run({
      'src/types/ContactFormTypes.ts': (s) =>
        s.replace('  regionalUnitName?: string;', '  regionalUnitId?: string | null;\n  regionalUnitName?: string;'),
    }, {});
    expect(statesOf(m)).toEqual(['unmapped-administrative-field']);
    expect(m.violations[0].id).toBe('companyAddress::regionalUnitId');
  });

  it('Μ4: σπασμένη επανεξαγωγή barrel ⇒ unanalyzable-container (fail-closed), ΟΧΙ σιωπηλό πράσινο', () => {
    const m = run({
      'src/types/contacts.ts': (s) => s.replace("export * from './contacts/contracts';", '// (μετάλλαξη Μ4)'),
    }, {});
    expect(statesOf(m)).toEqual(['unanalyzable-container']);
    expect(m.violations[0].detail).toMatch(/addressInfo/);
  });

  it('Μ5: έκτο λεξιλόγιο (3 πεδία, 2 ταυτότητες) ⇒ unregistered-vocabulary στο --all', () => {
    const m = run({}, {
      'src/services/rogue-address.ts': sixthVocabulary([
        'settlementId: string | null',
        'municipalityId: string | null',
        'municipality: string',
      ]),
    }, ['--all']);
    expect(newStates(m)).toEqual(['unregistered-vocabulary']);
    expect(newViolations(m)[0].id).toBe('src/services/rogue-address.ts::SixthAddressVocabulary');
  });

  it('Μ6: το κατώφλι ταυτοτήτων είναι ΦΟΡΤΙΟ και προς τις δύο κατευθύνσεις', () => {
    const withOneId = run({}, {
      'src/services/rogue-address.ts': sixthVocabulary([
        'settlementId: string | null',
        'municipality: string',
        'region: string',
      ]),
    }, ['--all']);
    // 1 ταυτότητα = *αναφορά*, όχι λεξιλόγιο — αυτό είναι το σχήμα του
    // `ContactAddressMapPreviewProps`, μετρημένο ψευδώς θετικό του απλοϊκού κριτηρίου.
    expect(newStates(withOneId)).toEqual([]);
    expect(withOneId.byState['below-vocabulary-threshold']).toBeGreaterThan(0);

    const withTwoIds = run({}, {
      'src/services/rogue-address.ts': sixthVocabulary([
        'settlementId: string | null',
        'municipalityId: string | null',
        'region: string',
      ]),
    }, ['--all']);
    expect(newStates(withTwoIds)).toEqual(['unregistered-vocabulary']);
  });

  it('Μ7: ο δείκτης παραγωγής είναι ΖΩΝΤΑΝΟΣ — τον βάζεις: πράσινο, τον βγάζεις: κόκκινο', () => {
    const fields = ['settlementId: string | null', 'municipalityId: string | null', 'region: string'];
    const generated = run({}, {
      'src/services/rogue-address.ts': sixthVocabulary(fields, '/** Auto-generated. */\n'),
    }, ['--all']);
    expect(newStates(generated)).toEqual([]);
    expect(generated.byState['generated-artifact']).toBe(1);

    const handWritten = run({}, {
      'src/services/rogue-address.ts': sixthVocabulary(fields, '/** Γραμμένο στο χέρι. */\n'),
    }, ['--all']);
    expect(newStates(handWritten)).toEqual(['unregistered-vocabulary']);
  });

  it('Μ8: η baseline ΑΡΝΕΙΤΑΙ να απορροφήσει εύρημα μηδενικής ανοχής', () => {
    const m = run({
      'src/types/project/addresses.ts': (s) =>
        s.replace('  settlementId?: string | null;', '  communityId?: string | null;\n  settlementId?: string | null;'),
    }, {}, ['--all']);
    expect(() => gate.buildPayload(m)).toThrow(/μηδενικής ανοχής/);
    // ⚠️ Χωρίς αυτό, ένα `--write-baseline` θα μετέτρεπε την απάντηση του §2.1 σε
    // «αποδεκτό χρέος» — δηλαδή θα ξανάφτιαχνε τη σιωπή που η πύλη σπάει.
  });
});

// ─── Π1..Π7 — ο πραγματικός κώδικας, με χειρόγραφη προσδοκία ──────────────────

describe('Π1..Π7 — ο ζωντανός πίνακας, ελεγμένος από ΔΕΥΤΕΡΗ φωνή', () => {
  const table = readVocabularyTable(REPO_ROOT);

  it('Π1: οκτώ επίπεδα, ονομαστικά (χειρόγραφα — ΟΧΙ διαβασμένα από τον πίνακα)', () => {
    expect(table.levelRoots).toEqual([
      'settlement', 'community', 'municipalUnit', 'municipality',
      'regionalUnit', 'region', 'decentAdmin', 'majorGeo',
    ]);
  });

  it('Π2: πέντε δοχεία, ονομαστικά', () => {
    expect(table.containers.map((c) => `${c.key}:${c.typeName}`)).toEqual([
      'form:AddressWithHierarchyValue',
      'projectAddress:ProjectAddress',
      'companyAddress:CompanyAddress',
      'addressInfo:AddressInfo',
      'contactFlat:FlatAddressFormFields',
    ]);
  });

  it('Π3: το companyAddress διεκδικεί ΚΑΙ `regionName` ΚΑΙ `region` (όλη η αλυσίδα)', () => {
    const claims = table.claims.get('companyAddress');
    expect(claims.has('regionName')).toBe(true);
    expect(claims.has('region')).toBe(true);
  });

  it('Π4: το projectAddress διεκδικεί το `neighborhood` — από το επίπεδο `community` (§5)', () => {
    expect(table.claims.get('projectAddress').has('neighborhood')).toBe(true);
    const communityRow = table.rows.find(
      (r) => r.table === 'ADMIN_LEVEL_VOCABULARY' && r.row === 'community' && r.container === 'projectAddress',
    );
    expect(communityRow.names).toEqual(['neighborhood']);
    // …και ΟΧΙ από τη γραμμή `neighborhood`, που είναι εκεί σκόπιμα NOT_STORED:
    // ΕΝΑΣ ιδιοκτήτης ανά πεδίο (μάθημα Μ11 του ADR-772).
    const adjacentRow = table.rows.find(
      (r) => r.table === 'HIERARCHY_ADJACENT_VOCABULARY' && r.container === 'projectAddress',
    );
    expect(adjacentRow.names).toEqual([]);
  });

  it('Π5: διαβάζονται ΚΑΙ ΟΙ ΤΡΕΙΣ πίνακες — ταχυδρομικά και γειτονικά', () => {
    // `streetNumber` υπάρχει ΜΟΝΟ στο POSTAL_FIELD_VOCABULARY·
    // `neighborhood` του companyAddress ΜΟΝΟ στο HIERARCHY_ADJACENT_VOCABULARY.
    expect(table.claims.get('contactFlat').has('streetNumber')).toBe(true);
    expect(table.claims.get('companyAddress').has('neighborhood')).toBe(true);
  });

  it('Π6: το `AddressInfo` λύνεται ΜΕΣΑ από barrel (`@/types/contacts` → `./contracts`)', () => {
    const resolver = createResolver(REPO_ROOT);
    const container = table.containers.find((c) => c.key === 'addressInfo');
    const from = resolver.resolveFile(container.specifier, table.file);
    expect(from).toBe('src/types/contacts.ts');
    const hit = resolver.resolveType('AddressInfo', from);
    expect(hit.status).toBe('found');
    expect(hit.decl.file).toBe('src/types/contacts/contracts.ts');
  });

  it('Π7: το `CompanyAddress` παίρνει τα διοικητικά του από ΒΑΣΕΙΣ, όχι από δικά μέλη', () => {
    const resolver = createResolver(REPO_ROOT);
    const hit = resolver.resolveType('CompanyAddress', 'src/types/ContactFormTypes.ts');
    expect(hit.status).toBe('found');
    expect(hit.decl.members.map((m) => m.name)).not.toContain('settlementId');
    const { fields, unresolvedBases } = resolver.effectiveFields(hit.decl);
    expect(unresolvedBases).toEqual([]);
    expect(fields.map((f) => f.name)).toEqual(expect.arrayContaining(
      ['settlementId', 'municipalityId', 'communityName', 'majorGeoName'],
    ));
  });
});

// ─── Κ1..Κ6 — κοκκίωση και ΔΗΛΩΜΕΝΑ όρια ──────────────────────────────────────

describe('Κ1..Κ6 — τι ΔΕΝ πιάνει, γραμμένο', () => {
  const adminNames = adminFieldNames(['settlement', 'region', 'municipality']);

  it('Κ1: τρία ΟΝΟΜΑΤΑ χωρίς ταυτότητα δεν είναι λεξιλόγιο (σχήμα ContactAddressMapPreviewProps)', () => {
    expect(classifyVocabulary(['settlement', 'region', 'municipality'], adminNames).isVocabulary).toBe(false);
  });

  it('Κ2: δύο πεδία με δύο ταυτότητες δεν είναι λεξιλόγιο — το κατώφλι πεδίων μετράει κι αυτό', () => {
    expect(classifyVocabulary(['settlementId', 'regionId'], adminNames).isVocabulary).toBe(false);
  });

  it('Κ3: ο δείκτης παραγωγής διαβάζεται ΜΟΝΟ από το πρώτο μπλοκ σχολίων', () => {
    expect(isGeneratedSource('/** Auto-generated. */\nexport interface X {}')).toBe(true);
    expect(isGeneratedSource('export interface X {}\n/* @generated κάπου παρακάτω */')).toBe(false);
    expect(isGeneratedSource('/** Απλό σχόλιο. */\nexport interface X {}')).toBe(false);
  });

  it('Κ4: ΔΕΝ υπάρχει κατάσταση `orphan-mapping` — το `keyof` την κάνει αδύνατη', () => {
    // Ο πίνακας δείχνει σε πεδίο που ΔΕΝ υπάρχει πια: ο μεταγλωττιστής το σταματά
    // (`FieldChain<V> = keyof VocabularyContainers[V]`), άρα η πύλη μένει σιωπηλή
    // ΕΠΙΤΗΔΕΣ. Φρουρός που δεν μπορεί να πυροδοτήσει = ADR-749 §5, 606 αδρανείς.
    const m = run({
      'src/types/project/addresses.ts': (s) => s.replace('  decentAdmin?: string;', '  decentAdminXX?: string;'),
    }, {});
    expect(m.violations).toEqual([]);
  });

  it('Κ5: το Στρώμα 1 ΔΕΝ βλέπει έκτο λεξιλόγιο αλλού στο src/ — δηλωμένο όριο', () => {
    const rogue = {
      'src/services/rogue-address.ts': sixthVocabulary([
        'settlementId: string | null', 'municipalityId: string | null', 'region: string',
      ]),
    };
    expect(run({}, rogue, []).violations).toEqual([]);            // Στρώμα 1: τυφλό
    expect(newStates(run({}, rogue, ['--all']))).toEqual(['unregistered-vocabulary']); // Στρώμα 2: το βλέπει
  });

  it('Κ6: το Στρώμα 1 δεν αγγίζει ΠΟΤΕ τη baseline (απουσία ≠ πρόοδος)', () => {
    const prev = process.env.ADDRESS_VOCABULARY_BASELINE_FILE;
    process.env.ADDRESS_VOCABULARY_BASELINE_FILE = path.join(os.tmpdir(), 'δεν-υπάρχει-av42.json');
    try {
      expect(gate.runLayer1(['node', 'gate', 'src/types/ContactFormTypes.ts'])).toBe(0);
    } finally {
      if (prev === undefined) delete process.env.ADDRESS_VOCABULARY_BASELINE_FILE;
      else process.env.ADDRESS_VOCABULARY_BASELINE_FILE = prev;
    }
  });

  it('Κ6γ: άσχετο staged αρχείο ⇒ η πύλη ΠΑΡΑΛΕΙΠΕΤΑΙ, δεν «τρέχει και περνά»', () => {
    // Χωρίς αυτό, το φιλτράρισμα σκανδάλης θα μπορούσε να καταργηθεί και **κανένα test
    // δεν θα έπεφτε** (μετρημένο: η μετάλλαξη `touched = staged` επιβίωνε). Ένα βήμα
    // που κανείς δεν ελέγχει δεν είναι συμβόλαιο· είναι σχόλιο.
    const said = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...a) => said.push(a.join(' ')));
    try {
      expect(gate.runLayer1(['node', 'gate', 'src/app/page.tsx'])).toBe(0);
    } finally { spy.mockRestore(); }
    expect(said.join('\n')).toMatch(/κανένα δοχείο διεύθυνσης στα staged/);
  });

  it('Κ7: η ένωση ΤΩΝ ΤΡΙΩΝ πινάκων επιτρέπει μετακίνηση διεκδίκησης χωρίς ψευδές κόκκινο', () => {
    // Σήμερα κανένα ταχυδρομικό/γειτονικό όνομα δεν είναι ρίζα επιπέδου, άρα η ένωση
    // ΔΕΝ αλλάζει καμία ετυμηγορία — αυτό δηλώνεται. Γίνεται φορτίο μόλις μια διεκδίκηση
    // μετακινηθεί στον σωστό της πίνακα, που είναι ρεαλιστική μελλοντική πράξη:
    const m = run({
      [VOCABULARY_FILE]: (s) => s
        .replace("name: ['regionName', 'region']", "name: ['regionName']")
        .replace(
          '  street: {\n    form: [\'street\'],',
          "  region: {\n    form: ['regionName'],\n    projectAddress: ['region'],\n    companyAddress: ['region'],\n"
          + "    addressInfo: ['region'],\n    contactFlat: ['region'],\n  },\n  street: {\n    form: ['street'],",
        ),
    }, {});
    expect(m.violations).toEqual([]);
  });

  it('Κ6β: η σκανδάλη του Στρώματος 1 είναι ΠΑΡΑΓΟΜΕΝΗ, όχι χειρόγραφη λίστα', () => {
    const resolver = createResolver(REPO_ROOT);
    const inputs = gate.layer1Inputs(readVocabularyTable(REPO_ROOT), resolver, REPO_ROOT);
    for (const f of [
      VOCABULARY_FILE,
      'src/components/shared/addresses/address-with-hierarchy-config.ts',
      'src/types/project/addresses.ts',
      'src/types/ContactFormTypes.ts',      // δοχείο ΚΑΙ βάση δύο δοχείων
      'src/types/contacts/contracts.ts',
    ]) expect([...inputs]).toContain(f);
    expect([...inputs]).not.toContain('src/app/page.tsx');
  });
});

// ─── Πολιτική: ποιες καταστάσεις μπλοκάρουν με ποιον μηχανισμό ────────────────

describe('Πολιτική', () => {
  it('οι δύο μηχανισμοί είναι ξένοι μεταξύ τους και ονομαστικοί', () => {
    expect(ZERO_TOLERANCE_STATES).toEqual(['unmapped-administrative-field', 'unanalyzable-container']);
    expect(RATCHETED_STATES).toEqual(['unregistered-vocabulary']);
    for (const s of RATCHETED_STATES) expect(ZERO_TOLERANCE_STATES).not.toContain(s);
  });

  it('η baseline του δέντρου περιέχει ΜΟΝΟ ratchet-αρόμενες καταστάσεις', () => {
    const baseline = JSON.parse(fs.readFileSync(gate.baselineFile(), 'utf8'));
    for (const id of baseline.violations) {
      expect(RATCHETED_STATES).toContain(id.split('::')[0]);
    }
    expect(baseline.declarations).toEqual([]);
  });
});
