/**
 * ADR-819 · CHECK 3.74 — **«ΠΟΙΟ ΕΙΝΑΙ ΤΟ ΤΜΗΜΑ ΔΙΕΥΘΥΝΣΗΣ, ΚΑΙ ΕΙΝΑΙ ΟΛΙΚΗ Η ΑΠΑΝΤΗΣΗ;»**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ερώτημα **δεν είχε ιδιοκτήτη**: το απαντούσε μια τριαδική έκφραση μέσα στο
 * δίχτυ `(app)/[...unprefixed]`, με τιμή (`companyId`) που **δεν είχε υποχρέωση**
 * να είναι διεύθυνση. Μετρημένο ζωντανά 2026-08-26: ο επαγγελματίας έβλεπε 404.
 *
 * 🔴 **ΟΙ ΑΓΚΥΡΕΣ ΕΚΤΕΛΟΥΝ, ΔΕΝ ΔΙΑΒΑΖΟΥΝ.** Η Κ5 και η Κ7 τρέχουν τους
 * **πραγματικούς** κριτές μορφής (`judgeAliasShape`, `isValidEnterpriseId`,
 * `isInsideWorkspace`) πάνω στις **πραγματικές** τιμές του σπορέα — αλλιώς θα
 * ήταν ταυτολογίες που επιβεβαιώνουν ό,τι υποθέτουν.
 */

// ─── Ελεγχόμενη «βάση» ───────────────────────────────────────────────────────
const store = new Map<string, Record<string, unknown>>();
const reads: string[] = [];
let failReads = false;
let adminAvailable = true;

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => adminAvailable,
  getAdminFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const path = `${name}/${id}`;
          reads.push(path);
          if (failReads) throw new Error('ECONNRESET (προσομοίωση)');
          const data = store.get(path);
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import { readRepoCode } from '@/test-utils/read-source';
import { workspaceSegmentFor } from '../workspace-segment';
import { workspaceHomeHref } from '../workspace-home';
import { HOME_REDIRECT_ROUTE } from '../workspace-routes';
import { PRIVATE_SPACE_HOME } from '@/lib/routes/landing';
import { judgeAliasShape } from '../alias-rules';
import { isInsideWorkspace } from '../workspace-scope';
import { PERSONAL_WORKSPACE_ALIAS } from '@/types/workspace-alias';
import { isValidEnterpriseId } from '@/services/enterprise-id-parse';
import { skeleton } from '@/lib/unicode/skeleton';
import {
  COMPANY_ALIAS,
  COMPANY_ALIAS_KEY,
  COMPANY_ID,
} from '../../../../scripts/lib/emulator/personas';

/** Γνήσιο enterprise id — `comp_` + **αληθινό** uuid v4. */
const ADDRESSABLE = 'comp_aaaaaaaa-0000-4000-8000-000000000001';
/** Ό,τι έγραφε ο σπορέας: πρόθεμα σωστό, **uuid ανύπαρκτο**. */
const UNADDRESSABLE = 'comp_alpha_emulator';

// ⚠️ **ΤΟ SSoT, ΟΧΙ 13ος ΚΛΩΝΟΣ** (`test-utils/read-source`, CHECK 3.28): το
//    `stripComments` ήταν γραμμένο **12** φορές, καθεμιά με δική της `REPO_ROOT`
//    που μετρά `..` ανάλογα με το βάθος του φακέλου.
// 🔴 Και το `readRepoCode` **κόβει σχόλια**, που είναι απαίτηση **ορθότητας**:
//    η πρώτη μορφή των Ο5/Ο7 κοκκίνισε πάνω στην **τεκμηρίωση της θεραπείας**
//    (η φράση «ποτέ 308» μέσα σε σχόλιο), δηλαδή έσπρωχνε τον επόμενο να σβήσει
//    τη γνώση για να πρασινίσει η πύλη. Είναι το `Κ7β` της CHECK 3.50.
const read = readRepoCode;

beforeEach(() => {
  store.clear();
  reads.length = 0;
  failReads = false;
  adminAvailable = true;
});

// =============================================================================
// Κ — Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ ΟΛΙΚΗ
// =============================================================================

describe('Κ — η μία αυθεντία του τμήματος διεύθυνσης', () => {
  it('Κ1: ο ιδιωτικός χώρος δίνει `me` με ΜΗΔΕΝ αναγνώσεις', async () => {
    const resolution = await workspaceSegmentFor({ kind: 'personal' });

    expect(resolution).toEqual({
      outcome: 'segment',
      segment: PERSONAL_WORKSPACE_ALIAS,
      form: 'personal',
    });
    // 🔴 Ο ιδιωτικός χώρος υπάρχει επειδή υπάρχει ο άνθρωπος — καμία ερώτηση.
    expect(reads).toHaveLength(0);
  });

  it('Κ2: 🔴 το ψευδώνυμο του εγγράφου ΝΙΚΑ την ταυτότητα (κανονική μορφή)', async () => {
    store.set(`companies/${ADDRESSABLE}`, { alias: 'pagonis' });

    const resolution = await workspaceSegmentFor({ kind: 'organization', companyId: ADDRESSABLE });

    expect(resolution).toEqual({ outcome: 'segment', segment: 'pagonis', form: 'alias' });
    // ⚠️ **Ανάγνωση ΚΑΤΑ ΚΛΕΙΔΙ, ποτέ σάρωση** (Ε-5 §4 #1): κατάλογος ψευδωνύμων
    //    θα ήταν απαρίθμηση γραφείων.
    expect(reads).toEqual([`companies/${ADDRESSABLE}`]);
  });

  it('Κ3: 🔴 ψευδώνυμο ΧΑΛΑΣΜΕΝΗΣ ΜΟΡΦΗΣ στο έγγραφο αγνοείται — ποτέ διεύθυνση που δεν λύνεται', async () => {
    // Το `_` δεν επιτρέπεται σε ψευδώνυμο. Αν το εμπιστευόμασταν, θα χτίζαμε
    // `/o/alpha_techniki/…` — διεύθυνση που ο αναγνώστης **απορρίπτει**.
    store.set(`companies/${ADDRESSABLE}`, { alias: 'alpha_techniki' });

    const resolution = await workspaceSegmentFor({ kind: 'organization', companyId: ADDRESSABLE });

    expect(resolution).toEqual({ outcome: 'segment', segment: ADDRESSABLE, form: 'identity' });
  });

  it('Κ4: χωρίς ψευδώνυμο, ο διευθυνσιοδοτήσιμος companyId δίνει `form:identity`', async () => {
    store.set(`companies/${ADDRESSABLE}`, { name: 'Χωρίς όνομα διεύθυνσης' });

    const resolution = await workspaceSegmentFor({ kind: 'organization', companyId: ADDRESSABLE });

    expect(resolution).toEqual({ outcome: 'segment', segment: ADDRESSABLE, form: 'identity' });
  });

  it('Κ5: 🔴🔴 ούτε ψευδώνυμο ούτε έγκυρη ταυτότητα ⇒ `unaddressable`, ΠΟΤΕ κατασκευασμένη διεύθυνση', async () => {
    store.set(`companies/${UNADDRESSABLE}`, { name: 'Άλφα Τεχνική (DEMO)' });

    // ── Η ΜΕΤΡΗΣΗ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟ ADR-819, ΕΚΤΕΛΕΣΜΕΝΗ ────────────────────────
    // Και οι **δύο** γραμματικές της υποδοχής `/o/<…>` απορρίπτουν αυτή την τιμή.
    expect(isValidEnterpriseId(UNADDRESSABLE)).toBe(false); // 3 μέρη στο split('_')
    expect(judgeAliasShape(UNADDRESSABLE).ok).toBe(false); // το `_` απαγορεύεται

    const resolution = await workspaceSegmentFor({ kind: 'organization', companyId: UNADDRESSABLE });

    expect(resolution).toEqual({ outcome: 'unaddressable', companyId: UNADDRESSABLE });
  });

  it('Κ6: 🔴 αποτυχία βάσης ΔΕΝ γίνεται 404 όταν ο κανόνας 3 μπορεί να παίξει', async () => {
    store.set(`companies/${ADDRESSABLE}`, { alias: 'pagonis' });
    failReads = true;

    const resolution = await workspaceSegmentFor({ kind: 'organization', companyId: ADDRESSABLE });

    // Belt-and-suspenders (N.7.2 Q4): αναλαμπή της βάσης στη σύνδεση δεν
    // προσγειώνει σε 404 κάποιον του οποίου ο companyId είναι διευθυνσιοδοτήσιμος.
    expect(resolution).toEqual({ outcome: 'segment', segment: ADDRESSABLE, form: 'identity' });
  });

  it('Κ6β: Firebase Admin μη διαθέσιμο ⇒ ίδια υποχώρηση, καμία ανάγνωση', async () => {
    adminAvailable = false;

    const resolution = await workspaceSegmentFor({ kind: 'organization', companyId: ADDRESSABLE });

    expect(resolution).toEqual({ outcome: 'segment', segment: ADDRESSABLE, form: 'identity' });
    expect(reads).toHaveLength(0);
  });
});

// =============================================================================
// Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΚΑΙ ΟΙ ΔΟΜΙΚΕΣ ΑΓΚΥΡΕΣ
// =============================================================================

describe('Κ7 — 🔒 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο πολίτης μένει ακέραιος', () => {
  it('Κ7: η προσγείωση του πολίτη είναι ΕΚΤΟΣ εμβέλειας χώρου ⇒ το δίχτυ δεν τον αγγίζει', () => {
    // 🔴 Χωρίς αυτή την άγκυρα, «διόρθωσα τον επαγγελματία» μπορεί να σημαίνει
    //    «έσπασα τον πολίτη». Ο φρουρός 2 του διχτυού είναι το `isInsideWorkspace`:
    //    αν το `/offers` έμπαινε στην εμβέλεια, ο πολίτης θα περνούσε από τον
    //    ίδιο μηχανισμό και θα προσγειωνόταν σε `/o/me/offers`.
    expect(isInsideWorkspace('/offers')).toBe(false);

    // Ο επαγγελματίας, αντίθετα, ΠΡΕΠΕΙ να περνά από το δίχτυ.
    expect(isInsideWorkspace('/dashboard')).toBe(true);
  });
});

describe('Κ8 — 🔒 Η ΣΕΙΡΑ: το cookie πριν τον `user`', () => {
  it('Κ8: το `syncServerSession` προηγείται του `setUser` στο AuthContext', () => {
    const source = read('src/auth/contexts/AuthContext.tsx');

    const sync = source.indexOf('await syncServerSession(firebaseUser)');
    const set = source.indexOf('setUser(authUser)');

    expect(sync).toBeGreaterThan(-1);
    expect(set).toBeGreaterThan(-1);
    // 🔴 Ο αγώνας του ADR-819 §1.1: ο `user` πυροδοτεί την πλοήγηση
    //    (`useAuthFormState.ts:107`). Αν γίνει μη-κενός πριν στηθεί το `__session`,
    //    το server component πέφτει στο dev bypass και **κατασκευάζει** companyId.
    expect(sync).toBeLessThan(set);
  });

  it('Κ8β: η πλοήγηση εξακολουθεί να πυροδοτείται από τον `user` — η άγκυρα Κ8 έχει νόημα', () => {
    const source = read('src/auth/hooks/useAuthFormState.ts');
    expect(source).toContain('router.replace(landing)');
    expect(source).toMatch(/\[loading, user, router, landing\]/);
  });
});

describe('Κ9 — 🔒 Ο σπορέας δίνει διεύθυνση στον χώρο', () => {
  const seeder = () => read('scripts/emulator-seed-personas.ts');

  it('Κ9: γράφει ΚΑΙ ΤΑ ΔΥΟ έγγραφα ψευδωνύμου', () => {
    const source = seeder();

    // ⚠️ **ΚΑΘΕ ΓΡΑΨΙΜΟ ΚΡΙΝΕΤΑΙ ΜΕΣΑ ΣΤΟ ΔΙΚΟ ΤΟΥ ΤΜΗΜΑ.** Η πρώτη μορφή αυτής
    //    της άγκυρας έψαχνε `collection('companies')[\s\S]{0,400}alias:` — και το
    //    παράθυρο των 400 χαρακτήρων **έφτανε μέχρι μέσα στο δεύτερο γράψιμο**,
    //    οπότε η μετάλλαξη «σβήσε το `alias` από το έγγραφο του χώρου»
    //    **ΕΠΙΒΙΩΣΕ** (μετρημένο 2026-08-26). Ο τεμαχισμός δεν είναι ύφος.
    const [, companiesBlock = '', aliasesBlock = ''] = source.split(/await db\.collection\(/);

    // (α) ο **γραφέας** της διεύθυνσης το διαβάζει από εδώ…
    expect(companiesBlock).toContain("'companies'");
    expect(companiesBlock).toContain('alias: COMPANY_ALIAS');

    // (β) …και ο **αναγνώστης** το λύνει από εδώ. Λείψει το ένα ⇒ 404, και τα δύο
    //     404 μοιάζουν ίδια από την οθόνη.
    expect(aliasesBlock).toContain("'workspace_aliases'");
    expect(aliasesBlock).toContain('COMPANY_ALIAS_KEY');
    expect(aliasesBlock).toContain('companyId: COMPANY_ID');
  });

  it('Κ9δ: 🔴🔴 το ΠΑΓΩΜΕΝΟ κλειδί ευρετηρίου ΕΙΝΑΙ ο σκελετός — το λέει η ΑΥΘΕΝΤΙΑ, όχι εμείς', () => {
    // 🔑 Ο σπορέας τρέχει σε σκέτο `tsx`, όπου το `server-only` του
    //    `lib/unicode/skeleton.ts` **δεν επιλύεται** (μετρημένο: MODULE_NOT_FOUND).
    //    Άρα το κλειδί είναι **παγωμένη σταθερά** — και θα ήταν *εμπιστοσύνη* αν
    //    δεν το εκτελούσε κάποιος. Εδώ, σε jest, το `server-only` επιλύεται:
    //    **τρέχει η πραγματική συνάρτηση**.
    //
    // ⚠️ Απόκλιση εδώ σημαίνει ότι ο σπορέας γράφει το ευρετήριο σε **λάθος
    //    κλειδί** ⇒ το `resolveAlias` δεν βρίσκει τίποτα ⇒ ο επαγγελματίας
    //    ξαναβλέπει 404. Το μαθαίνεις στην πύλη, όχι στην οθόνη.
    expect(skeleton(COMPANY_ALIAS)).toBe(COMPANY_ALIAS_KEY);
  });

  it('Κ9β: 🔴 το ψευδώνυμο του σπορέα ΠΕΡΝΑΕΙ τον πραγματικό κριτή μορφής', () => {
    // Ταυτολογία θα ήταν να ελέγξουμε ότι η σταθερά υπάρχει. Εδώ **εκτελείται**
    // ο κριτής που θα την κρίνει στην παραγωγή.
    const verdict = judgeAliasShape(COMPANY_ALIAS);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error('αδύνατο');
    expect(verdict.alias).toBe(COMPANY_ALIAS);
  });

  it('Κ9γ: 🔴 και ο companyId του σπορέα ΕΞΑΚΟΛΟΥΘΕΙ να είναι αδιευθυνσιοδότητος — γι’ αυτό χρειάζεται το ψευδώνυμο', () => {
    expect(isValidEnterpriseId(COMPANY_ID)).toBe(false);
    expect(judgeAliasShape(COMPANY_ID).ok).toBe(false);
  });
});

describe('Κ10 — 🔒 Κανένας δεύτερος γραφέας', () => {
  it('Κ10: το δίχτυ ρωτά την αυθεντία και ΔΕΝ κατασκευάζει τμήμα μόνο του', () => {
    const net = read('src/app/(app)/[...unprefixed]/page.tsx');

    expect(net).toContain('workspaceSegmentFor');
    // 🔴 Η ακριβής τριαδική που ζούσε εδώ και παρήγαγε το 404.
    expect(net).not.toMatch(/identity\.scope === 'organization' \? identity\.ctx\.companyId/);
    // Το `workspacePath` τρέφεται **μόνο** από την αυθεντία.
    expect(net).toMatch(/workspacePath\(resolution\.segment,/);
  });

  it('Κ10β: 🔴 το `unaddressable` ΔΕΝ μεταμφιέζεται σε 404', () => {
    const net = read('src/app/(app)/[...unprefixed]/page.tsx');
    // «Ο χώρος σου δεν έχει διεύθυνση» ≠ «δεν υπάρχει» (ADR-819 §5 Α7).
    expect(net).toMatch(/unaddressable[\s\S]{0,200}throw new Error/);
  });
});

// =============================================================================
// Ο — Η ΕΞΟΔΟΣ ΑΠΟ ΤΟ 404 (ADR-819 §8)
// =============================================================================

describe('Ο — «πού ανήκω;» — η έξοδος από το αδιέξοδο', () => {
  it('Ο1: 🔴 ο επαγγελματίας παίρνει τον ΔΙΚΟ ΤΟΥ χώρο, με ψευδώνυμο', async () => {
    store.set(`companies/${ADDRESSABLE}`, { alias: 'pagonis' });

    const href = await workspaceHomeHref({ kind: 'organization', companyId: ADDRESSABLE });

    expect(href).toBe('/o/pagonis/dashboard');
  });

  it('Ο2: 🔴🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — ο πολίτης ΔΕΝ παίρνει πρόθεμα χώρου', async () => {
    // Το `/offers` ζει ΕΚΤΟΣ εμβέλειας χώρου. Πρόθεμα εκεί θα έδινε `/o/me/offers`
    // — διεύθυνση ΧΩΡΙΣ σελίδα, δηλαδή το κουμπί εξόδου από το 404 θα οδηγούσε
    // σε **ΝΕΟ 404**. Ίδιο σχήμα με τα περιστατικά `/unauthorized` και
    // `/workspace/new`, πιασμένο εδώ πριν προσγειωθεί.
    const href = await workspaceHomeHref({ kind: 'personal' });

    expect(href).toBe(PRIVATE_SPACE_HOME);
    expect(href).not.toContain('/o/');
    // Και ΜΗΔΕΝ αναγνώσεις: ο πολίτης δεν έχει έγγραφο χώρου να ρωτηθεί.
    expect(reads).toHaveLength(0);
  });

  it('Ο3: 🔴 χώρος ΧΩΡΙΣ διεύθυνση ⇒ `null`, ΠΟΤΕ κατασκευασμένος σύνδεσμος', async () => {
    store.set(`companies/${UNADDRESSABLE}`, { name: 'Άλφα Τεχνική (DEMO)' });

    const href = await workspaceHomeHref({ kind: 'organization', companyId: UNADDRESSABLE });

    // Ένα `null` που γίνεται σιωπηλά `'/'` θα ήταν **τρίτο αδιέξοδο**.
    expect(href).toBeNull();
  });

  it('Ο4: χωρίς ψευδώνυμο, η ταυτότητα κρατά τον σύνδεσμο ζωντανό', async () => {
    store.set(`companies/${ADDRESSABLE}`, { name: 'Χωρίς όνομα' });

    const href = await workspaceHomeHref({ kind: 'organization', companyId: ADDRESSABLE });

    expect(href).toBe(`/o/${ADDRESSABLE}/dashboard`);
  });

  it('Ο5: 🔒 το 404 ΔΕΝ στέλνει πια στη σύνδεση, και ΔΕΝ αποφασίζει μόνο του', () => {
    const page = read('src/app/not-found.tsx');

    // 🔴 **Η ΠΡΩΤΗ ΜΟΡΦΗ ΑΥΤΗΣ ΤΗΣ ΓΡΑΜΜΗΣ ΗΤΑΝ `toContain('HOME_REDIRECT_ROUTE')`
    //    ΚΑΙ Η ΜΕΤΑΛΛΑΞΗ Μ13 ΤΗΝ ΠΕΡΑΣΕ** (μετρημένο 2026-08-26): αλλαγή του
    //    προορισμού σε ωμό `'/login'` **άφηνε το import ανέγγιχτο**, άρα το όνομα
    //    εξακολουθούσε να υπάρχει στο αρχείο. Άγκυρα που ψάχνει **όνομα** αντί για
    //    **χρήση** μετρά ότι κάποιος *έγραψε* το σωστό, όχι ότι το *χρησιμοποιεί*.
    expect(page).toMatch(/<Link\s+href=\{HOME_REDIRECT_ROUTE\}>/);

    // Το αδιέξοδο που μετρήθηκε στην οθόνη 2026-08-26 — και κάθε ισοδύναμό του.
    expect(page).not.toContain('AUTH_ROUTES.login');
    expect(page).not.toContain('backToLogin');
    expect(page).not.toContain('/login');

    // ⚠️ Λ2: client component ⇒ **απαγορεύεται** να διαβάσει ταυτότητα.
    expect(page).not.toContain('useAuth');
    expect(page).not.toContain('companyId');
  });

  it('Ο6: 🔒🔒 το `home` ΕΙΝΑΙ δηλωμένο εκτός εμβέλειας — αλλιώς η έξοδος γίνεται νέο 404', () => {
    // Ο έλεγχος ΕΚΤΕΛΕΙ τον κριτή: χωρίς τη δήλωση, το workspace-aware `Link`
    // του `not-found.tsx` θα παρήγαγε `/o/<ψευδώνυμο>/home`.
    expect(isInsideWorkspace(HOME_REDIRECT_ROUTE)).toBe(false);
  });

  /**
   * ⚠️⚠️ **ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΗ Η ΑΓΚΥΡΑ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-08-26**
   *
   * Ελέγχει τη **μορφή** του κλάδου, **όχι** ότι ο κλάδος εκτελείται. Και σε
   * `development` **δεν εκτελείται**: το `page-identity.ts:147` επιστρέφει
   * `ok: true` με **κατασκευασμένη εταιρική** ταυτότητα όταν λείπει cookie
   * *(ο dev bypass, βλάβη Β2 του ADR-819 §1.2)*. Μετρημένο στον emulator:
   *
   *   ανώνυμος → `GET /home` → **307 → `/o/comp_9c7c1a50-…/dashboard`**
   *
   * δηλαδή **ο χώρος του `.env.local`**, όχι η σύνδεση.
   *
   * 🔑 **Στην παραγωγή ο κλάδος ΕΚΤΕΛΕΙΤΑΙ**: ο φρουρός είναι
   * `!sessionCookie && environment === 'development'`, άρα εκτός development η
   * απουσία cookie δίνει `{ ok: false, reason: 'no-session' }`.
   *
   * ⛔ **ΜΗΝ γράψεις εδώ άγκυρα που «περνά» τον ανώνυμο σε development** — θα
   *    ήταν **πράσινο για λάθος λόγο**: θα επικύρωνε τον dev bypass αντί για τη
   *    συμπεριφορά. Ο dev bypass είναι **ξεχωριστή δουλειά** (ADR-819 §8.6).
   */
  it('Ο7: 🔒 ο κλάδος του ανώνυμου ΚΑΙ του χώρου-χωρίς-διεύθυνση οδηγεί στη σύνδεση (ΜΟΡΦΗ, δες σχόλιο)', () => {
    const route = read('src/app/home/route.ts');
    expect(route).toContain('readPageIdentity');
    expect(route).toMatch(/!identity\.ok[\s\S]{0,120}AUTH_ROUTES\.login/);
    expect(route).toMatch(/href === null[\s\S]{0,220}AUTH_ROUTES\.login/);
    // 307, ποτέ 308: ο προορισμός εξαρτάται από το ποιος ρωτά.
    expect(route).toContain('307');
    expect(route).not.toContain('308');
  });
});
