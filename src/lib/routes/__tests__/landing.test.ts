/**
 * @fileoverview **ΑΓΚΥΡΕΣ: ΠΟΥ ΠΡΟΣΓΕΙΩΝΕΤΑΙ Ο ΑΝΘΡΩΠΟΣ** (ADR-660).
 * @related lib/routes/landing · app/(app)/dashboard/page · app/(app)/pending-approval/page
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ — ΚΑΘΕ ΚΟΜΜΑΤΙ ΗΤΑΝ «ΣΩΣΤΟ» ΚΑΙ Η ΟΘΟΝΗ ΗΤΑΝ ΤΟΙΧΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `AUTH_ROUTES.home` έδειχνε σωστά στον χώρο εργασίας. Το `dashboard/page.tsx`
 * σωστά δεν άφηνε άνθρωπο χωρίς `companyId` να δει σπασμένο ταμπλό. Το fail-closed
 * σωστά αρνιόταν δεδομένα χωρίς claim. **Κανένα κομμάτι δεν ήταν σπασμένο** — και
 * το άθροισμά τους έστελνε τον πολίτη που μόλις γράφτηκε σε οθόνη που του έλεγε
 * *«δεν υπάρχεις»*, ως **πρώτη οθόνη μετά την εγγραφή**.
 *
 * 🔑 **ΟΙ ΤΙΜΕΣ ΜΟΝΕΣ ΤΟΥΣ ΔΕΝ ΑΠΟΔΕΙΚΝΥΟΥΝ ΤΙΠΟΤΑ.** Ένα test που επιβεβαιώνει
 * μόνο ότι ο επιλυτής επιστρέφει δύο συμβολοσειρές θα ήταν πράσινο ακόμη κι αν οι
 * δύο ήταν **η ίδια** — γι' αυτό υπάρχει το `Κ5`. Και ένα test που κοιτά μόνο τον
 * επιλυτή δεν βλέπει αν οι σελίδες τον **καλούν** — γι' αυτό υπάρχουν τα `Π`.
 *
 * ⚠️ **ΤΟ `Δ1` ΕΙΝΑΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΟΛΗΣ ΑΛΛΑΓΗΣ.** Χωρίς απόδειξη ότι ο
 * φρουρός του ADR-657 στέκει ακόμη, «ο πολίτης πια δεν μπλοκάρεται» μπορεί να
 * σημαίνει απλώς ότι **σβήσαμε τον φρουρό** — θεραπεία περιστατικού ασφαλείας.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { AUTH_ROUTES, PRIVATE_SPACE_HOME, resolvePostLoginRoute } from '@/lib/routes';
import { REPO_ROOT, readRepoCode, readRepoFile, stripComments } from '@/test-utils/read-source';

/**
 * ⚠️ **Η ανάγνωση πηγαίου ζει σε SSoT** (ADR-660 §5.13). Μέχρι 2026-08-23 αυτές οι
 * γραμμές δήλωναν εδώ δική τους `REPO_ROOT` + `stripComments` — μία από **δώδεκα**
 * ταυτόσημες γραφές στο δέντρο (N.18 / CHECK 3.28). Το «γιατί κόβονται τα σχόλια»
 * —που το έμαθε **αυτό** το test, κοκκινίζοντας πάνω στην τεκμηρίωση της θεραπείας—
 * μετακόμισε μαζί του και ζει πλέον στο `test-utils/read-source.ts`.
 */
const read = readRepoFile;
const readCode = readRepoCode;

/**
 * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΤΟΥ ΤΑΜΠΛΟ ΔΕΝ ΚΑΡΦΩΝΕΤΑΙ — ΤΟ ΕΜΑΘΕ ΜΕ ΤΟΝ ΔΥΣΚΟΛΟ ΤΡΟΠΟ.**
 *
 * Μέχρι 2026-08-23 εδώ ζούσε η σταθερά `'src/app/(app)/dashboard/page.tsx'`. Η
 * **Φάση 3 του ADR-787** μετακόμισε τη σελίδα σε `(app)/o/[workspace]/dashboard/`
 * (ο χώρος μπαίνει στη ΔΙΕΥΘΥΝΣΗ) και η άγκυρα έγινε **κόκκινη με `ENOENT`** — και
 * μαζί της, μέσω της CHECK 3.54, ολόκληρη η μπλοκάρουσα σουίτα.
 *
 * ⚠️ **Το ξανακάρφωμα στη νέα θέση θα ήταν λάθος διόρθωση**: η ίδια εκστρατεία έχει
 * **104 σελίδες ακόμη** να μετακινήσει (baseline CHECK 3.60), άρα μια σταθερά εδώ
 * είναι **προγραμματισμένο** επόμενο σπάσιμο. Η άγκυρα **ψάχνει** τη σελίδα, όπως
 * και το ίδιο το CHECK 3.60 παράγει τις διαδρομές αντί να τις απαριθμεί.
 *
 * ⚠️ **Και απαιτεί ΑΚΡΙΒΩΣ ΜΙΑ**: με «η πρώτη που θα βρω» θα σιωπούσε την ημέρα που
 * γεννιέται δεύτερο ταμπλό, δηλαδή ακριβώς όταν το ερώτημα «ποιο αποφασίζει;»
 * αποκτά νόημα. Το `/crm/dashboard` είναι **άλλη** σελίδα και εξαιρείται ονομαστικά.
 */
const findDashboardPage = (): string => {
  const matches = collectTsFiles(join(REPO_ROOT, 'src', 'app'))
    .map((file) => relative(REPO_ROOT, file).split(sep).join('/'))
    .filter((file) => file.endsWith('/dashboard/page.tsx') && !file.includes('/crm/'));
  expect(matches).toHaveLength(1);
  return matches[0];
};

const PENDING = 'src/app/(app)/pending-approval/page.tsx';
const AUTH_CONTEXT = 'src/lib/auth/auth-context.ts';

/**
 * **Αρνείται ο διακομιστής την ταυτότητα χωρίς `companyId` claim;** (ADR-657 §3.5)
 *
 * ⚠️ **ΔΥΟ σημάδια, όχι ένα**: το μήνυμα καταγραφής μόνο του θα ήταν πράσινο ακόμη
 * κι αν το `return null` είχε γίνει `return claimsWithDefaultTenant` — δηλαδή θα
 * επιβεβαίωνε το **σχόλιο** αντί για τη **συμπεριφορά**. Το δεύτερο σημάδι είναι η
 * κατάληξη της άρνησης στη διαδρομή αιτήματος.
 */
const hasFailClosedGuard = (src: string): boolean =>
  src.includes('DENY — missing companyId claim') &&
  src.includes("createUnauthenticatedContext('missing_claims')");

describe('Κ — ο επιλυτής προσγείωσης', () => {
  it('Κ1: ο επαγγελματίας (με claim οργανισμού) πάει στον χώρο εργασίας', () => {
    expect(resolvePostLoginRoute({ companyId: 'comp_9c7c1a50' })).toBe(AUTH_ROUTES.home);
  });

  it('Κ2: ο πολίτης (companyId: null) πάει στον ΔΙΚΟ ΤΟΥ χώρο — ποτέ στην αναμονή', () => {
    const landing = resolvePostLoginRoute({ companyId: null });
    expect(landing).toBe(PRIVATE_SPACE_HOME);
    expect(landing).not.toBe(AUTH_ROUTES.pendingApproval);
  });

  it('Κ3: `undefined` είναι το σχήμα ΤΟΥ ΠΕΛΑΤΗ (AuthUser.companyId?: string) και μετράει το ίδιο', () => {
    expect(resolvePostLoginRoute({ companyId: undefined })).toBe(PRIVATE_SPACE_HOME);
    expect(resolvePostLoginRoute({})).toBe(PRIVATE_SPACE_HOME);
  });

  it('Κ4: κενή συμβολοσειρά = ΑΠΟΥΣΙΑ — συμφωνία με το fail-closed του διακομιστή', () => {
    // Το `extractCustomClaims` απορρίπτει `companyId.length === 0`. Αν εδώ κρινόταν
    // ως «έχει οργανισμό», ο άνθρωπος θα προσγειωνόταν σε σελίδα όπου ΚΑΘΕ κλήση
    // δεδομένων 401άρει: προσγείωση αληθής, αλλά ασύμφωνη με τον server.
    expect(resolvePostLoginRoute({ companyId: '' })).toBe(PRIVATE_SPACE_HOME);
  });

  it('Κ5: ΠΑΡΟΝΟΜΑΣΤΗΣ — οι δύο προορισμοί είναι όντως διαφορετικοί', () => {
    // Χωρίς αυτό, τα Κ1-Κ4 θα έμεναν πράσινα ακόμη κι αν ο επιλυτής επέστρεφε
    // πάντα την ίδια διεύθυνση — δηλαδή πάνω στο ελάττωμα που τον γέννησε.
    expect(PRIVATE_SPACE_HOME).not.toBe(AUTH_ROUTES.home);
  });

  it('Κ6: ο ιδιωτικός χώρος ΟΝΟΜΑΖΕΤΑΙ, δεν ξαναγράφεται — ίδια τιμή με το SSoT', () => {
    // Ωμό '/offers' στο landing.ts θα ήταν δεύτερη αυθεντία (ADR-749): η διεύθυνση
    // ανήκει στο owner-property-routes.ts· εδώ αποκτά μόνο ΡΟΛΟ.
    expect(PRIVATE_SPACE_HOME).toBe(MY_OFFERS_ROUTE);
  });
});

describe('Π — οι σελίδες όντως τον καλούν', () => {
  it('Π1: το ταμπλό ΔΕΝ αποφασίζει πια μόνο του, και δεν έχει ωμή διεύθυνση αναμονής', () => {
    const src = readCode(findDashboardPage());
    expect(src).toContain('resolvePostLoginRoute');
    // Η ωμή συμβολοσειρά ήταν το σημείο που κανένας φρουρός δεν έβλεπε.
    expect(src).not.toContain("'/pending-approval'");
    expect(src).not.toContain("'/login'");
  });

  it('Π2: η οθόνη της αίτησης καλεί τον ΙΔΙΟ επιλυτή και προσφέρει πόρτα εξόδου', () => {
    const src = readCode(PENDING);
    expect(src).toContain('resolvePostLoginRoute');
    expect(src).toContain('PRIVATE_SPACE_HOME');
    expect(src).toContain('pendingApproval.goToMySpace');
  });

  it('Π3: το κείμενο υπάρχει και στις ΔΥΟ γλώσσες (N.11 — καμία σκληρή συμβολοσειρά)', () => {
    for (const locale of ['el', 'en']) {
      const auth = JSON.parse(read(`src/i18n/locales/${locale}/auth.json`)) as {
        pendingApproval: Record<string, string>;
      };
      expect(typeof auth.pendingApproval.goToMySpace).toBe('string');
      expect(auth.pendingApproval.goToMySpace.length).toBeGreaterThan(0);
    }
  });
});

/**
 * **ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ**: ποιος επιτρέπεται να στέλνει άνθρωπο σε οθόνη ανθρώπινης
 * έγκρισης — και **γιατί**.
 *
 * 🔴 **Σήμερα είναι ΚΕΝΟ, και αυτό είναι το νόημα.** Μέχρι 2026-08-23 υπήρχε **ένα**
 * (`dashboard/page.tsx`) και το κριτήριό του ήταν σκέτη **απουσία `companyId`** —
 * δηλαδή έστελνε σε ουρά τον άνθρωπο *«απλώς και μόνο επειδή γράφτηκε»*.
 *
 * ⚠️ **Ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ** (πρότυπο CHECK 3.35/3.50/3.58): μια εγγραφή
 * χωρίς λόγο είναι παράκαμψη με άλλο όνομα. Νέα εγγραφή — **ακόμα κι αν είναι
 * σωστή** — κοκκινίζει, ώστε να τη δει άνθρωπος· ένα κλειστό σύνολο που εγκρίνει
 * σιωπηλά τις σωστές πράξεις δεν θα έβλεπε ποτέ τη δεύτερη σωστή πράξη να γίνεται
 * τρίτη.
 */
const WAITING_SCREEN_NAVIGATORS: ReadonlyArray<{ file: string; why: string }> = [];

/** Πλοήγηση **προς** την οθόνη αναμονής — όχι απλή αναφορά του ονόματός της. */
const NAVIGATES_TO_WAITING =
  /(?:router\s*\.\s*(?:push|replace)|redirect|href\s*=)\s*[({]?\s*(?:['"`]\/pending-approval['"`]|[\w.]*AUTH_ROUTES\s*\.\s*pendingApproval)/;

const collectTsFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      collectTsFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

describe('Φ — ΚΑΝΕΙΣ δεν στέλνει άνθρωπο σε ουρά επειδή απλώς γράφτηκε', () => {
  it('Φ1: κάθε σημείο πλοήγησης προς την οθόνη αναμονής είναι ΔΗΛΩΜΕΝΟ, με λόγο', () => {
    const declared = new Set(WAITING_SCREEN_NAVIGATORS.map((entry) => entry.file));
    const found: string[] = [];

    for (const file of collectTsFiles(join(REPO_ROOT, 'src'))) {
      const code = stripComments(readFileSync(file, 'utf8'));
      if (!NAVIGATES_TO_WAITING.test(code)) continue;
      found.push(relative(REPO_ROOT, file).split(sep).join('/'));
    }

    expect(found.filter((file) => !declared.has(file))).toEqual([]);
    // Και η αντίστροφη κατεύθυνση: δήλωση που δεν αντιστοιχεί σε τίποτα είναι
    // νεκρός φρουρός — ο επόμενος θα τη διαβάσει ως «εδώ συμβαίνει κάτι».
    expect([...declared].filter((file) => !found.includes(file))).toEqual([]);
  });

  it('Φ1β: …και το κριτήριο του Φ1 ΞΕΧΩΡΙΖΕΙ — αναφορά ≠ πλοήγηση', () => {
    // Χωρίς αυτό, ένα regex που δεν ταιριάζει ΤΙΠΟΤΑ θα έβγαζε το Φ1 μονίμως
    // πράσινο: το κλασικό «0 = κανείς δεν κοίταξε».
    expect(NAVIGATES_TO_WAITING.test("router.replace('/pending-approval')")).toBe(true);
    expect(NAVIGATES_TO_WAITING.test('router.push(AUTH_ROUTES.pendingApproval)')).toBe(true);
    expect(NAVIGATES_TO_WAITING.test('<Link href={AUTH_ROUTES.pendingApproval}>')).toBe(true);
    // Ούτε το μητρώο διαδρομών ούτε ο άσχετος `pendingApprovalPoCount` του
    // procurement (10 εμφανίσεις) είναι πλοήγηση.
    expect(NAVIGATES_TO_WAITING.test("pendingApproval: '/pending-approval',")).toBe(false);
    expect(NAVIGATES_TO_WAITING.test('stats.pendingApprovalPoCount ?? 0')).toBe(false);
  });
});

describe('Δ — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ουρά έγκρισης ΔΕΝ σβήστηκε', () => {
  it('Δ1: το fail-closed του ADR-657 στέκει — απουσία claim εξακολουθεί να είναι ΑΡΝΗΣΗ', () => {
    // ⚠️ Αν αυτό πέσει, η αλλαγή του ADR-660 δεν «άνοιξε τον δρόμο στον πολίτη» —
    // κατήργησε τη θεραπεία ενός περιστατικού ασφαλείας. Είναι το ΜΟΝΟ test εδώ
    // που μιλά για αρχείο το οποίο αυτή η δουλειά ΔΕΝ επιτρέπεται να αγγίξει.
    expect(hasFailClosedGuard(readCode(AUTH_CONTEXT))).toBe(true);
  });

  it('Δ1β: …και το κατηγόρημα του Δ1 ΞΕΧΩΡΙΖΕΙ — δεν λέει «ναι» σε ό,τι του δώσεις', () => {
    // 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ, ΚΑΙ Ο ΛΟΓΟΣ ΤΟΥ.** Τα υπόλοιπα anchors αποδείχθηκαν με
    // μετάλλαξη στο **πραγματικό** αρχείο. Εδώ δεν γίνεται: το `auth-context.ts`
    // ανήκει στη Φάση 3 του ADR-787 και γράφεται από **άλλον πράκτορα** στο ΙΔΙΟ
    // working tree — μια προσωρινή μετάλλαξη ρισκάρει να κομμιταριστεί σπασμένη.
    //
    // Άρα η απόδειξη μετακινείται στο **κατηγόρημα**: ένα `toContain` που θα έλεγε
    // «ναι» και σε αρχείο χωρίς φρουρό θα ήταν ο ίδιος ο εαυτός του «0 = κανείς δεν
    // κοίταξε». Αυτό δείχνει ότι λέει «όχι» όταν ο φρουρός λείπει.
    const withoutGuard = `
      function extractCustomClaims(token) {
        return { companyId: token.companyId ?? 'default_tenant' };
      }`;
    expect(hasFailClosedGuard(withoutGuard)).toBe(false);
  });

  it('Δ2: η οθόνη της εκκρεμούς αίτησης ΕΞΑΚΟΛΟΥΘΕΙ να υπάρχει και να έχει όνομα', () => {
    // Η θεραπεία ήταν «άλλαξε η σημασία», ΟΧΙ «διαγράφηκε η ουρά»: ο επαγγελματίας
    // που ζητά είσοδο σε ΞΕΝΟ γραφείο πρέπει να συνεχίσει να περιμένει.
    expect(AUTH_ROUTES.pendingApproval).toBe('/pending-approval');
    expect(read(PENDING).length).toBeGreaterThan(0);
  });
});
