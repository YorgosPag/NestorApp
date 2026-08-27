/**
 * =============================================================================
 * Η ΥΛΟΠΟΙΗΣΗ ΕΓΓΡΑΦΟΥ — ΑΝΤΙΓΡΑΦΗ ΑΠΟ ΤΗΝ ΑΥΘΕΝΤΙΑ, ΠΟΤΕ ΕΠΙΝΟΗΣΗ (ADR-822 §4.7)
 * =============================================================================
 *
 * Ένας λογαριασμός Auth **με πραγματική εξουσία** και **χωρίς έγγραφο** είναι
 * αόρατος σε κάθε οθόνη διαχείρισης. Η προφανής θεραπεία — *«φτιάξε του
 * έγγραφο»* — είναι **ακριβώς η βλάβη του ADR-821** αν τα πεδία τα **μαντέψει**
 * ο κώδικας. Γι' αυτό η προεπιλογή της {@link ./identity-remediation} παραμένει
 * `requires-human-identification`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΔΙΑΦΟΡΑ ΑΝΑΜΕΣΑ ΣΕ «ΕΠΙΝΟΗΣΗ» ΚΑΙ «ΥΛΟΠΟΙΗΣΗ»
 * ─────────────────────────────────────────────────────────────────────────────
 * **Επινόηση** = ο κώδικας αποφασίζει τιμή που **κανένα μητρώο δεν κατέχει**
 * *(`globalRole: 'super_admin'`, `mfaEnrolled: true`, `email: 'dev@localhost'`)*.
 *
 * **Υλοποίηση** = κάθε πεδίο **αντιγράφεται από το μητρώο που το κατέχει**, και
 * ό,τι δεν κατέχει κανείς **παραλείπεται**. Είναι το `AUTHORITY_BY_QUESTION` σε
 * δράση: η ίδια αρχή που **βρήκε** το πρόβλημα, το **λύνει**.
 *
 * ⛔ **ΚΑΙ ΕΙΝΑΙ Η ΜΟΝΗ ΠΡΑΞΗ ΧΩΡΙΣ ΑΥΤΟΜΑΤΗ ΑΝΑΙΡΕΣΗ.** Η αναίρεση μιας
 * δημιουργίας είναι διαγραφή — και ο κώδικας εδώ **δεν διαγράφει ποτέ**.
 * Γι' αυτό απαιτεί **δεύτερο κλειδί**: `apply` **και** `materialiseFromAuth`,
 * ρητά και τα δύο *(dual control για τη μη-αναστρέψιμη πράξη)*.
 *
 * @module lib/auth/identity-materialisation
 * @see ADR-822 §4.7 · ADR-821 (τι σημαίνει «επινόηση ταυτότητας»)
 */

/** Ό,τι ξέρει το Firebase Auth για έναν λογαριασμό — **η αυθεντία**. */
export interface AuthProfileFacts {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly photoURL: string | null;
  readonly emailVerified: boolean;
  readonly disabled: boolean;
  /** `providerData[0].providerId` — π.χ. `google.com`, `password`. */
  readonly providerId: string | null;
  readonly creationTimeMs: number | null;
  readonly lastSignInTimeMs: number | null;
  readonly globalRoleClaim: string | null;
  readonly companyIdClaim: string | null;
}

/**
 * Τα πεδία που **γράφονται**, και **από ποιο μητρώο** το καθένα.
 *
 * ⚠️ Ο πίνακας είναι **δεδομένο**, όχι σχόλιο: μια άγκυρα τον διαβάζει και
 * απαιτεί το παραγόμενο έγγραφο να έχει **ακριβώς** αυτά τα κλειδιά. Νέο πεδίο
 * χωρίς δηλωμένη πηγή ⇒ **κόκκινη**.
 */
export const MATERIALISED_FIELDS = {
  uid: 'auth',
  email: 'auth',
  displayName: 'auth',
  photoURL: 'auth',
  emailVerified: 'auth',
  authProvider: 'auth',
  createdAt: 'auth',
  lastLoginAt: 'auth',
  /** **Παράγωγο** του `disabled` — όχι επινόηση, μετάφραση. */
  status: 'auth',
  globalRole: 'claims',
  companyId: 'claims',
  updatedAt: 'now',
} as const;

/**
 * Τα πεδία που **παραλείπονται συνειδητά**, με τον λόγο τους.
 *
 * 🔑 **Η ΠΑΡΑΛΕΙΨΗ ΕΙΝΑΙ Η ΤΙΜΙΑ ΑΠΑΝΤΗΣΗ.** Ένα `loginCount: 0` θα έλεγε
 * *«δεν συνδέθηκε ποτέ»* για άνθρωπο που **συνδέεται** — ψέμα με σχήμα αριθμού.
 * Και είναι **αυτο-θεραπευόμενο**: το `auth-context-profile.ts:90` γράφει
 * `loginCount: increment(1)` σε **merge**, άρα το πεδίο γεννιέται με **σωστή**
 * τιμή στην επόμενη σύνδεση. *Ο ιδιοκτήτης του πεδίου το συμπληρώνει.*
 */
export const OMITTED_FIELDS = {
  loginCount: 'Το γράφει η ροή σύνδεσης με increment(1). Το 0 θα ήταν ψέμα.',
  givenName: 'Το Firebase Auth δεν το κατέχει. Το συμπληρώνει ο άνθρωπος.',
  familyName: 'Το Firebase Auth δεν το κατέχει. Το συμπληρώνει ο άνθρωπος.',
  mfaEnrolled: 'Καθρέφτης του Auth. Ο ίδιος ο άνθρωπος ενεργοποιεί τον 2ο παράγοντα.',
  permissions: 'Καθρέφτης των claims. Τα γράφει η φρουρημένη set-user-claims.',
} as const;

/** Το σχέδιο υλοποίησης: τι θα γραφτεί, και η ρητή δήλωση μη-αναστρεψιμότητας. */
export interface MaterialisationPlan {
  readonly uid: string;
  /** Το πλήρες έγγραφο προς δημιουργία. Κάθε τιμή **αντιγραμμένη**. */
  readonly document: Record<string, unknown>;
  /** Τα πεδία που **δεν** γράφονται, με τον λόγο — ορατά στον εγκρίνοντα. */
  readonly omitted: Readonly<Record<string, string>>;
  readonly summary: string;
  /**
   * ⛔ `null` **επίτηδες**: η αναίρεση θα ήταν διαγραφή, και ο κώδικας δεν
   * διαγράφει. Δηλώνεται ώστε κανείς να μη νομίσει ότι ξεχάστηκε.
   */
  readonly inverse: null;
  readonly inverseNote: string;
}

/** Γιατί μια υλοποίηση **δεν** μπορεί να γίνει. */
export type NoMaterialisationReason =
  /** Λογαριασμός απενεργοποιημένος — δεν του φτιάχνουμε παρουσία. */
  | 'account-disabled'
  /** Χωρίς email, το έγγραφο δεν έχει ταυτότητα προς εμφάνιση. */
  | 'no-email-in-auth'
  /** Χωρίς `globalRole` claim δεν ξέρουμε τι είναι — και **δεν το επινοούμε**. */
  | 'no-role-claim';

export type MaterialisationOutcome =
  | { readonly kind: 'plan'; readonly plan: MaterialisationPlan }
  | { readonly kind: 'none'; readonly reason: NoMaterialisationReason };

const NO_MATERIALISATION_EXPLANATION: Readonly<Record<NoMaterialisationReason, string>> = {
  'account-disabled':
    'Ο λογαριασμός Auth είναι απενεργοποιημένος. Δεν κατασκευάζουμε παρουσία για ' +
    'ταυτότητα που δεν μπορεί να συνδεθεί — αυτό θα ήταν αντίστροφη θεραπεία.',
  'no-email-in-auth':
    'Το Firebase Auth δεν έχει email γι αυτόν τον λογαριασμό. Το έγγραφο απαιτεί ' +
    'email, και το ΜΟΝΟ μητρώο που το κατέχει δεν το έχει. Καμία επινόηση.',
  'no-role-claim':
    'Ο λογαριασμός δεν φέρει globalRole claim. Το τι επιτρέπεται το κατέχουν τα ' +
    'claims (AUTHORITY_BY_QUESTION) — και δεν το μαντεύουμε από το πουθενά.',
};

/** Η ανθρώπινη εξήγηση μιας άρνησης υλοποίησης. */
export function explainNoMaterialisation(reason: NoMaterialisationReason): string {
  return NO_MATERIALISATION_EXPLANATION[reason];
}

/**
 * *«Πώς μοιάζει το έγγραφο αυτού του λογαριασμού, αν το χτίσω ΜΟΝΟ από ό,τι
 * ξέρουν τα μητρώα;»*
 *
 * @param auth Τα γεγονότα του Firebase Auth **όπως διαβάστηκαν**.
 * @param nowMs Η στιγμή της γραφής — δίνεται από τον καλούντα, **ποτέ**
 *              `Date.now()` εδώ: καθαρή συνάρτηση, δοκιμάσιμη ντετερμινιστικά.
 */
export function planMaterialisation(auth: AuthProfileFacts, nowMs: number): MaterialisationOutcome {
  if (auth.disabled) return { kind: 'none', reason: 'account-disabled' };
  if (!auth.email) return { kind: 'none', reason: 'no-email-in-auth' };
  if (!auth.globalRoleClaim) return { kind: 'none', reason: 'no-role-claim' };

  const document: Record<string, unknown> = {
    uid: auth.uid,
    email: auth.email,
    displayName: auth.displayName,
    photoURL: auth.photoURL,
    emailVerified: auth.emailVerified,
    // ⚠️ `?? 'unknown'` και ΟΧΙ μαντεψιά παρόχου: το «δεν ξέρω» έχει όνομα, και
    //    είναι η ίδια τιμή που γράφει ήδη η `ensure-user-profile` (ADR-100).
    authProvider: auth.providerId ?? 'unknown',
    createdAt: new Date(auth.creationTimeMs ?? nowMs),
    lastLoginAt: new Date(auth.lastSignInTimeMs ?? auth.creationTimeMs ?? nowMs),
    // 🔑 **ΜΕΤΑΦΡΑΣΗ, ΟΧΙ ΑΠΟΦΑΣΗ — ΚΑΙ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΤΟΝ ΦΡΟΥΡΟ ΠΑΡΑΠΑΝΩ.**
    //    Το `'active'` είναι σωστό **επειδή** ο `disabled` απορρίφθηκε ήδη
    //    (`account-disabled`). ⚠️ Αν κάποιος χαλαρώσει εκείνον τον φρουρό, αυτή
    //    η γραμμή γίνεται **ψέμα** — απενεργοποιημένος λογαριασμός με ενεργό
    //    έγγραφο, δηλαδή το ΖΟΜΠΙ που το ίδιο το ADR-822 θεραπεύει.
    //    Η σχέση φυλάσσεται από την άγκυρα `Υ0.5`, όχι από αυτό το σχόλιο.
    //    *(Μετρημένο: μετάλλαξη σε `disabled ? 'suspended' : 'active'` είναι
    //    σήμερα **ισοδύναμη** — ακριβώς επειδή ο disabled δεν φτάνει ποτέ εδώ.)*
    status: 'active',
    globalRole: auth.globalRoleClaim,
    companyId: auth.companyIdClaim,
    updatedAt: new Date(nowMs),
  };

  return {
    kind: 'plan',
    plan: {
      uid: auth.uid,
      document,
      omitted: OMITTED_FIELDS,
      summary:
        `Υλοποίηση εγγράφου από την αυθεντία: ${Object.keys(MATERIALISED_FIELDS).length} πεδία ` +
        `αντιγραμμένα από Auth/claims, ${Object.keys(OMITTED_FIELDS).length} παραλειμμένα με λόγο. ` +
        `Ρόλος '${auth.globalRoleClaim}' από τα CLAIMS — καμία τιμή δεν επινοήθηκε.`,
      inverse: null,
      inverseNote:
        'ΜΗ ΑΝΑΣΤΡΕΨΙΜΗ ΑΠΟ ΚΩΔΙΚΑ: η αναίρεση θα ήταν διαγραφή, και ο κώδικας δεν ' +
        'διαγράφει ΠΟΤΕ. Γι αυτό απαιτεί δεύτερο κλειδί (apply + materialiseFromAuth).',
    },
  };
}
