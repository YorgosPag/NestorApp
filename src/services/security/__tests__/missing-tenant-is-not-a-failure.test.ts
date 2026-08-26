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
      path.join(root, 'services', 'realtime', 'hooks', 'useRealtimeBuildings.ts'),
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
