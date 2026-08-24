/**
 * Storage paths για assets που ανήκουν σε **ΑΝΘΡΩΠΟ**, όχι σε εταιρεία (ADR-798 §16).
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ COMPANY-SCOPED — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΤΙΜΗΣΗ
 *
 * Κάθε άλλο path αυτού του δέντρου είναι `companies/{companyId}/…`, και το
 * πλησιέστερο προηγούμενο — η **σφραγίδα μηχανικού** (`engineer-stamps/{userId}`)
 * — είναι κι αυτό εταιρικό. Η φωτογραφία προφίλ όμως **δεν μπορεί** να είναι:
 *
 * Ο δείκτης της ζει στο **Firebase Auth** (`updateProfile({ photoURL })`) και
 * είναι **ΜΙΑ τιμή ανά άνθρωπο, καθολική** — δεν υπάρχει «photoURL ανά εταιρεία».
 * Αν τα bytes έμπαιναν κάτω από `companies/{A}/…` ενώ ο δείκτης είναι καθολικός,
 * τότε ο ίδιος άνθρωπος μπαίνοντας στον χώρο **{B}** θα ζητούσε ένα object του
 * **{A}**, και ο κανόνας `belongsToCompany(A)` θα το **αρνιόταν** ⇒ **σπασμένο
 * avatar**, όχι θεωρητικά αλλά κατ' ανάγκη. Η εταιρική εμβέλεια θα ήταν
 * *ασυνεπής με τον δείκτη*, δηλαδή δύο αλήθειες για ένα πράγμα (ADR-749).
 *
 * ⚠️ Η ανάγνωση παραμένει **αυστηρότερη από σήμερα**: σήμερα το `photoURL`
 * δείχνει σε `lh3.googleusercontent.com`, δηλαδή **δημόσιο** URL χωρίς καμία
 * ταυτοποίηση. Ο κανόνας εδώ απαιτεί `isAuthenticated()`.
 *
 * ⚠️ **ΜΗΝ βάλεις εδώ ό,τι είναι εταιρικό παραδοτέο** (σφραγίδες, υπογραφές,
 * σχέδια): εκείνα ανήκουν στο γραφείο και **πρέπει** να είναι company-scoped.
 *
 * @see storage.rules — `@pathId: user_avatars`
 * @see ./storage-path-bim.ts — `buildEngineerStampPath`, το εταιρικό αντίστοιχο
 */

/** Οι μορφές που παράγει ο δικός μας encoder — ποτέ ό,τι ανέβασε ο χρήστης. */
export type UserAvatarExt = 'webp' | 'png';

/**
 * Storage path της **φωτογραφίας προφίλ**.
 *
 * Το basename είναι σταθερό (`avatar`) και το `userId` είναι **φάκελος** ⇒ ο
 * κανόνας `match /users/{userId}/{fileName}` μπορεί να συγκρίνει `userId` με
 * `request.auth.uid` **χωρίς** parsing ονόματος αρχείου. Ντετερμινιστικό ⇒
 * **ιδεμπόταντ**: νέα φωτογραφία αντικαθιστά, ποτέ δεν συσσωρεύει ορφανά.
 *
 * ⚠️ Η **κατάληξη είναι μέρος του ονόματος**, οπότε αλλαγή webp→png αφήνει το
 * παλιό object πίσω. Γι' αυτό ο διαγραφέας του {@link module:services/profile/avatar-upload.service}
 * σβήνει **και τις δύο** καταλήξεις, όχι μόνο την τρέχουσα.
 */
export function buildUserAvatarPath(params: { userId: string; ext: UserAvatarExt }): string {
  return `users/${params.userId}/avatar.${params.ext}`;
}

/** Κάθε path που **μπορεί** να κρατά avatar αυτού του ανθρώπου (για καθαρισμό). */
export function allUserAvatarPaths(userId: string): readonly string[] {
  return (['webp', 'png'] as const).map((ext) => buildUserAvatarPath({ userId, ext }));
}
