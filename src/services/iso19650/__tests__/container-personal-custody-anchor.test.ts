/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α34** — «ο ΕΝΑΣ γραφέας δέχεται και το διαμέρισμα `files_personal`»
 *   (ADR-866 Ε-Φ0-1 · §2.6.10 · ADR-862 §5.3.7).
 * @related services/iso19650/container-transitions · container-regime-policy · container-custody ·
 *   container-succession-policy · version-stack · version-promotion-policy · lib/workspace/custody-scope
 * @module services/iso19650/__tests__/container-personal-custody-anchor
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ΤΙ ΚΛΕΙΔΩΝΕΙ — *«εκδόσεις ΝΑΙ, φάσεις CDE ΟΧΙ»*
 * ════════════════════════════════════════════════════════════════════════════
 *   Α34.1  προσωπικό `supersede` γράφει **ΜΟΝΟ** πεδία διαδοχής — **κανένα** κλειδί του
 *          `cdeCustodyKeys()`, και ο **πραγματικός** αναγνώστης λέει `pre-cde`
 *   Α34.2  `share` · `seal` · `withdraw` σε προσωπικό ⇒ **ονομασμένη** `no-project`, **μηδέν** γραφές
 *   Α34.2β `release` κόβεται **νωρίτερα**, από τη **φάση** (`wrong-phase`) — μετρημένο, και σωστό
 *   Α34.3  ο γραφέας γράφει στη **σωστή συλλογή**: το εταιρικό διαμέρισμα μένει **ανέγγιχτο**
 *   Α34.4  🔴 **ΞΕΝΟΣ ΑΝΘΡΩΠΟΣ** ⇒ `tenant-mismatch`, μηδέν γραφές — και **ξένο διαμέρισμα** το ίδιο
 *   Α34.5  ο διάδοχος **δεν** αναζητείται στο άλλο διαμέρισμα ⇒ `successor-not-found`
 *   Α34.6  ο διάδοχος του **προβιβασμού** γεννιέται από το overload **ανθρώπου**: κανένα
 *          `companyId`, κανένα πεδίο CDE, ρίζα Storage `people/{uid}`
 *   Α34.7  ο **σπόρος** του διαδόχου κλειδώνει σε **κλειδί κατόχου** — εταιρεία και άνθρωπος με
 *          ίδιο id δεν παράγουν ποτέ τον ίδιο διάδοχο
 *   Α34.8  η **στοίβα** διαβάζει το προσωπικό διαμέρισμα και **δεν διασχίζει** διαμερίσματα
 *   Α34.9  **καμία** γραμμή στο εταιρικό ημερολόγιο για προσωπική πράξη (2β.4 — δηλωμένη σιωπή)
 *   Α34.10 το καθεστώς του ανθρώπου έχει **δικό του** όνομα (`personal-custody`), όχι δανεικό
 *   Α34.10β η `custodyOnEntry` **λέει** αυτό το όνομα — και **δεν διαβάζει** αλυσίδα έργου
 *
 * ⚠️ Ο αναγνώστης (`file-record-read`), η στοίβα (`version-stack`) και ο κριτής διαδοχής **δεν**
 * γίνονται mock: αν κάποιος από αυτούς πάψει να ρωτά τον κάτοχο, αυτό το αρχείο κοκκινίζει.
 *
 * 🔑 **Οι δύο ταυτότητες είναι διαφορετικές επίτηδες** (`u_person` ≠ `c_alpha`): έτσι ένα
 * διαμέρισμα που διαβάζει κατά λάθος το άλλο δεν μπορεί να βγει πράσινο από σύμπτωση.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readContainerState } from '@/lib/files/file-record-read';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));

jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));

import { recordFileAudit } from '@/services/file-audit-admin.service';
import { personalContainerActorOf, transitionContainer } from '../container-transitions';
import { readVersionStack } from '../version-stack';
import { PERSONAL_REGIME, regimeRefusal } from '../container-regime-policy';
import { custodyOnEntry } from '../container-custody';
import { promotionSeed, successorBuilderInput } from '../version-promotion-policy';
import { ACT_SPEC } from '../container-transition-policy';
import type { ContainerAct } from '../container-transition-vocabulary';
import { buildPendingFileRecordData } from '@/services/file-record/file-record-core';
import type { FileRecord } from '@/types/file-record';

const PREV = 'file_prev';
const NEXT = 'file_next';
const PERSON = 'u_person';
const STRANGER = 'u_stranger';
const COMPANY = 'c_alpha';

const PERSONAL = COLLECTIONS[FILE_COLLECTION.personal];
const COMPANY_FILES = COLLECTIONS[FILE_COLLECTION.company];

/** Ο φάκελος ακινήτου του ιδιώτη — οντότητα **χωρίς** έργο, όπως κάθε προσωπικό αρχείο. */
const SLOT = {
  entityType: 'owner_property',
  entityId: 'op_1',
  domain: 'legal',
  category: 'contracts',
  purpose: 'ownership-title',
} as const;

/** 🔑 **Καμία ικανότητα, κανένας ρόλος** — στον προσωπικό χώρο η εξουσία είναι η ιδιοκτησία. */
const owner = personalContainerActorOf(PERSON);

/**
 * Η λίστα του `cdeCustodyKeys()` (`firestore.rules`) **χωρίς** τα δύο ουδέτερα πεδία διαδοχής:
 * ο κανόνας τα φυλάει από τον **πελάτη**, αλλά ο ΕΝΑΣ γραφέας **οφείλει** να τα γράψει — αυτά
 * *είναι* η απόδειξη της διαδοχής. Ό,τι μένει εδώ δεν επιτρέπεται να αγγιχτεί ποτέ σε προσωπικό.
 */
const FORBIDDEN_CDE_KEYS = [
  'cdeState', 'cdeTeamId', 'cdeShare', 'cdeSeal', 'cdeRelease', 'cdeWithdrawal',
  'cdeSupersession', 'cdeReadReach', 'suitabilityCode', 'projectId',
];

function personalDoc(id: string, createdAt: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, userId: PERSON, createdBy: PERSON, status: 'ready', lifecycleState: 'active',
    isDeleted: false, createdAt, ...SLOT,
    displayName: id, originalFilename: `${id}.pdf`, ext: 'pdf', contentType: 'application/pdf',
    storagePath: `people/${PERSON}/entities/owner_property/op_1/domains/legal/contracts/files/${id}.pdf`,
    ...extra,
  };
}

function seedPair(prev: Record<string, unknown> = {}, next: Record<string, unknown> = {}): void {
  fake.seed(PERSONAL, PREV, personalDoc(PREV, '2026-09-01T10:00:00.000Z', prev));
  fake.seed(PERSONAL, NEXT, personalDoc(NEXT, '2026-09-17T10:00:00.000Z', next));
}

const storedIn = (collection: string, id: string): Record<string, unknown> =>
  fake.all<Record<string, unknown>>(collection).find((doc) => doc.id === id) ?? {};

const supersede = (actor = owner) =>
  transitionContainer({ fileId: PREV, act: 'supersede', actor, supersededByFileId: NEXT });

beforeEach(() => {
  fake = new FakeFirestore();
  jest.clearAllMocks();
});

describe('Α34 — ο προσωπικός χώρος: εκδόσεις ΝΑΙ, φάσεις ΟΧΙ', () => {
  it('✅ Α34.1 — supersede γράφει ΜΟΝΟ διαδοχή· κανένα cde*, ο αναγνώστης λέει pre-cde', async () => {
    seedPair();

    const outcome = await supersede();

    expect(outcome).toEqual({ kind: 'succeeded', fileId: PREV, act: 'supersede', supersededByFileId: NEXT });
    const prev = storedIn(PERSONAL, PREV);
    expect(prev).toMatchObject({
      supersededByFileId: NEXT, lifecycleState: 'archived', archivedBy: PERSON, userId: PERSON,
    });
    // 🔴 Η ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ: γραφή `cdeState` σε προσωπικό αρχείο.
    for (const key of FORBIDDEN_CDE_KEYS) expect(prev).not.toHaveProperty(key);
    expect(prev).not.toHaveProperty('companyId');
    // Αρχείο, ποτέ κάδος (UK BIM Part C §6.3) — άρα δομικά εκτός οριστικής διαγραφής.
    expect(prev.isDeleted).toBe(false);
    expect(prev).not.toHaveProperty('purgeAt');
    expect(readContainerState(prev)).toEqual({ phase: 'pre-cde' });
  });

  it.each<ContainerAct>(['share', 'seal', 'withdraw'])(
    '🔴 Α34.2 — %s σε προσωπικό ⇒ no-project, μηδέν γραφές',
    async (act) => {
      seedPair();
      const before = fake.writes;

      const outcome = await transitionContainer({ fileId: PREV, act, actor: owner });

      expect(outcome).toEqual({ kind: 'refused', fileId: PREV, act, why: 'no-project' });
      expect(fake.writes - before).toBe(0);
      for (const key of FORBIDDEN_CDE_KEYS) expect(storedIn(PERSONAL, PREV)).not.toHaveProperty(key);
    },
  );

  /**
   * 🔑 **Η ΑΠΕΛΕΥΘΕΡΩΣΗ ΚΟΒΕΤΑΙ ΝΩΡΙΤΕΡΑ — ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ** (μετρημένο, ADR-866 §2.6.10).
   *
   * Η σειρά του γραφέα είναι συμβόλαιο: η **φάση** κρίνεται (βήμα 6, `judgeTransition`) **πριν**
   * το καθεστώς (βήμα 7, `custodyOnEntry` → `regimeRefusal`), γιατί το πρώτο είναι καθαρό και το
   * δεύτερο θέλει αναγνώσεις. Το `ACT_SPEC.release.from` **δεν** δέχεται `pre-cde`: *«χωρίς
   * σφραγίδα δεν υπάρχει τίποτα να απελευθερωθεί»*. Άρα ο ιδιώτης παίρνει `wrong-phase`, που
   * είναι **πιο συγκεκριμένο** από το `no-project` — και ταυτόσημο με ό,τι παίρνει εταιρικό
   * αρχείο σε ίδια φάση. ⛔ **ΜΗΝ** «διορθώσεις» τη σειρά για να βγει `no-project`: θα έκανε
   * κάθε πράξη φάσης να πληρώνει ανάγνωση αλυσίδας έργου **πριν** μάθει ότι δεν έχει νόημα.
   */
  it('🔴 Α34.2β — release σε προσωπικό ⇒ wrong-phase (κόβεται από τη ΦΑΣΗ, πριν το καθεστώς)', async () => {
    seedPair();
    const before = fake.writes;

    const outcome = await transitionContainer({ fileId: PREV, act: 'release', actor: owner });

    expect(outcome).toEqual({ kind: 'refused', fileId: PREV, act: 'release', why: 'wrong-phase' });
    expect(fake.writes - before).toBe(0);
    for (const key of FORBIDDEN_CDE_KEYS) expect(storedIn(PERSONAL, PREV)).not.toHaveProperty(key);
  });

  it('✅ Α34.3 — γράφει στη ΣΩΣΤΗ συλλογή· το εταιρικό διαμέρισμα μένει ανέγγιχτο', async () => {
    seedPair();
    // Ομώνυμο εταιρικό αρχείο: αν ο γραφέας διάβαζε λάθος συλλογή, θα το χτυπούσε.
    fake.seed(COMPANY_FILES, PREV, { id: PREV, companyId: COMPANY, createdBy: 'u_other' });

    await supersede();

    expect(storedIn(PERSONAL, PREV)).toMatchObject({ supersededByFileId: NEXT });
    expect(storedIn(COMPANY_FILES, PREV)).not.toHaveProperty('supersededByFileId');
    expect(storedIn(COMPANY_FILES, PREV)).toMatchObject({ createdBy: 'u_other' });
  });

  it('🔴 Α34.4 — ΞΕΝΟΣ άνθρωπος ⇒ tenant-mismatch, μηδέν γραφές', async () => {
    seedPair();
    const before = fake.writes;

    const outcome = await supersede(personalContainerActorOf(STRANGER));

    expect(outcome).toEqual({ kind: 'refused', fileId: PREV, act: 'supersede', why: 'tenant-mismatch' });
    expect(fake.writes - before).toBe(0);
  });

  it('🔴 Α34.4β — έγγραφο ΕΤΑΙΡΕΙΑΣ δεν αγγίζεται από ανθρώπινο δράστη', async () => {
    // Ίδιο id στο προσωπικό διαμέρισμα, αλλά με πεδία **εταιρείας** — «κανενός» για το σύνορο.
    fake.seed(PERSONAL, PREV, { ...personalDoc(PREV, '2026-09-01T10:00:00.000Z'), userId: undefined, companyId: COMPANY });
    fake.seed(PERSONAL, NEXT, personalDoc(NEXT, '2026-09-17T10:00:00.000Z'));

    expect(await supersede()).toMatchObject({ kind: 'refused', why: 'tenant-mismatch' });
  });

  it('🔴 Α34.5 — ο διάδοχος ΔΕΝ αναζητείται στο άλλο διαμέρισμα', async () => {
    fake.seed(PERSONAL, PREV, personalDoc(PREV, '2026-09-01T10:00:00.000Z'));
    // Ο «διάδοχος» υπάρχει **μόνο** εταιρικά: μια έκδοση δεν αλλάζει χώρο.
    fake.seed(COMPANY_FILES, NEXT, { id: NEXT, companyId: COMPANY, createdBy: PERSON, status: 'ready' });

    expect(await supersede()).toEqual({
      kind: 'refused', fileId: PREV, act: 'supersede', why: 'successor-not-found',
    });
  });

  it('📚 Α34.8 — η στοίβα διαβάζει το προσωπικό διαμέρισμα, και ΜΟΝΟ αυτό', async () => {
    seedPair();
    // Θόρυβος στο εταιρικό διαμέρισμα με τον ίδιο δεσμό — δεν επιτρέπεται να εμφανιστεί.
    fake.seed(COMPANY_FILES, 'file_noise', {
      id: 'file_noise', companyId: COMPANY, createdBy: PERSON, supersededByFileId: NEXT,
      status: 'ready', displayName: 'n', originalFilename: 'n.pdf', ext: 'pdf',
      contentType: 'application/pdf', storagePath: 'companies/c_alpha/files/n.pdf', ...SLOT,
    });
    await supersede();

    const stack = await readVersionStack({ userId: PERSON }, PREV);

    expect(stack.kind).toBe('stack');
    if (stack.kind !== 'stack') return;
    expect(stack.headFileId).toBe(NEXT);
    expect(stack.versions.map((v) => v.id)).toEqual([NEXT, PREV]);
  });

  it('🔇 Α34.9 — ΚΑΜΙΑ γραμμή στο εταιρικό ημερολόγιο (δηλωμένη σιωπή ως το 2β.4)', async () => {
    seedPair();

    await supersede();

    expect(recordFileAudit).not.toHaveBeenCalled();
  });
});

describe('Α34 — ο διάδοχος του προβιβασμού (καθαρό)', () => {
  const version = (id: string, extra: Partial<FileRecord> = {}): FileRecord =>
    ({ ...personalDoc(id, '2026-09-01T10:00:00.000Z'), ...extra } as unknown as FileRecord);

  it('✅ Α34.6 — γεννιέται από το overload ΑΝΘΡΩΠΟΥ: κανένα companyId/cde*, ρίζα people/', () => {
    const input = successorBuilderInput({
      source: version('file_v1'),
      head: version('file_v2'),
      successorId: 'file_v3',
      custody: { userId: PERSON },
      actorUid: PERSON,
    });

    const { storagePath, recordBase } = buildPendingFileRecordData(input);

    expect(recordBase).toMatchObject({ userId: PERSON, createdBy: PERSON });
    expect(recordBase).not.toHaveProperty('companyId');
    // 🔴 Η ΜΕΤΑΛΛΑΞΗ: το overload εταιρείας θα έγραφε `cdeReadReach` — πεδίο που ο κανόνας
    //    `files_personal` απορρίπτει, και φάση σε αρχείο που δεν έχει φάσεις.
    for (const key of FORBIDDEN_CDE_KEYS) expect(recordBase).not.toHaveProperty(key);
    expect(storagePath.startsWith(`people/${PERSON}/`)).toBe(true);
    expect(storagePath).not.toContain('companies/');
  });

  it('🔑 Α34.7 — ο σπόρος κλειδώνει στο ΚΛΕΙΔΙ ΚΑΤΟΧΟΥ, όχι στο σκέτο id', () => {
    const asPerson = promotionSeed({ userId: 'x1' }, 'file_v1', 'file_v2');
    const asCompany = promotionSeed({ companyId: 'x1' }, 'file_v1', 'file_v2');

    expect(asPerson).not.toBe(asCompany);
    expect(asPerson).toContain('personal:x1');
    expect(asCompany).toContain('company:x1');
  });
});

describe('Α34.10 — το καθεστώς του ανθρώπου έχει ΔΙΚΟ του όνομα', () => {
  it('`personal-custody`, ποτέ δανεικό «δεν βρέθηκε έργο»', () => {
    expect(PERSONAL_REGIME).toEqual({ kind: 'versions-only', why: 'personal-custody' });
  });

  /**
   * 🔴 **ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΒΓΗΚΕ ΠΡΑΣΙΝΗ** (Μ3, ADR-866 §2.6.10): αν αφαιρεθεί ο
   * προσωπικός κλάδος της `custodyOnEntry`, η **συμπεριφορά** μένει ίδια — το
   * `resolveContainerProject` διαβάζει `raw.companyId`, δεν το βρίσκει, και λέει `'no-entity'`.
   * Άρα κάθε έλεγχος πάνω στην **έκβαση** του γραφέα έμενε πράσινος, και ο κλάδος φαινόταν
   * περιττός. **Δεν είναι**: κρατά (α) τον **αληθινό λόγο** — το αρχείο *δηλώνει* οντότητα, απλώς
   * δεν έχει εταιρεία — και (β) **μηδέν αναγνώσεις** αλυσίδας έργου ανά πράξη.
   *
   * ⇒ Η άγκυρα ρωτά τον **ίδιο** τον απαντητή, όχι την έκβαση.
   */
  it('🔴 Α34.10β — η `custodyOnEntry` λέει `personal-custody` ΚΑΙ δεν διαβάζει ΤΙΠΟΤΑ', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'op_1', { id: 'op_1', userId: PERSON });
    const raw = personalDoc(PREV, '2026-09-01T10:00:00.000Z');

    const entry = await fake.runTransaction(async (transaction) =>
      custodyOnEntry(
        transaction as unknown as Transaction,
        fake as unknown as AdminFirestore,
        raw,
        'pre-cde',
        owner,
      ),
    );

    expect(entry.regime).toEqual({ kind: 'versions-only', why: 'personal-custody' });
    // Καμία σφράγιση έργου/ομάδας: ο άνθρωπος δεν έχει ούτε το ένα ούτε το άλλο.
    expect(entry.fields).toEqual({});
  });

  it('μόνο η αντικατάσταση ζει στον προσωπικό χώρο', () => {
    const allowed = (Object.keys(ACT_SPEC) as ContainerAct[]).filter(
      (act) => regimeRefusal(act, PERSONAL_REGIME) === null,
    );
    expect(allowed).toEqual(['supersede']);
  });
});
