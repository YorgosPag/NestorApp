/**
 * @jest-environment node
 *
 * =============================================================================
 * 🔴 Η ΚΥΡΙΑ ΑΓΚΥΡΑ ΤΟΥ Β8 — **ΤΑ BYTES** (ADR-862 Φ0)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Εκτελείται ο φρουρός ορατότητας **πριν** φύγει έστω ένα byte —
 * σε **κάθε** διαδρομή, και όχι επειδή κάποιος θυμήθηκε να τον καλέσει;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙΠΟΤΑ ΔΕΝ ΕΙΝΑΙ MOCKED ΕΚΤΟΣ ΤΟΥ ΔΙΣΚΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κριτής του Β5, ο καλών του Β7 και ο θεματοφύλακας του Β1 **εκτελούνται
 * αληθινά**. Πλαστό είναι **μόνο** ο δίσκος (`FakeFirestore`) και το bucket.
 *
 * ⚠️ Αν γινόταν mock ο φρουρός, η σουίτα θα απεδείκνυε ότι η αλυσίδα **καλεί** ό,τι
 * νομίζουμε — **όχι** ότι το «όχι» φτάνει πριν τα bytes. Είναι το μάθημα του Β6:
 * *η μέτρηση κλήσεων δεν είναι απόδειξη· η ανάγνωση είναι.*
 *
 * 🔴 **Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΑ BYTES ΔΕΝ ΕΦΥΓΑΝ ΕΙΝΑΙ Ο ΜΕΤΡΗΤΗΣ `downloads`**: δεν
 * αρκεί να δούμε `refused` — πρέπει να δούμε ότι το bucket **δεν αγγίχθηκε καν**.
 * Ένας φρουρός που απαντά «όχι» **αφού** κατέβασε είναι ακριβώς η βλάβη που ο
 * κοινός βοηθός υπάρχει για να κάνει δομικά αδύνατη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 📐 ΒΑΘΜΟΝΟΜΗΣΗ — ΖΩΝΤΑΝΗ ΒΑΣΗ, 2026-09-16
 * ─────────────────────────────────────────────────────────────────────────────
 * | μέτρηση | τιμή | τι σημαίνει εδώ |
 * |---|---|---|
 * | σύνολο `files` | **35** | ο παρονομαστής |
 * | `cdeState` = WIP·SHARED·PUBLISHED | **0·0·0** | καμία κατάσταση δεν είναι ζωντανή |
 * | αρχεία σε `pre-cde` | **35 / 35** | 🔴 **αν η ομάδα `Π` κοκκινίσει, η Φ0 έκρυψε ΟΛΗ την παραγωγή** |
 * | χωρίς `projectId` | **22 / 35** | δεν είναι δοχεία υπόθεσης — και πρέπει να κατεβαίνουν |
 *
 * @see app/api/files/_shared/owned-file-bytes — η αλυσίδα
 * @see lib/auth/container-visibility-guard — ο φρουρός ορατότητας
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

// ⚠️ `let` και όχι `const`: το εργοστάσιο του `jest.mock` ανυψώνεται **πάνω** από
//    κάθε αρχικοποίηση, και οι συναρτήσεις διαβάζουν τη μεταβλητή σε **χρόνο κλήσης**.
let fake: FakeFirestore;
let adminAvailable = true;
/** 🔑 **Ο μετρητής που αποδεικνύει ότι τα bytes δεν έφυγαν.** */
let downloads: string[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  isFirebaseAdminAvailable: (): boolean => adminAvailable,
  getAdminBucket: () => ({
    name: 'bucket-under-test',
    file: (path: string) => ({
      download: async (): Promise<[Buffer]> => {
        downloads.push(path);
        return [Buffer.from('BYTES')];
      },
    }),
  }),
}));

import { loadOwnedFileBytes } from '../owned-file-bytes';

// =============================================================================
// ΤΟ ΕΛΑΧΙΣΤΟ ΣΥΜΠΑΝ
// =============================================================================

const COMPANY = 'comp_alpha';
const PROJECT = 'proj_tower';
const READER = 'uid_reader';
const AUTHOR = 'uid_author';
const OWN_TEAM = 'team_structural';
const OTHER_TEAM = 'team_architectural';
const FILE_ID = 'file_anchor';
const VIEW = 'dxf:files:view' as const;

/** Το **ελάχιστο έγκυρο** έγγραφο — ό,τι απαιτεί ο φρουρός σχήματος `isFileRecord`. */
const BASE_DOC: Record<string, unknown> = {
  id: FILE_ID,
  entityType: 'project',
  entityId: PROJECT,
  domain: 'construction',
  category: 'floorplans',
  storagePath: `companies/${COMPANY}/files/${FILE_ID}.pdf`,
  displayName: 'Κάτοψη Ισογείου',
  originalFilename: 'katopsi.pdf',
  ext: 'pdf',
  contentType: 'application/pdf',
  status: 'ready',
  createdBy: AUTHOR,
  companyId: COMPANY,
  revision: 3,
};

/** Ταυτότητα **ήδη επαληθευμένη**, με **ρητό** permission. */
const caller = (over: Record<string, unknown> = {}) =>
  ({
    uid: READER,
    email: 'reader@example.test',
    companyId: COMPANY,
    globalRole: 'internal_user',
    mfaEnrolled: false,
    isAuthenticated: true,
    permissions: [VIEW],
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

function seedFile(fields: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.FILES, FILE_ID, { ...BASE_DOC, ...fields });
}

function seedMember(fields: Record<string, unknown> = {}): void {
  const path = [
    COLLECTIONS.COMPANIES,
    COMPANY,
    SUBCOLLECTIONS.COMPANY_PROJECTS,
    PROJECT,
    SUBCOLLECTIONS.PROJECT_MEMBERS,
  ].join('/');

  fake.seed(path, 'mbr_seeded', {
    uid: READER,
    companyId: COMPANY,
    projectId: PROJECT,
    roleId: 'engineer',
    effectivePermissions: [],
    addedBy: 'uid_admin',
    ...fields,
  });
}

const load = () =>
  loadOwnedFileBytes({
    fileId: FILE_ID,
    caller: caller(),
    action: 'download',
    capability: VIEW,
  });

beforeEach(() => {
  fake = new FakeFirestore();
  adminAvailable = true;
  downloads = [];
  jest.clearAllMocks();
});

// =============================================================================
// Κ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Κ0 — η αλυσίδα εκτελείται πράγματι', () => {
  it('Κ0.1 — έγκυρο έγγραφο χωρίς έργο ⇒ bytes (αλλιώς κάθε άρνηση παρακάτω είναι κενή)', async () => {
    seedFile();

    const result = await load();

    expect(result.outcome).toBe('bytes');
    expect(downloads).toHaveLength(1);
  });
});

// =============================================================================
// Π — 🔴 Η ΠΑΡΑΓΩΓΗ: 35 ΑΠΟ 35 ΑΡΧΕΙΑ ΕΙΝΑΙ `pre-cde`
// =============================================================================

describe('Π — καμία υπάρχουσα λήψη δεν σπάει', () => {
  it('🔴 Π1 — `pre-cde` ΧΩΡΙΣ έργο ⇒ bytes (τα 22 από 35)', async () => {
    seedFile({ projectId: undefined });

    expect((await load()).outcome).toBe('bytes');
  });

  it('🔴 Π2 — `pre-cde` ΜΕ έργο, χωρίς έγγραφο μέλους ⇒ bytes («όπως σήμερα»)', async () => {
    // 🔑 Ο μη-μέλος μπροστά σε `pre-cde` παίρνει `visible-legacy-tenant`. Αν αυτό
    //    κοκκινίσει, η Φ0 έκρυψε αρχεία που σήμερα **φαίνονται**.
    seedFile({ projectId: PROJECT });

    expect((await load()).outcome).toBe('bytes');
  });

  it('Π3 — το όνομα παράγεται ΑΠΟ ΤΟ ΕΓΓΡΑΦΟ, ποτέ από το αίτημα', async () => {
    seedFile();

    const result = await load();

    if (result.outcome !== 'bytes') throw new Error('περίμενα bytes');
    expect(result.filename).toBe('Κάτοψη Ισογείου.pdf');
  });
});

// =============================================================================
// Ξ — 🔴 ΤΟ ΚΛΕΙΔΙ: ΞΕΝΟ WIP ⇒ ΚΑΝΕΝΑ BYTE
// =============================================================================

describe('Ξ — ο φρουρός ορατότητας κόβει ΠΡΙΝ τα bytes', () => {
  it('🔑 Ξ1 — ΞΕΝΟ WIP ⇒ refused, και το bucket ΔΕΝ ΑΓΓΙΧΤΗΚΕ ΚΑΝ', async () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: αφαίρεσε την κλήση `containerVisibilityRefusal` από τον
    //    βοηθό ⇒ αυτό κοκκινίζει **δύο φορές** (και στο `outcome` και στον μετρητή).
    //    Ο μετρητής είναι που πιάνει τη **σειρά**: φρουρός που απαντά «όχι» αφού
    //    κατέβασε, απαντά σωστά και έχει ήδη διαρρεύσει.
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });
    seedFile({ projectId: PROJECT, cdeState: 'WIP', cdeTeamId: OTHER_TEAM });

    const result = await load();

    expect(result.outcome).toBe('refused');
    expect(downloads).toEqual([]);
  });

  it('Ξ2 — ΔΙΚΟ του WIP ⇒ bytes (ο παρονομαστής του Ξ1)', async () => {
    // ⚠️ Χωρίς αυτό, το Ξ1 θα ήταν πράσινο ακόμη κι αν ο φρουρός αρνιόταν **τα πάντα**.
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });
    seedFile({ projectId: PROJECT, cdeState: 'WIP', cdeTeamId: OWN_TEAM });

    expect((await load()).outcome).toBe('bytes');
  });

  it('Ξ3 — ΣΥΝΕΡΓΕΙΟ μπροστά σε SHARED ⇒ refused, κανένα byte', async () => {
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'crew' });
    seedFile({
      projectId: PROJECT,
      cdeState: 'SHARED',
      cdeTeamId: OWN_TEAM,
      cdeShare: { by: AUTHOR, at: '2026-09-16T10:00:00.000Z', revision: 3 },
    });

    expect((await load()).outcome).toBe('refused');
    expect(downloads).toEqual([]);
  });

  it('🔴 Ξ4 — ΧΕΙΡΟΓΡΑΦΟ `PUBLISHED` χωρίς σφραγίδα ⇒ refused (η δεύτερη αλήθεια δεν πληρώνει)', async () => {
    seedMember({ taskTeamId: OWN_TEAM, cdeAudience: 'design' });
    seedFile({ projectId: PROJECT, cdeState: 'PUBLISHED', cdeTeamId: OWN_TEAM });

    expect((await load()).outcome).toBe('refused');
    expect(downloads).toEqual([]);
  });
});

// =============================================================================
// Α — ΟΙ ΑΠΟΥΣΙΕΣ, ΞΕΧΩΡΙΣΤΑ
// =============================================================================

describe('Α — τρεις εκβάσεις, ποτέ δύο', () => {
  it('Α1 — ΞΕΝΟΣ μισθωτής ⇒ refused, κανένα byte', async () => {
    seedFile({ companyId: 'comp_foreign' });

    expect((await load()).outcome).toBe('refused');
    expect(downloads).toEqual([]);
  });

  it('Α2 — ΑΝΥΠΑΡΚΤΟ έγγραφο ⇒ refused', async () => {
    expect((await load()).outcome).toBe('refused');
    expect(downloads).toEqual([]);
  });

  it('🔑 Α3 — η ΑΥΘΕΝΤΙΑ δεν απάντησε ⇒ unavailable, ΠΟΤΕ refused (N.12)', async () => {
    // 🔴 *Άγνωστο ≠ κενό*: ισοπέδωση εδώ θα έλεγε στον μηχανικό «δεν συμμετέχεις»
    //    επειδή **έπεσε το δίκτυο**, και θα τον έστελνε να ζητήσει δικαιώματα που έχει.
    seedFile({ projectId: PROJECT, cdeState: 'WIP', cdeTeamId: OWN_TEAM });
    adminAvailable = false;

    expect((await load()).outcome).toBe('unavailable');
    expect(downloads).toEqual([]);
  });

  it('Α4 — ΔΙΑΓΡΑΜΜΕΝΟ ⇒ refused, κανένα byte', async () => {
    seedFile({ isDeleted: true });

    expect((await load()).outcome).toBe('refused');
    expect(downloads).toEqual([]);
  });

  it('Α5 — ΧΩΡΙΣ `storagePath` ⇒ refused, ποτέ ρίψη', async () => {
    seedFile({ storagePath: '' });

    expect((await load()).outcome).toBe('refused');
  });
});

// =============================================================================
// Δ — 🔴 ΔΟΜΙΚΑ: ΚΑΘΕ ΔΙΑΔΡΟΜΗ BYTES ΠΕΡΝΑ ΑΠΟ ΤΗΝ **ΙΔΙΑ** ΑΛΥΣΙΔΑ
// =============================================================================

describe('Δ — καμία διαδρομή δεν γράφει δική της αλυσίδα', () => {
  /** Οι διαδρομές που σερβίρουν bytes **από `fileId`** — το κλειστό σύνολο του Β8. */
  const ID_ROUTES: readonly string[] = [
    'src/app/api/files/[fileId]/download/route.ts',
    'src/app/api/files/batch-download/route.ts',
    'src/app/api/download/route.ts',
  ];

  const codeOf = (path: string): string =>
    readFileSync(join(process.cwd(), path), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');

  it('🔑 Δ1 — ΜΕΤΑΛΛΑΞΗ: αφαίρεσε τον βοηθό από ΜΙΑ διαδρομή ⇒ ΚΟΚΚΙΝΟ, ονομαστικά', () => {
    const missing = ID_ROUTES.filter(route => !codeOf(route).includes('loadOwnedFileBytes'));

    expect(missing).toEqual([]);
  });

  it('🔑 Δ2 — καμία διαδρομή bytes δεν κατεβάζει ΜΟΝΗ της από το bucket', () => {
    // 🔴 Η **σειρά** είναι ο κίνδυνος, όχι οι γραμμές: αντίγραφο που κατεβάζει και
    //    ρωτά «το βλέπω;» μετά **δουλεύει** — απλώς έχει ήδη διαβάσει ξένα bytes.
    //    Ένα `getAdminBucket().file(...).download()` σε αρχείο διαδρομής **που
    //    δέχεται fileId** είναι ακριβώς αυτό.
    const offenders = ID_ROUTES.filter(route =>
      /getAdminBucket\(\)\s*\.\s*file\s*\(/.test(codeOf(route)),
    );

    expect(offenders).toEqual([]);
  });
});
