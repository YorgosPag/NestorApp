import { deleteField, doc, getDoc, increment, setDoc, type Firestore } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfileDocument } from '@/auth/types/auth.types';
import type { DeclaredOccupation } from '@/types/professional-identity';
import { API_ROUTES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AuthContextProfile');

const NO_OCCUPATION: DeclaredOccupation = {};

/**
 * Το δηλωμένο επάγγελμα **από το έγγραφο που ήδη διαβάζεται** (ADR-798 Φάση 2).
 *
 * 🔑 **ΜΗΔΕΝ ΕΠΙΠΛΕΟΝ I/O — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΛΟΣ Ο ΣΧΕΔΙΑΣΜΟΣ.** Το `getDoc`
 * παρακάτω γινόταν **ήδη** σε κάθε σύνδεση, και το αποτέλεσμά του **πεταγόταν**.
 * Το επάγγελμα ζει στο Firestore και **ποτέ στα claims** (Α4), οπότε ο μόνος
 * τρόπος να το δει ο browser χωρίς νέο αίτημα είναι να **μη χαθεί** αυτή η
 * ανάγνωση.
 *
 * ⛔ **ΜΗΝ γράψεις hook που κάνει `getDoc` για να το βρει.** Θα ήταν I/O σε
 * κάθε σελίδα — ακριβώς η προειδοποίηση του `useEffectivePermissions.ts:27-30`.
 */
export type SyncedProfile = { readonly occupation: DeclaredOccupation };

/** Κρατά **μόνο** τα τέσσερα πεδία· ό,τι άλλο κουβαλά το έγγραφο δεν αφορά. */
function readOccupation(data: Record<string, unknown> | undefined): DeclaredOccupation {
  const pick = (key: string): string | undefined =>
    typeof data?.[key] === 'string' && (data[key] as string).length > 0
      ? (data[key] as string)
      : undefined;

  return {
    profession: pick('profession'),
    escoUri: pick('escoUri'),
    escoLabel: pick('escoLabel'),
    iscoCode: pick('iscoCode'),
  };
}

export async function syncUserProfileToFirestore(
  db: Firestore,
  firebaseUser: FirebaseUser,
  customClaims: Record<string, unknown>,
): Promise<SyncedProfile> {
  const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);

  try {
    const userSnapshot = await getDoc(userDocRef);
    const now = new Date();
    const authProvider = firebaseUser.providerData[0]?.providerId ?? 'unknown';

    if (!userSnapshot.exists()) {
      // ADR-660: νέος χρήστης χωρίς tenant claim → 'pending' (εκκρεμεί έγκριση
      // admin), όχι 'active'. Το server SSoT (ensurePendingRegistration) είναι ο
      // authoritative writer· εδώ κρατάμε το client JIT profile συνεπές.
      const hasTenant = typeof customClaims.companyId === 'string' && customClaims.companyId.length > 0;
      const newProfile: UserProfileDocument = {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName ?? null,
        givenName: null,
        familyName: null,
        photoURL: firebaseUser.photoURL ?? null,
        companyId: typeof customClaims.companyId === 'string' ? customClaims.companyId : null,
        globalRole: typeof customClaims.globalRole === 'string' ? customClaims.globalRole : null,
        status: hasTenant ? 'active' : 'pending',
        emailVerified: firebaseUser.emailVerified,
        loginCount: 1,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        authProvider,
      };

      await setDoc(userDocRef, newProfile, { merge: true });
      logger.info('[AuthContext] User profile created successfully');
      // Νέο έγγραφο ⇒ κανένα δηλωμένο επάγγελμα ακόμη. `unknown`, όχι «κανένα»
      // (ADR-798 §7): η απουσία τιμής ΔΕΝ είναι δήλωση ότι δεν έχει επάγγελμα.
      return { occupation: NO_OCCUPATION };
    }

    const existingData = userSnapshot.data();
    await setDoc(userDocRef, {
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? null,
      photoURL: firebaseUser.photoURL ?? null,
      emailVerified: firebaseUser.emailVerified,
      lastLoginAt: now,
      loginCount: increment(1),
      updatedAt: now,
      companyId: typeof customClaims.companyId === 'string'
        ? customClaims.companyId
        : existingData.companyId ?? null,
      globalRole: typeof customClaims.globalRole === 'string'
        ? customClaims.globalRole
        : existingData.globalRole ?? null,
      authProvider,
    }, { merge: true });

    logger.info('[AuthContext] User profile updated successfully');
    return { occupation: readOccupation(existingData) };
  } catch (syncError) {
    logger.warn('[AuthContext] User profile sync failed (non-blocking)', { error: syncError });
    // ⚠️ Ο συγχρονισμός είναι **μη μπλοκαριστικός** εξ αρχής. Αποτυχία ⇒ κενό
    // επάγγελμα, που ο καταναλωτής διαβάζει ως `unknown` — ΠΟΤΕ ως «δεν έχει».
    return { occupation: NO_OCCUPATION };
  }
}

/**
 * ADR-798 Φάση 3 (Κ4) — Η **ΔΗΛΩΣΗ** του επαγγέλματος από τον ίδιο τον χρήστη.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ `useAuthActions.ts`
 *
 * Το `updateUserProfile()` γράφει σε **Firebase Auth** *(`updateProfile`)* και
 * **localStorage** — **ποτέ** στο Firestore. Το επάγγελμα ζει στο
 * `users/{uid}`, δηλαδή σε **άλλο αποθετήριο**. Το `useAuthActions` δεν αγγίζει
 * Firestore πουθενά· προσθέτοντάς το εκεί θα ανακάτευα δύο συστήματα
 * αποθήκευσης σε ένα module. **Αυτό** το αρχείο κατέχει ήδη το `users/{uid}`
 * από τον πελάτη *(`setDoc(merge:true)` παραπάνω)* — ο γραφέας μπαίνει δίπλα
 * στον αναγνώστη του, όχι σε δεύτερο σπίτι.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔒 Ο ΓΡΑΦΕΑΣ ΕΠΙΒΑΛΛΕΙ ΟΤΙ Ο ΤΥΠΟΣ **ΤΕΚΜΗΡΙΩΝΕΙ ΑΛΛΑ ΔΕΝ ΜΠΟΡΕΙ**
 *
 * Το `DeclaredOccupation` λέει ότι τα **τρία πεδία ESCO πάνε ΠΑΝΤΑ μαζί**, και
 * ρητά ότι *«ο τύπος δεν μπορεί να το επιβάλει· ο **γραφέας** οφείλει»*. Εδώ
 * επιβάλλεται: **χωρίς `escoUri`, καθαρίζονται και το `escoLabel` και το
 * `iscoCode`**. Έτσι ο **ορφανός κωδικός γίνεται δομικά αδύνατος**.
 *
 * 🔑 Είναι **belt-and-suspenders** (N.7.2 #4) με το `useDeclaredOccupation`: ο
 * **αναγνώστης** αρνείται να **εκθέσει** ορφανό κωδικό, ο **γραφέας** αρνείται
 * να τον **γεννήσει**. Οι δύο άμυνες είναι ανεξάρτητες επίτηδες — δεδομένα από
 * import ή χειρόγραφη επεξεργασία δεν περνούν από εδώ.
 *
 * ⚠️ **`deleteField()`, ποτέ `''` και ποτέ `undefined`**: το `setDoc` πετάει σε
 * `undefined`, ενώ το κενό string θα άφηνε **ψεύτικο δεδομένο** που ο επόμενος
 * αναγνώστης θα έπρεπε να θυμηθεί να φιλτράρει. Σύμβαση του δέντρου —
 * `contacts.service.ts:334`, ίδια περίπτωση *(ρητό «clear» του χρήστη)*.
 *
 * ⛔ **ΜΗΝ γράψεις εδώ `occupationVerification`** — είναι **server-owned** στα
 * `firestore.rules` και η εγγραφή θα απορριφθεί *(σωστά: ADR-798 §7)*.
 *
 * @returns Ό,τι **γράφτηκε πραγματικά** — ώστε η κατάσταση να τεθεί από το
 *   αποτέλεσμα, όχι από ό,τι πληκτρολογήθηκε.
 */
export async function saveDeclaredOccupation(
  db: Firestore,
  uid: string,
  occupation: DeclaredOccupation,
): Promise<DeclaredOccupation> {
  const clean = (value: string | undefined): string | undefined => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const profession = clean(occupation.profession);
  const escoUri = clean(occupation.escoUri);
  // 🔒 Η συνοχή των τριών: χωρίς αυθεντία (`escoUri`) δεν υπάρχει ταξινόμηση.
  const escoLabel = escoUri === undefined ? undefined : clean(occupation.escoLabel);
  const iscoCode = escoUri === undefined ? undefined : clean(occupation.iscoCode);

  const written: DeclaredOccupation = { profession, escoUri, escoLabel, iscoCode };
  const payload: Record<string, unknown> = { updatedAt: new Date() };
  for (const [field, value] of Object.entries(written)) {
    payload[field] = value ?? deleteField();
  }

  await setDoc(doc(db, COLLECTIONS.USERS, uid), payload, { merge: true });
  logger.info('[AuthContext] Declared occupation saved', { classified: escoUri !== undefined });
  return written;
}

export async function ensureDevUserProfile(): Promise<void> {
  // Ο φρουρός ζει ΕΔΩ, όχι στο call site: η συνάρτηση γράφει `users/dev-admin` με
  // `globalRole: 'admin'` μέσω Admin SDK (παρακάμπτει τους Firestore rules). Αν ο έλεγχος
  // περιβάλλοντος έμενε στον καλούντα, κάθε νέος καλών θα τον ξανάγραφε — και μία παράλειψη
  // αρκεί για να γεννηθεί ψεύτικος λογαριασμός στην παραγωγή. Ένα σημείο, αδύνατο να παρακαμφθεί.
  if (process.env.NODE_ENV !== 'development') return;

  try {
    const response = await fetch(API_ROUTES.ADMIN.ENSURE_USER_PROFILE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: 'dev-admin',
        email: 'dev@localhost',
        displayName: 'Dev Admin',
        givenName: 'Dev',
        familyName: 'Admin',
        globalRole: 'admin',
        authProvider: 'development-bypass',
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json() as { created?: boolean };
    if (data.created) {
      logger.info('[AuthContext] Dev-admin user profile created via Admin SDK');
    }
  } catch (devError) {
    logger.warn('[AuthContext] Failed to create dev-admin profile (non-blocking)', { error: devError });
  }
}
