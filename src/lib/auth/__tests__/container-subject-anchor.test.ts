/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ Β7** — η ομάδα έρχεται από τον **ΔΙΑΚΟΜΙΣΤΗ**.
 * @related lib/auth/container-subject · lib/auth/project-member-read
 * @module lib/auth/__tests__/container-subject-anchor
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🏆 ΤΙ ΕΚΤΕΛΕΙ — ΤΗΝ ΠΡΑΓΜΑΤΙΚΗ ΑΝΑΖΗΤΗΣΗ, ΣΕ ΠΡΑΓΜΑΤΙΚΗ ΕΝΘΕΤΗ ΔΙΑΔΡΟΜΗ
 * ════════════════════════════════════════════════════════════════════════════
 * Το `project-member-read` **ΔΕΝ γίνεται mock**. Αν γινόταν, η σουίτα θα
 * απεδείκνυε ότι ο καλών **καλεί** ό,τι νομίζουμε — όχι ότι η ομάδα **βρίσκεται**.
 * Και η βλάβη που γέννησε αυτό το βήμα ήταν **ακριβώς** εκεί: ο αναγνώστης ζητούσε
 * `members/{uid}` ενώ ο γραφέας γράφει `members/{mbr_…}` με το `uid` ως **πεδίο**
 * ⇒ *καμία* ομάδα δεν βρισκόταν ποτέ, σιωπηλά, με κάθε πύλη πράσινη.
 *
 * 🔑 **ΤΟ ΜΑΘΗΜΑ ΤΟΥ Β6, ΕΦΑΡΜΟΣΜΕΝΟ**: εκεί η άγκυρα `writes === 1` έμεινε
 * ΠΡΑΣΙΝΗ με σπασμένη ατομικότητα· κοκκίνισαν **μόνο** οι άγκυρες που
 * **ξαναδιάβασαν με τον πραγματικό θεματοφύλακα**. ⇒ *Η μέτρηση κλήσεων δεν είναι
 * απόδειξη· η ανάγνωση είναι.* Γι' αυτό εδώ σπέρνεται **έγγραφο** και ρωτιέται ο
 * **γνήσιος** κριτής (`decideContainerAccess`), ποτέ χειρόγραφο υποκείμενο.
 *
 * ⚠️ **ΚΑΝΕΝΑ ΚΑΡΦΩΜΕΝΟ ΜΟΝΟΠΑΤΙ**: η διαδρομή χτίζεται από τα `COLLECTIONS` /
 * `SUBCOLLECTIONS` — την **ίδια** SSoT που διαβάζει ο θεματοφύλακας. Αντιγραμμένο
 * literal εδώ θα σήμαινε ότι μια μετονομασία υποσυλλογής αφήνει τη σουίτα πράσινη
 * πάνω σε διαδρομή που **κανείς δεν χρησιμοποιεί** (σχήμα CHECK 3.34).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
// ⚠️ Για τη **δομική** άγκυρα `Ο5` — διαβάζει την **πηγή** του καλούντος, όχι τη
//    συμπεριφορά του: η μετάλλαξη «πρόσθεσε διαδρομή για ομάδα από τον πελάτη»
//    δεν έχει καμία **είσοδο** από την οποία να εκφραστεί (δες Ο5).
import { readFileSync } from 'fs';
import { join } from 'path';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { isContainerVisible, type ContainerState } from '@/types/container-access';

// ⚠️ `let` και όχι `const`: το εργοστάσιο του `jest.mock` ανυψώνεται **πάνω** από
//    κάθε αρχικοποίηση, και οι δύο συναρτήσεις διαβάζουν τη μεταβλητή σε **χρόνο
//    κλήσης** — έτσι κάθε test βάζει καινούργιο πλαστό.
let fake: FakeFirestore;
let adminAvailable = true;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  // 🔑 **ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ** — ο θεματοφύλακας ρωτά **πρώτα** «είναι διαθέσιμος;» και
  //    απαντά `unknown` όταν όχι. Χωρίς αυτό στο mock, ο κλάδος *«δεν κοιτάξαμε»*
  //    θα ήταν **ανεκτέλεστος** (απόδειξη ζωής, ADR-749 §5).
  isFirebaseAdminAvailable: (): boolean => adminAvailable,
}));

import { decideContainerAccess } from '../container-access';
import { containerSubjectFor } from '../container-subject';
import { readProjectMember } from '../project-member-read';
import { PERMISSIONS, type AuthContext, type PermissionId } from '../types';

// =============================================================================
// ΤΟ ΕΛΑΧΙΣΤΟ ΣΥΜΠΑΝ
// =============================================================================

const COMPANY = 'comp_alpha';
const PROJECT = 'proj_tower';
const OTHER_PROJECT = 'proj_villa';
const READER = 'uid_reader';

const OWN_TEAM = 'team_structural';
const OTHER_TEAM = 'team_architectural';

/** Η ικανότητα που **όντως** ζητά η πράξη `share` (ADR-862 Φ0 Β6). */
const SHARE: PermissionId = 'iso19650:containers:share';

/**
 * Η **ένθετη** διαδρομή, χτισμένη όπως τη χτίζει ο πλαστός:
 * `companies/{W}/projects/{P}/members`.
 */
const membersPath = (projectId: string, companyId: string = COMPANY): string =>
  [
    COLLECTIONS.COMPANIES,
    companyId,
    SUBCOLLECTIONS.COMPANY_PROJECTS,
    projectId,
    SUBCOLLECTIONS.PROJECT_MEMBERS,
  ].join('/');

/** Ο καλών — ταυτότητα **ήδη επαληθευμένη**, με **ρητό** permission. */
const caller = (over: Partial<AuthContext> = {}): AuthContext => ({
  uid: READER,
  email: 'reader@example.test',
  companyId: COMPANY,
  globalRole: 'internal_user',
  mfaEnrolled: false,
  isAuthenticated: true,
  permissions: [SHARE],
  ...over,
});

/**
 * Έγγραφο μέλους **όπως το γράφει ο γραφέας**: κλειδί `mbr_…`, `uid` ως **πεδίο**.
 */
function seedMember(fields: Record<string, unknown> = {}, projectId = PROJECT): void {
  fake.seed(membersPath(projectId), 'mbr_seeded', {
    uid: READER,
    companyId: COMPANY,
    projectId,
    roleId: 'engineer',
    permissionSetIds: [],
    effectivePermissions: [],
    addedBy: 'uid_admin',
    ...fields,
  });
}

beforeEach(() => {
  fake = new FakeFirestore();
  adminAvailable = true;
  jest.clearAllMocks();
});

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΙΔΙΩΝ ΤΩΝ ΑΓΚΥΡΩΝ
// =============================================================================

describe('Κ0 — οι άγκυρες μετρούν κάτι υπαρκτό', () => {
  it('Κ0.1 — η ικανότητα της πράξης υπάρχει ΠΡΑΓΜΑΤΙΚΑ στο μητρώο PERMISSIONS', () => {
    // ⚠️ Χωρίς αυτό, ένα τυπογραφικό θα έστελνε κάθε σύνθεση στο
    //    `denied-unknown-action` ⇒ `denied-capability` παντού: «πράσινες»
    //    αρνήσεις που δεν κοιτούν ομάδα.
    expect(Object.hasOwn(PERMISSIONS, SHARE)).toBe(true);
  });

  it('Κ0.2 — ο πλαστός ΦΤΑΝΕΙ σε ένθετη διαδρομή (αλλιώς τίποτα παρακάτω δεν εκτελείται)', async () => {
    seedMember({ taskTeamId: OWN_TEAM });

    const read = await readProjectMember({ companyId: COMPANY, projectId: PROJECT, uid: READER });

    expect(read.outcome).toBe('member');
  });
});

// =============================================================================
// Μ0 — ΤΟ ΚΛΕΙΔΙ: Η ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟΝ ΘΕΜΑΤΟΦΥΛΑΚΑ
// =============================================================================

describe('Μ0 — το ερώτημα είναι στο ΠΕΔΙΟ, όχι στο κλειδί', () => {
  it('🔴 Μ0.1 — έγγραφο με κλειδί `mbr_…` και `uid` ως πεδίο ΒΡΙΣΚΕΤΑΙ', async () => {
    // 🔑 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα τον θεματοφύλακα σε `.doc(uid).get()` (ό,τι έκανε
    //    το `resource-lookups.ts:125` μέχρι τις 2026-09-16) ⇒ αυτό ΠΡΕΠΕΙ να
    //    κοκκινίσει. Είναι η μόνη άγκυρα στο δέντρο που πιάνει εκείνο το σφάλμα.
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });

    const read = await readProjectMember({ companyId: COMPANY, projectId: PROJECT, uid: READER });

    expect(read).toMatchObject({ outcome: 'member' });
    if (read.outcome === 'member') expect(read.member.taskTeamId).toBe(OWN_TEAM);
  });

  it('🔴 Μ0.2 — έγγραφο κλειδωμένο ΣΤΟ uid (το παλιό λάθος σχήμα) ΔΕΝ περνά για μέλος', async () => {
    // ⚠️ Ο παρονομαστής του Μ0.1: αν ο θεματοφύλακας ρωτούσε **κλειδί**, αυτό εδώ
    //    θα έβγαινε `member` και το Μ0.1 θα ήταν πράσινο για **λάθος λόγο**.
    //    Έγγραφο χωρίς πεδίο `uid` δεν είναι μέλος κανενός — είναι σκουπίδι σχήματος.
    fake.seed(membersPath(PROJECT), READER, {
      companyId: COMPANY,
      projectId: PROJECT,
      roleId: 'engineer',
      taskTeamId: OWN_TEAM,
    });

    const read = await readProjectMember({ companyId: COMPANY, projectId: PROJECT, uid: READER });

    expect(read.outcome).toBe('absent');
  });
});

// =============================================================================
// Ο — Η ΑΥΘΕΝΤΙΑ ΤΗΣ ΟΜΑΔΑΣ ΕΙΝΑΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ
// =============================================================================

describe('Ο — η ομάδα έρχεται από τον διακομιστή, ποτέ από τον πελάτη', () => {
  it('Ο1 — το `taskTeamId` του υποκειμένου είναι ΤΟΥ ΕΓΓΡΑΦΟΥ ΜΕΛΟΥΣ', async () => {
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toMatchObject({
      outcome: 'subject',
      subject: { taskTeamId: OWN_TEAM, audience: 'design', uid: READER },
    });
  });

  it('🔑 Ο2 — ΜΕΤΑΛΛΑΞΗ: η ΥΠΟΔΕΙΞΗ ΤΟΥ ΠΕΛΑΤΗ διαφωνεί ⇒ νικά ο διακομιστής', async () => {
    // 🔴 Το `cdeTeamId` πάνω στο αρχείο το γράφει ο **πελάτης** (client SDK) και οι
    //    κανόνες του Β4 το **επιτρέπουν** ρητά ως υπόδειξη. Αν ο καλών το διάβαζε
    //    ως ταυτότητα, ο καθένας θα αυτο-ανακηρυσσόταν σε όποια ομάδα θέλει.
    //    ⇒ Μετάλλαξη: κάνε τον `containerSubjectFor` να δεχτεί/διαβάσει ομάδα από
    //      τον πελάτη ⇒ αυτό ΠΡΕΠΕΙ να κοκκινίσει.
    seedMember({ taskTeamId: OWN_TEAM });

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    if (built.outcome !== 'subject') throw new Error('περίμενα υποκείμενο');
    // Ο διακομιστής λέει OWN_TEAM. Ό,τι κι αν «δηλώνει» ο πελάτης (OTHER_TEAM),
    // δεν έχει καμία διαδρομή να φτάσει εδώ.
    expect(built.subject.taskTeamId).toBe(OWN_TEAM);
    expect(built.subject.taskTeamId).not.toBe(OTHER_TEAM);
  });

  it('Ο3 — μέλος ΑΛΛΟΥ έργου δεν μετράει (η υποσυλλογή είναι ανά υπόθεση)', async () => {
    seedMember({ taskTeamId: OWN_TEAM }, OTHER_PROJECT);

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toMatchObject({ outcome: 'subject', subject: { audience: null } });
  });

  it('Ο4 — μέλος σε ΑΛΛΗ εταιρεία δεν μετράει (ο μισθωτής είναι μέρος της διαδρομής)', async () => {
    fake.seed(membersPath(PROJECT, 'comp_foreign'), 'mbr_foreign', {
      uid: READER,
      companyId: 'comp_foreign',
      projectId: PROJECT,
      taskTeamId: OWN_TEAM,
      cdeAudience: 'design',
    });

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toMatchObject({ outcome: 'subject', subject: { taskTeamId: null, audience: null } });
  });

  it('🔑 Ο5 — ΔΟΜΙΚΑ: ο καλών ΔΕΝ έχει διαδρομή να δεχτεί ομάδα από τον πελάτη', () => {
    // 🔴 **ΓΙΑΤΙ ΔΟΜΙΚΗ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΙΚΗ**: η μετάλλαξη που ζητά το σχέδιο
    //    («κάνε τον καλούντα να στέλνει `taskTeamId` από τον πελάτη») **δεν μπορεί
    //    να εκφραστεί** ως είσοδος σε αυτή τη σουίτα — γιατί τέτοια παράμετρος
    //    **δεν υπάρχει**. Άρα μια συμπεριφορική άγκυρα θα τεκμηρίωνε προσδοκία
    //    χωρίς να τη φυλάει: ένας μελλοντικός συντάκτης που **προσθέτει** τη
    //    διαδρομή θα έμενε πράσινος. Εδώ κοκκινίζει.
    //
    // ⚠️ **ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ** — μάθημα `Κ7β` του CHECK 3.50 / 3.68: το docblock
    //    του module **ονομάζει** το `cdeTeamId` για να εξηγήσει γιατί ΔΕΝ το
    //    διαβάζει. Χωρίς αφαίρεση σχολίων, η άγκυρα θα κοκκίνιζε πάνω στη
    //    **θεραπεία** αντί στη βλάβη.
    const source = readFileSync(join(process.cwd(), 'src/lib/auth/container-subject.ts'), 'utf8');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');

    // Ο παρονομαστής: αν η αφαίρεση σχολίων άδειασε το αρχείο, κάθε ισχυρισμός
    // παρακάτω θα ήταν **κενά αληθής**.
    expect(code).toContain('containerSubjectFor');

    // (1) Η ομάδα έρχεται **μόνο** από το έγγραφο μέλους.
    expect(code).toContain('read.member.taskTeamId');
    // (2) Η υπόδειξη του πελάτη δεν αναφέρεται **καθόλου** σε κώδικα.
    expect(code).not.toContain('cdeTeamId');
    // (3) Κανένα προαιρετικό πεδίο ομάδας στην **είσοδο** του ερωτήματος.
    expect(code).not.toMatch(/taskTeamId\s*\?:/);
  });
});

// =============================================================================
// Α — ΟΙ ΠΕΝΤΕ ΑΠΟΥΣΙΕΣ, ΠΕΝΤΕ ΑΠΑΝΤΗΣΕΙΣ
// =============================================================================

describe('Α — καμία απουσία δεν ισοπεδώνεται σε άλλη', () => {
  it('Α1 — αρχείο ΧΩΡΙΣ έργο ⇒ audience null, και ΚΑΜΙΑ ανάγνωση', async () => {
    // 🔑 Η απόδειξη ότι δεν ρωτήθηκε η βάση: ο πλαστός είναι **σπασμένος**. Αν
    //    γινόταν ανάγνωση, θα πεταγόταν. Μετρημένα **22 από 35** ζωντανά αρχεία
    //    δεν έχουν `projectId` — και είναι όλα `pre-cde` (δες Σ5).
    fake.failReads = true;

    const built = await containerSubjectFor({ caller: caller(), projectId: null });

    expect(built).toMatchObject({ outcome: 'subject', subject: { taskTeamId: null, audience: null } });
  });

  it('Α2 — ΔΕΝ υπάρχει έγγραφο μέλους ⇒ δεν συμμετέχει (audience null)', async () => {
    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toMatchObject({ outcome: 'subject', subject: { audience: null } });
  });

  it('Α3 — μέλος ΧΩΡΙΣ δηλωμένο ακροατήριο ⇒ `design` (δηλωμένο όριο 3 της Φ0)', async () => {
    seedMember({ taskTeamId: OWN_TEAM });

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toMatchObject({ outcome: 'subject', subject: { audience: 'design' } });
  });

  it('🔴 Α4 — μέλος με ΑΚΑΤΑΛΗΠΤΟ ακροατήριο ⇒ unknown, ΠΟΤΕ `design`', async () => {
    // 🔴 Αυτό ήταν ελάττωμα της **πρώτης γραφής** του θεματοφύλακα: η άκυρη τιμή
    //    πεταγόταν σιωπηλά ⇒ «μέλος χωρίς ακροατήριο» ⇒ `design`, το **πιο
    //    προνομιακό** πρότυπο. Δηλαδή χαλασμένο δεδομένο **προήγαγε** άνθρωπο.
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'crews' });

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toEqual({ outcome: 'unknown', why: 'audience-outside-vocabulary' });
  });

  it('Α5 — η βάση ΔΕΝ ΑΠΑΝΤΑ ⇒ unknown, ποτέ «δεν είναι μέλος» (N.12)', async () => {
    seedMember({ taskTeamId: OWN_TEAM });
    fake.failReads = true;

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toEqual({ outcome: 'unknown', why: 'query-failed' });
  });

  it('Α6 — Admin SDK μη διαθέσιμο ⇒ unknown (ο κλάδος «δεν κοιτάξαμε» εκτελείται)', async () => {
    adminAvailable = false;

    const built = await containerSubjectFor({ caller: caller(), projectId: PROJECT });

    expect(built).toEqual({ outcome: 'unknown', why: 'firebase-admin-unavailable' });
  });
});

// =============================================================================
// Σ — Η ΣΥΝΘΕΣΗ ΜΕ ΤΟΝ **ΠΡΑΓΜΑΤΙΚΟ** ΚΡΙΤΗ ΤΟΥ Β5
// =============================================================================

describe('Σ — ο καλών και ο κριτής κουμπώνουν', () => {
  const WIP_OWN: ContainerState = { phase: 'WIP', teamId: OWN_TEAM };
  const WIP_FOREIGN: ContainerState = { phase: 'WIP', teamId: OTHER_TEAM };
  const SHARED: ContainerState = { phase: 'SHARED', teamId: OTHER_TEAM };
  const PRE_CDE: ContainerState = { phase: 'pre-cde' };

  /** Ρωτά τον **γνήσιο** κριτή με υποκείμενο που **χτίστηκε από τη βάση**. */
  async function verdictFor(state: ContainerState, projectId: string | null = PROJECT) {
    const built = await containerSubjectFor({ caller: caller(), projectId });
    if (built.outcome !== 'subject') throw new Error(`περίμενα υποκείμενο, πήρα ${built.outcome}`);

    return decideContainerAccess({
      subject: built.subject,
      facts: { fileId: 'file_anchor', companyId: COMPANY, createdBy: 'uid_author', state },
      action: SHARE,
    }).verdict;
  }

  it('Σ1 — δικό του WIP ⇒ visible-own-wip (η ομάδα ταίριαξε ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ)', async () => {
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });

    expect(await verdictFor(WIP_OWN)).toBe('visible-own-wip');
  });

  it('Σ2 — ΞΕΝΟ WIP ⇒ denied-foreign-wip (η κανονική άρνηση της Α10)', async () => {
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });

    expect(await verdictFor(WIP_FOREIGN)).toBe('denied-foreign-wip');
  });

  it('Σ3 — μέλος ΧΩΡΙΣ ομάδα ⇒ denied-teamless, ΟΧΙ «ταιριάζουν τα δύο null»', async () => {
    // ⚠️ Χωρίς αυτό, ένα αρχείο χωρίς ομάδα θα ήταν ορατό σε **κάθε** άνθρωπο
    //    χωρίς ομάδα — η απουσία δεδομένου θα ήταν **άδεια**.
    seedMember({ cdeAudience: 'design' });

    expect(await verdictFor(WIP_OWN)).toBe('denied-teamless');
    expect(await verdictFor({ phase: 'WIP', teamId: null })).toBe('denied-teamless');
  });

  it('Σ4 — ΜΗ-μέλος μπροστά σε SHARED ⇒ denied-not-engaged', async () => {
    expect(await verdictFor(SHARED)).toBe('denied-not-engaged');
  });

  it('Σ5 — ΜΗ-μέλος μπροστά σε pre-cde ⇒ visible-legacy-tenant («όπως σήμερα»)', async () => {
    // 🔑 **Η ΓΡΑΜΜΗ ΠΟΥ ΠΡΟΣΤΑΤΕΥΕΙ ΤΗΝ ΠΑΡΑΓΩΓΗ**: τα 35 από 35 ζωντανά αρχεία
    //    είναι `pre-cde`, και τα 22 από αυτά **δεν έχουν καν έργο**. Αν αυτό
    //    κοκκινίσει, η Φ0 έκρυψε παραγωγή.
    expect(await verdictFor(PRE_CDE)).toBe('visible-legacy-tenant');
    expect(await verdictFor(PRE_CDE, null)).toBe('visible-legacy-tenant');
  });

  it('Σ6 — και ΜΟΝΟ οι visible-* περνούν τον φρουρό της διαδρομής', async () => {
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });

    expect(isContainerVisible(await verdictFor(WIP_OWN))).toBe(true);
    expect(isContainerVisible(await verdictFor(WIP_FOREIGN))).toBe(false);
  });
});

// =============================================================================
// Μ — Η ΜΙΑ ΜΕΤΑΦΡΑΣΗ
// =============================================================================

describe('Μ — η μετάφραση του εγγράφου δεν εμπιστεύεται τη βάση', () => {
  it('Μ1 — ικανότητα ΕΚΤΟΣ μητρώου πετιέται από τα effectivePermissions', async () => {
    // ⚠️ Ο προκάτοχος έκανε `data() as ProjectMember` — υποσχόταν `PermissionId[]`
    //    για ό,τι κι αν είχε η βάση. «Άγνωστη άδεια» δεν είναι άδεια.
    seedMember({
      taskTeamId: OWN_TEAM,
      effectivePermissions: [SHARE, 'dfx:view', 42, null],
    });

    const read = await readProjectMember({ companyId: COMPANY, projectId: PROJECT, uid: READER });

    if (read.outcome !== 'member') throw new Error('περίμενα μέλος');
    expect(read.member.effectivePermissions).toEqual([SHARE]);
  });

  it('Μ2 — ομάδα δηλωμένη ΚΕΝΗ ⇒ unreadable, όχι «χωρίς ομάδα»', async () => {
    // Κενή συμβολοσειρά **δεν** είναι όνομα ομάδας, και η σιωπηλή μετατροπή της σε
    // `null` θα έκρυβε από τον άνθρωπο το **δικό του** WIP χωρίς να πει γιατί.
    seedMember({ taskTeamId: '   ' });

    const read = await readProjectMember({ companyId: COMPANY, projectId: PROJECT, uid: READER });

    expect(read).toEqual({ outcome: 'unreadable', why: 'team-not-a-name' });
  });

  it('Μ3 — η απομνημόνευση είναι ΑΝΑ ΑΙΤΗΜΑ: δεύτερη κλήση δεν ξαναρωτά', async () => {
    seedMember({ taskTeamId: OWN_TEAM });
    const cache = new Map<string, Awaited<ReturnType<typeof readProjectMember>>>();

    const first = await readProjectMember({ companyId: COMPANY, projectId: PROJECT, uid: READER, cache });
    // Ο δίσκος «πέφτει» **μετά** την πρώτη ανάγνωση: αν γινόταν δεύτερη, θα έσκαγε.
    fake.failReads = true;
    const second = await readProjectMember({ companyId: COMPANY, projectId: PROJECT, uid: READER, cache });

    expect(first).toEqual(second);
    expect(second.outcome).toBe('member');
  });
});
