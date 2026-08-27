/**
 * ADR-809 — **ΣΧΕΔΙΑΣΜΕΝΗ ΚΑΤΑΣΤΑΣΗ ΔΕΝ ΕΙΝΑΙ ΒΛΑΒΗ**.
 *
 * 🔴 **Το γεγονός** (μετρημένο 2026-08-26, ζωντανά στην κονσόλα του Giorgio): ο
 * αυτόνομος επαγγελματίας — ο persona του **ADR-807**, χωρίς `companyId` **εκ
 * σχεδιασμού** — έβλεπε κόκκινο `[ERROR] Failed to load security roles` σε
 * **κάθε φόρτωση σελίδας**, ενώ ο fallback ήταν **η σωστή απάντηση**. Ο θόρυβος
 * κρύβει τα αληθινά σφάλματα.
 *
 * ⚠️ **ΔΥΟ ΑΝΕΞΑΡΤΗΤΑ ΕΡΩΤΗΜΑΤΑ, ΔΥΟ ΟΜΑΔΕΣ ΑΓΚΥΡΩΝ** — ποτέ μία με «ή»:
 *   **Α.** ξεχωρίζει ο κριτής τη σχεδιασμένη κατάσταση από την πραγματική βλάβη;
 *   **Β.** έπαψε ο `checkUserRole` να κάνει το **νεκρό** ερώτημα Firestore;
 * Μια άγκυρα μόνο για το (Α) θα έμενε πράσινη με το round-trip να σπαταλιέται
 * σε κάθε φόρτωση· μια μόνο για το (Β) θα έμενε πράσινη με τους **άλλους**
 * καταναλωτές του `requireAuthContext` να κοκκινίζουν ακόμη.
 *
 * @jest-environment node
 */

import {
  MissingTenantError,
  MISSING_TENANT_MESSAGE,
  isMissingTenantError,
} from '@/services/firestore/auth-context';

describe('Α — ο κριτής της σχεδιασμένης κατάστασης', () => {
  test('Α1 — το τυποποιημένο σφάλμα αναγνωρίζεται', () => {
    expect(isMissingTenantError(new MissingTenantError())).toBe(true);
  });

  test('Α2 — ΔΙΧΤΥ ΚΕΙΜΕΝΟΥ: ωμό Error με το κανονικό μήνυμα αναγνωρίζεται', () => {
    // Ο πληθυσμός είναι πλέον **0** (βλ. Γ1), αλλά ο κλάδος μένει: κλειδώνει την
    // κατάσταση **πριν** ξαναεμφανιστεί (πρότυπο `Κ1` του CHECK 3.43). Πριν τη
    // μετανάστευση ο κριτής θα έβλεπε **1 στα 4** σημεία χωρίς αυτόν.
    expect(isMissingTenantError(new Error(MISSING_TENANT_MESSAGE))).toBe(true);
  });

  test('Α5 — Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΤΟ BRAND, ΟΧΙ ΤΟ `instanceof`', () => {
    // 🔴 Μέχρι 2026-08-26 το `isMissingTenant` το **έγραφε** η κλάση και δεν το
    // **διάβαζε κανείς** — αδρανής φρουρός (ADR-749 §5). Ο κριτής ρωτούσε
    // `instanceof`, που απαντά **ψευδώς `false`** όταν το module ζει σε δεύτερο
    // γράφο (Server ≠ Client, ADR-744 §15).
    //
    // ⚠️ Το **μήνυμα είναι ΑΛΛΟ επίτηδες**: αλλιώς θα περνούσε από το δίχτυ
    // κειμένου και η άγκυρα θα ήταν πράσινη **χωρίς να ασκήσει το brand**.
    const foreign = Object.assign(new Error('a message nobody compares'), {
      isMissingTenant: true as const,
    });
    expect(foreign instanceof MissingTenantError).toBe(false); // ο παρονομαστής
    expect(isMissingTenantError(foreign)).toBe(true);
  });

  test('Α6 — ΠΑΡΟΝΟΜΑΣΤΗΣ του Α5: σκέτο brand χωρίς τιμή `true` ΔΕΝ περνά', () => {
    // Χωρίς αυτό, ένα `'isMissingTenant' in error` θα ήταν εξίσου πράσινο — και
    // θα δεχόταν `{ isMissingTenant: false }`, δηλαδή ρητή **άρνηση** ως «ναι».
    expect(isMissingTenantError(Object.assign(new Error('x'), { isMissingTenant: false }))).toBe(false);
    expect(isMissingTenantError({ isMissingTenant: 'true' })).toBe(false);
  });

  test('Α3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: η ΠΡΑΓΜΑΤΙΚΗ βλάβη ΔΕΝ αναγνωρίζεται ως σχεδιασμένη', () => {
    // Χωρίς αυτό, ένα «δεν κοκκινίζει πια» θα μπορούσε να σημαίνει «τίποτα δεν
    // κοκκινίζει πια» — δηλαδή σιωπή αντί για διάκριση.
    expect(isMissingTenantError(new Error('FirebaseError: permission-denied'))).toBe(false);
    expect(isMissingTenantError(new Error('AUTHENTICATION_ERROR: User must be logged in'))).toBe(false);
    expect(isMissingTenantError(null)).toBe(false);
    expect(isMissingTenantError('AUTHORIZATION_ERROR: User is not assigned to a company')).toBe(false);
  });

  test('Α4 — το μήνυμα μένει ΑΥΤΟΥΣΙΟ (συμβατότητα με ό,τι το διαβάζει)', () => {
    expect(new MissingTenantError().message).toBe(MISSING_TENANT_MESSAGE);
  });
});

describe('Β — το υποσύστημα ρόλων ΕΦΥΓΕ, και μαζί του η λίστα email', () => {
  // ⚠️ **Η ΟΜΑΔΑ ΑΥΤΗ ΠΡΟΧΩΡΗΣΕ ΜΑΖΙ ΜΕ ΤΗ ΘΕΡΑΠΕΙΑ, ΔΕΝ ΣΒΗΣΤΗΚΕ.** Στη Φάση Α
  //    κλείδωνε την **ενδιάμεση** κατάσταση: *«η νεκρή κλήση Firestore έφυγε από
  //    την καυτή διαδρομή, **αλλά** ο `checkUserRole` μένει και κρίνει με
  //    `NEXT_PUBLIC_ADMIN_EMAILS`»*. Ο παρονομαστής της (`Β2`) απαιτούσε **ρητά**
  //    να υπάρχει η λίστα email — δηλαδή κλείδωνε το **χρέος**, σκόπιμα, μέχρι
  //    να έρθει η Φάση Β. Ήρθε: το χρέος έφυγε, άρα η άγκυρα κλειδώνει πλέον το
  //    **τελικό** συμβόλαιο. *Άγκυρα που σβήνεται επειδή «δεν ισχύει πια» παίρνει
  //    μαζί της την εγγύηση.*
  const SOURCE = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'EnterpriseSecurityService.ts'),
    'utf8',
  );

  /** Ο κώδικας του αρχείου, **χωρίς σχόλια** — η τεκμηρίωση δεν κρίνεται. */
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  test('Β1 — ΚΑΜΙΑ αναφορά στη λίστα email σε εκτελέσιμο κώδικα', () => {
    // 🔴 Ήταν η **ΜΟΝΑΔΙΚΗ** πηγή που έβαζε τα email στο bundle του browser.
    // ⚠️ Τα σχόλια κόβονται: το ίδιο το αρχείο **τεκμηριώνει** τη διαγραφή
    //    ονομάζοντας τη μεταβλητή — φρουρός που κρίνει ωμό κείμενο θα κοκκίνιζε
    //    πάνω στην τεκμηρίωση της θεραπείας (σχήμα CHECK 3.50 `Κ7β`).
    expect(CODE).not.toContain('NEXT_PUBLIC_ADMIN_EMAILS');
  });

  test('Β2 — και ΚΑΝΕΝΑΣ κριτής ρόλου δεν έμεινε πίσω', () => {
    for (const dead of [
      'checkUserRole',
      'isAdminUser',
      'loadSecurityRoles',
      'getSecurityRole',
      'getUserRoles',
    ]) {
      expect({ symbol: dead, present: CODE.includes(dead) }).toEqual({
        symbol: dead,
        present: false,
      });
    }
  });

  test('Β3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: το αρχείο ΥΠΑΡΧΕΙ και εξακολουθεί να κάνει τη δουλειά του', () => {
    // Αλλιώς τα Β1/Β2 θα ήταν πράσινα επειδή διαγράφηκε ολόκληρο το αρχείο —
    // «δεν βρήκα» αντί για «δεν υπάρχει».
    expect(SOURCE.length).toBeGreaterThan(1000);
    expect(CODE).toContain('class EnterpriseSecurityService');
    expect(CODE).toContain('loadEmailDomainPolicies');
  });

  test('Β4 — το brand ΕΧΕΙ ζωντανό αναγνώστη, αλλού', () => {
    // 🔴 Η διαγραφή του νεκρού υποσυστήματος πήρε μαζί της τον **μοναδικό**
    //    αναγνώστη του `isMissingTenantError` (ζούσε μέσα στο `loadSecurityRoles`).
    //    Χωρίς αντικατάσταση, το brand της Φάσης Α θα επέστρεφε σε **0
    //    αναγνώστες** — δηλαδή σε ταυτότητα που κανείς δεν ρωτά, ενώ **4** σημεία
    //    πετούν το σφάλμα. Ο χειρισμός μετακόμισε εκεί που το σφάλμα **φτάνει**.
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.join(__dirname, '..', '..', '..');
    const readers = [
      path.join(root, 'hooks', 'useFirestoreNotifications.ts'),
      // ⚠️ **ΜΕΤΑΚΟΜΙΣΕ 2026-08-26 (ADR-798 §21)**: ήταν ο `useRealtimeBuildings`,
      //    ο **μόνος** από τους πέντε αδελφούς που ρωτούσε. Όταν το CHECK 3.28
      //    επέβαλε εξαγωγή, ο αναγνώστης έγινε **ΕΝΑΣ** για όλους. Η πρόθεση αυτής
      //    της άγκυρας δεν άλλαξε: το brand δεν επιτρέπεται να ξαναγίνει **0
      //    αναγνώστες** ενώ σημεία πετούν το σφάλμα.
      path.join(root, 'services', 'realtime', 'hooks', 'tenant-scoped-error.ts'),
    ];
    for (const file of readers) {
      const src = fs.readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, '');
      expect({ file: path.basename(file), reads: src.includes('isMissingTenantError(') }).toEqual({
        file: path.basename(file),
        reads: true,
      });
    }
  });
});

describe('Γ — η μετανάστευση των τριών (ADR-811)', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const SRC = path.join(__dirname, '..', '..', '..');

  /**
   * ⚠️ **Η ΛΙΣΤΑ ΕΙΝΑΙ ΙΣΤΟΡΙΚΟ ΓΕΓΟΝΟΣ, ΟΧΙ ΠΟΛΙΤΙΚΗ.** Είναι τα τρία σημεία
   * που ονομάζει το ADR-809 §8.5 — δεν επιτρέπεται να «αποκλίνει» γιατί δεν
   * περιγράφει κανόνα. Ο **γενικός** κανόνας («ωμό `Error` με το κανονικό
   * μήνυμα εξακολουθεί να αναγνωρίζεται») τον κρατά το `Α2`, όχι σαρωτής: μια
   * πλήρης σάρωση του `src/` κοστίζει **3,5s** και θα φύλαγε κατάσταση που το
   * δίχτυ κειμένου κάνει ήδη **αβλαβή** — αδρανής φρουρός (ADR-749 §5).
   */
  const MIGRATED = [
    'services/contacts.service.ts',
    'services/obligations/InMemoryObligationsRepository.ts',
    'services/obligations/obligation-transmittal-operations.ts',
  ] as const;

  test.each(MIGRATED)('Γ1 — %s πετά ΤΥΠΟΠΟΙΗΜΕΝΟ σφάλμα, όχι ωμό Error', (rel) => {
    const source = fs.readFileSync(path.join(SRC, rel), 'utf8');
    expect(source).toContain('new MissingTenantError()');
    expect(source).not.toContain("new Error('AUTHORIZATION_ERROR:");
  });

  test('Γ2 — ΤΟ ΑΟΡΑΤΟ: το μήνυμα του transmittal ΔΕΝ ήταν το κανονικό', () => {
    // Πριν το ADR-811 το `obligation-transmittal-operations.ts` έγραφε
    // `'AUTHORIZATION_ERROR: Missing companyId for transmittal issuance'` —
    // **άλλο μήνυμα** ⇒ το δίχτυ κειμένου του `Α2` ήταν **δομικά τυφλό** εκεί,
    // και ένας κριτής «καθαρός» επειδή **δεν κοίταξε**. Ο παρονομαστής:
    expect(isMissingTenantError(new Error('AUTHORIZATION_ERROR: Missing companyId for transmittal issuance'))).toBe(false);
    // ...και σήμερα το σημείο πετά ταυτότητα, άρα αναγνωρίζεται:
    const source = fs.readFileSync(path.join(SRC, MIGRATED[2]), 'utf8');
    expect(source).not.toContain('Missing companyId for transmittal issuance');
    expect(isMissingTenantError(new MissingTenantError())).toBe(true);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Δ — 🔴 Η ΚΛΑΣΗ, ΟΧΙ ΤΟ ΔΕΙΓΜΑ (ADR-798 §21)
 *
 * Το ADR-809 έκλεισε τη βλάβη σε **έναν** καταναλωτή. Ζωντανά 2026-08-26, ο
 * αυτόνομος στο `/account/profile` έβγαλε **ξανά** κόκκινο — από
 * `useRealtimeProperties`, **αδελφό** που κανείς δεν κοίταξε.
 *
 * Μετρημένο: από τα realtime hooks με **εταιρικό** εύρος και χειριστή σφάλματος,
 * **1 στους 5** ρωτούσε τον κριτή. Τα υπόλοιπα τέσσερα λογούσαν `[ERROR]` πάνω σε
 * **σχεδιασμένη** κατάσταση, και ο θόρυβος κρύβει τα αληθινά σφάλματα.
 *
 * ✅ **ΚΑΙ ΠΛΕΟΝ ΕΙΝΑΙ 5 ΣΤΟΥΣ 5 — ΧΩΡΙΣ ΝΑ ΤΟ ΘΥΜΑΤΑΙ ΚΑΝΕΙΣ** (§22): ο κύκλος
 * ζωής εξήχθη σε **μία** μηχανή, και η μόνη διαδρομή προς συνδρομή περνά από τον
 * κριτή. Το ερώτημα άλλαξε από *«ρώτησαν όλοι;»* σε *«μπορεί κάποιος να μη
 * ρωτήσει;»* — και η απάντηση είναι **όχι**.
 *
 * ⚠️ **Ο `useOwnedDocuments` ΔΕΝ είναι στη λίστα, και είναι απόφαση**: το
 * `tenant-config.ts` τον δηλώνει `mode: 'userId'` ⇒ ιδιωτικό εύρος, **δομικά
 * αδύνατο** να πετάξει `MissingTenantError`. Φρουρός εκεί θα ήταν αδρανής.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe('Δ — ΟΛΟΙ οι εταιρικοί realtime αδελφοί ρωτούν τον κριτή', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const SRC = path.join(__dirname, '..', '..', '..');
  const HOOKS = path.join(SRC, 'services', 'realtime', 'hooks');

  /** Εταιρικό εύρος **και** χειριστή σφάλματος ⇒ μπορεί να δει τη σχεδιασμένη κατάσταση. */
  const TENANT_SCOPED = [
    'useRealtimeBuildings.ts',
    'useRealtimeProperties.ts',
    'useRealtimeOpportunities.ts',
    'useRealtimePropertiesTrashCount.ts',
    'useRealtimeTasks.ts',
  ];

  /** Ο κώδικας ενός αρχείου, **χωρίς σχόλια** — η τεκμηρίωση δεν κρίνεται ποτέ. */
  const codeOf = (file: string): string =>
    fs
      .readFileSync(path.join(HOOKS, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  test('Δ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τα αρχεία υπάρχουν και ΟΛΑ χτίζονται από τη ΜΙΑ μηχανή', () => {
    // Χωρίς αυτό, μια μετονομασία θα έκανε το `Δ1` πράσινο πάνω σε **κενό σύνολο**.
    for (const f of TENANT_SCOPED) {
      expect({ file: f, built: codeOf(f).includes('createRealtimeCollectionHook<') }).toEqual({
        file: f,
        built: true,
      });
    }
  });

  /**
   * ⚠️ **ΑΥΤΗ Η ΑΓΚΥΡΑ ΞΑΝΑΓΡΑΦΤΗΚΕ ΔΥΟ ΦΟΡΕΣ. ΚΑΘΕ ΦΟΡΑ ΕΓΙΝΕ ΙΣΧΥΡΟΤΕΡΗ.**
   *
   * **Γραφή 1** — `toContain('isMissingTenantError')`: απεδείκνυε ότι υπάρχει η
   * **εισαγωγή**, όχι ότι ο φρουρός **τρέχει**. Με `if (false)` έμενε ΠΡΑΣΙΝΗ
   * πάνω σε νεκρό φρουρό, σε **δύο** αρχεία.
   *
   * **Γραφή 2** — `toContain('routeTenantScopedError(')` σε **κάθε** αδέλφι:
   * απεδείκνυε ότι ο καθένας **θυμήθηκε** να ρωτήσει. Καλύτερη, αλλά κρατούσε
   * την εγγύηση **πέντε φορές** — και μια εγγύηση επαναλαμβανόμενη πέντε φορές
   * μπορεί να ξεχαστεί σε ένα έκτο αδέλφι που θα γραφτεί αύριο.
   *
   * 🔑 **Γραφή 3 (ADR-798 §22) — Η ΑΓΚΥΡΑ ΤΟΥ ΑΔΥΝΑΤΟΥ, ΟΧΙ ΤΟΥ ΘΥΜΗΘΗΚΑ.**
   * Η κλήση **μετακόμισε** στο `create-realtime-collection-hook.ts`, και αυτό
   * **δεν είναι αποδυνάμωση**: η προηγούμενη γραφή χαρακτήριζε **ΥΛΟΠΟΙΗΣΗ**
   * *(«πού είναι γραμμένη η κλήση;»)*, ενώ το **ΣΥΜΒΟΛΑΙΟ** ήταν πάντα
   * *«σχεδιασμένη κατάσταση δεν αναφέρεται ως βλάβη»*. Σήμερα κανένα αδέλφι
   * **δεν έχει πού** να παρακάμψει τον κριτή: δεν αγγίζει `subscribe`, δεν
   * αγγίζει `onSnapshot`. Δεν είναι «θυμήθηκαν όλοι» — είναι **δομικά αδύνατο**
   * να ξεχάσουν.
   *
   * 🔑 Η **σημασιολογία** δοκιμάζεται **εκτελώντας** τη μηχανή, ποτέ διαβάζοντας
   * πηγή: `services/realtime/hooks/__tests__/create-realtime-collection-hook.test.tsx`
   * (ομάδα `Β`, μεταλλάξεις 5/5 κόκκινες). Εδώ: «είναι αδύνατη η παράκαμψη;».
   * Εκεί: «λέει το σωστό;». Δύο ερωτήματα, δύο άγκυρες.
   */
  test.each(TENANT_SCOPED)('Δ1 — %s ΔΕΝ ΜΠΟΡΕΙ να παρακάμψει τον κριτή', (file) => {
    const code = codeOf(file);
    // Καμία ιδιωτική συνδρομή ⇒ καμία ιδιωτική διαδρομή σφάλματος.
    expect(code).not.toContain('firestoreQueryService.subscribe');
    expect(code).not.toContain('onSnapshot(');
    // ⚠️ Κανένας δεύτερος, inline κριτής: μία ερώτηση, μία απάντηση (ADR-749).
    expect(code).not.toContain('isMissingTenantError');
  });

  /**
   * 🔑 **ΓΡΑΦΗ 2 (2026-08-27, ADR-798 §22.8.1) — ΤΟ ΙΔΙΟ ΜΑΘΗΜΑ, ΔΕΥΤΕΡΗ ΦΟΡΑ.**
   *
   * Η προηγούμενη γραφή ζητούσε `routeTenantScopedError(` **μέσα στη μηχανή** —
   * δηλαδή, ξανά, **ΥΛΟΠΟΙΗΣΗ** *(«πού είναι γραμμένη η κλήση;»)* αντί για
   * **ΣΥΜΒΟΛΑΙΟ**. Και κοκκίνισε ακριβώς όπως προβλέπει το σχόλιο του `Δ1`: η
   * κλήση **μετακόμισε** ξανά, αυτή τη φορά στο `subscription-error-handler.ts`,
   * όταν ο χειριστής σφάλματος έγινε κοινός με τα hooks **αντιδραστικού
   * κλειδιού** *(που είχαν σιωπηλή κατάποση, §22.6 #2)*.
   *
   * Η άγκυρα ζητά πλέον την **ΑΛΥΣΙΔΑ**, όχι μία γραμμή: η μηχανή στήνει
   * συνδρομή · ο χειριστής της είναι ο **κοινός** · και ο κοινός ρωτά τον
   * **ΕΝΑ** κριτή. Κάθε κρίκος που σπάει, κοκκινίζει — και η μετακόμιση της
   * κλήσης **μέσα** στην αλυσίδα δεν την ενοχλεί.
   *
   * ⚠️ Η **σημασιολογία** *(«λέει το σωστό;»)* δοκιμάζεται εκτελώντας, σε δύο
   * σουίτες: `create-realtime-collection-hook.test.tsx` (ομάδα `Β`) και
   * `use-keyed-realtime-subscription.test.tsx` (ομάδα `Γ`, «οι δύο σιωπές»).
   *
   * 🔴 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ, ΜΕΤΡΗΜΕΝΟ ΚΑΙ ΟΧΙ ΥΠΟΤΙΘΕΜΕΝΟ (2026-08-27).** Μια άγκυρα
   * κειμένου αποδεικνύει *«η κλήση είναι ΓΡΑΜΜΕΝΗ»*, **ποτέ** *«είναι
   * ΣΥΝΔΕΔΕΜΕΝΗ»*. Μετάλλαξη που άφησε τη δήλωση
   * `const handleSubscriptionError = createSubscriptionErrorHandler({…})` άθικτη
   * αλλά έδωσε στο `subscribe` **no-op** χειριστή, έμεινε **ΠΡΑΣΙΝΗ εδώ** — και
   * βγήκε **ΚΟΚΚΙΝΗ** *(3 tests)* στην **εκτελεστική** σουίτα. Δεν είναι
   * ισοδύναμη μετάλλαξη· είναι το σύνορο των δύο άγκυρων, και μετρήθηκε.
   * ⛔ **ΜΗΝ** επικαλεστείς αυτό το test ως απόδειξη καλωδίωσης.
   */
  test('Δ1β — και η ΜΙΑ μηχανή ρωτά τον ΕΝΑ κριτή, μέσω της ΜΙΑΣ αλυσίδας', () => {
    // Ο παρονομαστής του Δ1: χωρίς αυτό, το «κανείς δεν στήνει συνδρομή» θα
    // έμενε πράσινο και σε έναν κόσμο όπου **καμία** συνδρομή δεν στήνεται
    // πουθενά — δηλαδή «δεν βρήκα» αντί για «περνά από τον κριτή».
    const engine = codeOf('create-realtime-collection-hook.ts');
    expect(engine).toContain('firestoreQueryService.subscribe<');

    // Κρίκος 1: η μηχανή δίνει στο `subscribe` τον ΚΟΙΝΟ χειριστή…
    expect(engine).toContain('createSubscriptionErrorHandler(');
    // …και ΔΕΝ κρατά δεύτερο, inline κριτή (ADR-749: μία ερώτηση, μία απάντηση).
    expect(engine).not.toContain('isMissingTenantError');

    // Κρίκος 2: ο κοινός χειριστής ρωτά τον ΕΝΑ κριτή.
    const handler = codeOf('subscription-error-handler.ts');
    expect(handler).toContain('routeTenantScopedError(');

    // Κρίκος 3: και ο κύκλος ζωής με αντιδραστικό κλειδί περνά από τον ΙΔΙΟ
    // χειριστή — αλλιώς τα τρία hooks των ορόφων θα ξανάπεφταν στη σιωπή.
    const keyed = codeOf('use-keyed-realtime-subscription.ts');
    expect(keyed).toContain('createSubscriptionErrorHandler(');
    expect(keyed).not.toContain('isMissingTenantError');
  });

  test('Δ2 — ο ιδιωτικός αδελφός ΔΕΝ μπαίνει στη λίστα: φρουρός χωρίς πληθυσμό', () => {
    const src = fs.readFileSync(path.join(HOOKS, 'useOwnedDocuments.ts'), 'utf8');
    expect(src).toContain("mode: 'userId'");
    expect(TENANT_SCOPED).not.toContain('useOwnedDocuments.ts');
  });

  /**
   * 🔴 Ο πελάτης ΔΕΝ σπέρνει διαμόρφωση. Το `firestore.rules` λέει
   * `allow write: if false; // Admin/server only` για το `config` — **ρητή
   * απόφαση**, όχι κενό. Η παλιά `initializeDefaultConfig()` ήταν **δομικά
   * αδύνατη για κάθε χρήστη** και έβγαζε `[ERROR] PERMISSION_DENIED` σε **κάθε**
   * φόρτωση σελίδας.
   */
  test('Δ3 — καμία απόπειρα σποράς διαμόρφωσης από τον φυλλομετρητή', () => {
    const rules = fs.readFileSync(path.join(SRC, '..', 'firestore.rules'), 'utf8');
    // Ο παρονομαστής: ο κανόνας όντως απαγορεύει — αλλιώς το επόμενο δεν σημαίνει τίποτα.
    expect(rules).toMatch(/match \/config\/\{configId\} \{[^}]*allow write: if false/);

    // ⚠️ Κρίνεται ο **ΚΩΔΙΚΑΣ**, ποτέ το κείμενο: το ίδιο αρχείο **αναφέρει** τη
    //    νεκρή μέθοδο σε σχόλιο που τεκμηριώνει τη θεραπεία. Άγκυρα πάνω στη λέξη
    //    θα κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ (σχήμα `Κ7β` του CHECK 3.50) — και
    //    κοκκίνισε, την πρώτη φορά που γράφτηκε.
    const svc = fs.readFileSync(path.join(SRC, 'services', 'routes', 'EnterpriseRouteConfigService.ts'), 'utf8');
    const code = svc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('initializeDefaultConfig');
    expect(code).not.toContain('configWithTenant');
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Ε — Ο ΔΡΟΜΟΛΟΓΗΤΗΣ **ΕΚΤΕΛΕΙΤΑΙ**, ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ (ADR-798 §21)
 *
 * Το `Δ1` αποδεικνύει **καλωδίωση** (ποιος τον καλεί). Αυτό αποδεικνύει
 * **σημασιολογία** (τι απαντά). Μια άγκυρα μόνο για το πρώτο θα έμενε πράσινη
 * με τον δρομολογητή να καλεί **πάντα** τον λάθος κλάδο.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe('Ε — ο δρομολογητής της σχεδιασμένης κατάστασης', () => {
  const { routeTenantScopedError } = require('@/services/realtime/hooks/tenant-scoped-error');

  it('Ε1 — «δεν ανήκεις σε εταιρεία» ⇒ ΚΕΝΟ αποτέλεσμα, ΠΟΤΕ θόρυβος', () => {
    const empty = jest.fn();
    const fail = jest.fn();
    routeTenantScopedError(new MissingTenantError(), empty, fail);
    expect(empty).toHaveBeenCalledTimes(1);
    expect(fail).not.toHaveBeenCalled();
  });

  it('Ε2 — ΠΡΑΓΜΑΤΙΚΗ βλάβη περνά ΑΝΕΠΑΦΗ στον χειριστή σφάλματος', () => {
    // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς αυτό, ένας δρομολογητής που καλεί **πάντα** το
    //    `onDesignedEmpty` θα περνούσε το `Ε1` και θα **έθαβε κάθε σφάλμα**.
    const empty = jest.fn();
    const fail = jest.fn();
    routeTenantScopedError(new Error('PERMISSION_DENIED: real breakage'), empty, fail);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(empty).not.toHaveBeenCalled();
  });

  it('Ε3 — ΔΙΧΤΥ ΚΕΙΜΕΝΟΥ: ωμό Error με το κανονικό μήνυμα δρομολογείται σωστά', () => {
    const empty = jest.fn();
    const fail = jest.fn();
    routeTenantScopedError(new Error(MISSING_TENANT_MESSAGE), empty, fail);
    expect(empty).toHaveBeenCalledTimes(1);
  });
});
