/**
 * 🗝️ **ΣΕ ΠΟΙΟΝ ΑΝΗΚΕΙ ΕΝΑ ΑΠΟΘΗΚΕΥΜΕΝΟ ΕΓΓΡΑΦΟ** — ADR-866 §5.2 · ADR-195 · ADR-864 Φ1β
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΤΕΙΧΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το έργο γεννήθηκε με ένα αξίωμα: *κάθε αποθηκευμένο έγγραφο ανήκει σε εταιρεία*. Ο ιδιώτης
 * **δεν έχει και δεν επιτρέπεται να αποκτήσει** `companyId` (ADR-787 Ε-3 §3). Το ίδιο τείχος
 * χτυπήθηκε **δύο φορές**: στο ιστορικό (ADR-864 Φ1β, λύθηκε 2026-09-16) και στα αρχεία
 * (ADR-866 Φ0). Η απάντηση είναι **μία** — ζει εδώ — και κάθε σύστημα δηλώνει **μόνο** πού
 * ζουν τα δύο διαμερίσματά του ({@link CustodyPartition}).
 *
 * 🔴 **Γιατί εξήχθη** (2026-09-17): το ADR-866 ζητούσε «ίδιο σχήμα με το `audit-ledger.ts`».
 * Κατά γράμμα αυτό θα ήταν **δεύτερο αντίγραφο** της ίδιας ένωσης, του ίδιου συνόρου ανάγνωσης
 * και του ίδιου λεξιλογίου `'company' | 'personal'`. Δύο αντίγραφα αποκλίνουν· ένα όχι.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΑΠΑΝΤΗΣΗ — ΔΙΑΚΡΙΤΗ ΕΝΩΣΗ, ΠΑΝΤΟΥ ΤΟ ΙΔΙΟ ΣΧΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   `{ companyId }` — ανήκει σε **εταιρεία** (ό,τι ίσχυε πάντα)
 *   `{ userId }`    — ανήκει σε **άνθρωπο**
 *
 * Τα ονόματα **δεν εφευρέθηκαν**: είναι τα μέλη του `WorkspaceRef`
 * (`types/workspace-membership.ts`), και το `userId` είναι ήδη το `fieldName` της λειτουργίας
 * `mode: 'userId'` του `tenant-config.ts` (π.χ. `NOTIFICATIONS`).
 *
 * ⚠️ **ΤΟ `userId` ΕΙΝΑΙ Ο ΚΑΤΟΧΟΣ, ΟΧΙ Ο ΔΡΑΣΤΗΣ.** Ο δράστης είναι `performedBy` /
 * `createdBy`. Σήμερα συχνά συμπίπτουν· **δεν** είναι το ίδιο ερώτημα (ο μεσίτης ανεβάζει ως
 * καλεσμένος στον φάκελο του ιδιοκτήτη — ADR-866 §5.6.1).
 *
 * ⛔ **ΜΗΝ το ονομάσεις `ownerUserId`**: το ADR-777 §8.33 μετονόμασε ρητά ένα τέτοιο πεδίο,
 * επειδή το «owner» έδειχνε σε κάποιον που δεν κατέχει τίποτα.
 *
 * 🔴 **ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ, ΟΧΙ ΔΙΑΚΛΑΔΩΣΗ.** Οι κανόνες Firestore **δεν φιλτράρουν**: μια συνθήκη
 * «μόνο έγγραφα με `companyId`» θα απέρριπτε **ολόκληρο** το αφιλτράριστο ερώτημα του super
 * admin, γιατί το ερώτημα δεν μπορεί να αποδείξει ότι δεν θα συναντήσει προσωπικό έγγραφο. Με
 * διαμέρισμα ανά κάτοχο ο εταιρικός κανόνας μένει **ανέγγιχτος** και ο προσωπικός είναι **μία**
 * συνθήκη: `userId == request.auth.uid`.
 *
 * 🔑 **Το `?: never` είναι ο φρουρός.** Έγγραφο **και** με τα δύο δεν μεταγλωττίζεται — και οι
 * υπάρχοντες καλούντες με `companyId` μένουν **ανέγγιχτοι**, γιατί είναι ήδη το μέλος εταιρείας.
 *
 * 🏆 **Πρότυπο**: Google Drive — κάθε αρχείο ζει σε **ακριβώς ένα** δίσκο («Ο Δίσκος μου» ενός
 * ανθρώπου **ή** κοινόχρηστος δίσκος οργανισμού), και η μετακίνηση **αλλάζει τον κάτοχο**·
 * Figma — ο admin οργανισμού **δεν** βλέπει τα Drafts μέλους· GitHub — security log λογαριασμού
 * vs audit log οργανισμού. Εδώ τα διαμερίσματα είναι **του ίδιου συστήματος**, με **έναν**
 * αναγνώστη, και ο κάτοχος **παράγεται** από τον χώρο — δεν τον διαλέγει κανείς.
 *
 * **Layering**: leaf — κανένα `server-only`, καμία ανάγνωση. Το εισάγουν διακομιστής και πελάτης.
 *
 * @module lib/workspace/custody-scope
 */

import type { CollectionKey } from '@/config/firestore-collections';
import type { WorkspaceRef } from '@/types/workspace-membership';

/** Ανήκει σε **εταιρεία** — τον μισθωτή. */
interface CompanyCustody {
  readonly companyId: string;
  readonly userId?: never;
}

/** Ανήκει σε **άνθρωπο** — και τη διαβάζει μόνο εκείνος (ή όσοι εκείνος καλέσει). */
interface PersonalCustody {
  readonly userId: string;
  readonly companyId?: never;
}

/** Ο κάτοχος ενός εγγράφου — **ακριβώς ένας** από τους δύο. */
export type CustodyScope = CompanyCustody | PersonalCustody;

/**
 * Ο κάτοχος ως **είδος**, χωρίς ταυτότητα — ό,τι επιτρέπεται να ταξιδέψει στο σύρμα.
 *
 * 🔴 **Δεν ταξιδεύει ποτέ `userId` στο σύρμα** (ίδιο δόγμα με το `RequestedWorkspace` του
 * ADR-787 Ε-5): το προσωπικό διαμέρισμα που μπορεί να ζητηθεί είναι **πάντα** του συνδεδεμένου,
 * και ο διακομιστής φιλτράρει με το **δικό του** `uid`.
 */
export type CustodyKind = 'company' | 'personal';

/** Τα δύο είδη, με σταθερή σειρά — για όποιον πρέπει να σαρώσει **και τα δύο** (backup, εκκαθάριση). */
export const CUSTODY_KINDS = ['company', 'personal'] as const satisfies readonly CustodyKind[];

/**
 * **Πού ζει κάθε διαμέρισμα ενός συστήματος** — το σχήμα της μίας δήλωσης ανά σύστημα.
 * Ο μεταγλωττιστής αρνείται όνομα συλλογής που δεν υπάρχει στο `COLLECTIONS`.
 */
export type CustodyPartition = Readonly<Record<CustodyKind, CollectionKey>>;

/**
 * **Η ΜΙΑ μετάφραση** χώρου → κατόχου.
 *
 * ⚠️ Δύο λεξιλόγια για το ίδιο πράγμα (`kind` στο `WorkspaceRef`, κλειδί πεδίου εδώ), γιατί το
 * έγγραφο Firestore χρειάζεται **επίπεδο** πεδίο: οι κανόνες και τα ευρετήρια το ρωτούν
 * απευθείας (`resource.data.userId == request.auth.uid`).
 */
export function custodyScopeOf(workspace: WorkspaceRef): CustodyScope {
  return workspace.kind === 'org'
    ? { companyId: workspace.companyId }
    : { userId: workspace.userId };
}

/** Το είδος κατόχου ενός χώρου — ο πελάτης το παράγει από τη θεματοφυλακή της οντότητας. */
export function custodyKindOf(workspace: WorkspaceRef): CustodyKind {
  return workspace.kind === 'org' ? 'company' : 'personal';
}

/** Το είδος ενός κατόχου. */
export function custodyKindOfScope(scope: CustodyScope): CustodyKind {
  return scope.userId !== undefined ? 'personal' : 'company';
}

/**
 * **Ερμηνεία παραμέτρου σύρματος** — απουσία ⇒ `company` (ό,τι ίσχυε πάντα, **μηδέν** αλλαγή
 * για τους υπάρχοντες αναγνώστες).
 *
 * ⚠️ **Άγνωστη τιμή ⇒ `null` (άρνηση), ΠΟΤΕ προεπιλογή** — OWASP multi-tenant: *«fail closed if
 * the tenant context is missing or invalid»*. Ένα `Personal` δεν γίνεται σιωπηλά εταιρικό.
 */
export function custodyKindFromParam(value: string | null): CustodyKind | null {
  if (value === null) return 'company';
  return value === 'company' || value === 'personal' ? value : null;
}

/**
 * Μη κενή συμβολοσειρά — κενό δεν είναι κάτοχος, είναι **απουσία** κατόχου.
 *
 * ⚠️ ADR-866 §2.6.11 — **και μόνο-κενά** (`'   '`) είναι απουσία: ο γραφέας ίχνους αρχείων το
 * αρνιόταν με δικό του `trim()`, και η μετάβασή του σε αυτό το πρωτογενές θα το **έχανε**
 * (άγκυρα Γ2 του `file-audit-admin-anchor`). Ένα σημείο κρίσης για κάθε διαμέρισμα.
 */
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * **Το σύνορο ανάγνωσης** του κατόχου — από ωμά δεδομένα εγγράφου.
 *
 * 🔴 **`null` όταν δεν υπάρχει ΑΚΡΙΒΩΣ ΕΝΑΣ.** Έγγραφο χωρίς κάτοχο **ή** με δύο δεν αποδίδεται
 * ποτέ: δεν ξέρουμε σε ποιον ανήκει, άρα δεν ξέρουμε ποιος δικαιούται να το δει. Ο καλών το
 * **παραλείπει** — δεν μαντεύει.
 */
export function custodyScopeFromData(data: Readonly<Record<string, unknown>>): CustodyScope | null {
  const companyId = nonEmpty(data.companyId) ? data.companyId : null;
  const userId = nonEmpty(data.userId) ? data.userId : null;
  if (companyId !== null && userId === null) return { companyId };
  if (userId !== null && companyId === null) return { userId };
  return null;
}

/**
 * **Ανήκει ΑΥΤΟ το έγγραφο σε ΑΥΤΟΝ τον κάτοχο;** — η γενίκευση του `isPayloadOwnedByCompany`
 * (ADR-742) στα **δύο** διαμερίσματα (ADR-866 §2.6.10 Β4).
 *
 * 🔴 **Η ΠΑΓΙΔΑ ΤΟΥ ΚΕΝΟΥ ΚΛΕΙΝΕΙ ΔΥΟ ΦΟΡΕΣ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ**: το έγγραφο περνά από το
 * {@link custodyScopeFromData} («ακριβώς ένας»), και ο ίδιος ο **κάτοχος** από τον
 * {@link isWritableCustodyScope}. Δηλαδή ούτε έγγραφο χωρίς/με δύο κατόχους, ούτε καλών με
 * χαλασμένο token (`{ companyId: '' }`) μπορεί να «ταιριάξει» κατά σύμπτωση — ακριβώς το
 * ζωντανό σφάλμα που μετρήθηκε στην ADR-742 §4 όταν τέσσερις χειρόγραφες συγκρίσεις `!==`
 * ενοποιήθηκαν. **Το κενό είναι απουσία κατόχου, ποτέ ταίριασμα.**
 *
 * ⚠️ **Διαμέρισμα ΠΡΩΤΑ, ταυτότητα ΜΕΤΑ**: εταιρικό έγγραφο δεν ανήκει ποτέ σε άνθρωπο, ακόμη
 * κι αν τα δύο αναγνωριστικά έτυχε να συμπίπτουν (ίδιο δόγμα με το {@link fileCustodyKey} του
 * `lib/files/file-custody`: το σκέτο id δεν αρκεί).
 *
 * ⛔ **ΜΗΝ γράψεις τέταρτο χειρόγραφο `===`.** Οι τρεις προηγούμενες μορφές έζησαν στον
 * `judgeTransition`, στον `judgeSuccession` και στο `version-stack.readOwned`, και η καθεμία
 * ρωτούσε λίγο αλλιώς.
 *
 * @example
 * isOwnedByCustody({ userId: 'u1' }, { userId: 'u1' });      // true
 * isOwnedByCustody({ companyId: 'c1' }, { userId: 'c1' });   // false — άλλο διαμέρισμα
 * isOwnedByCustody({ companyId: '' }, { companyId: '' });    // false — απουσία, όχι ταίριασμα
 */
export function isOwnedByCustody(
  data: Readonly<Record<string, unknown>> | null | undefined,
  owner: CustodyScope,
): boolean {
  if (!isWritableCustodyScope(owner)) return false;
  const docOwner = data === null || data === undefined ? null : custodyScopeFromData(data);
  if (docOwner === null) return false;
  return docOwner.userId !== undefined
    ? docOwner.userId === owner.userId
    : docOwner.companyId === owner.companyId;
}

/**
 * **Μόνο το πεδίο του κατόχου** ενός ευρύτερου αντικειμένου — ποτέ και τα δύο κλειδιά, ποτέ δίδυμο
 * `undefined` δίπλα στο άλλο. Αυτό απλώνεται σε έγγραφο Firestore (`{ ...custodyOnly(x) }`).
 *
 * 🧹 ADR-866 §2.6.11 — ζούσε **δύο** φορές (`storage-path.custodyOnly` · `entity-audit.ledgerFields`)
 * και θα γινόταν τρίτη στο ιστορικό αρχείων. Η αποκλειστικότητα είναι **ιδιότητα της κατασκευής**,
 * όχι παρενέργεια καθαριστή `undefined`.
 */
export function custodyOnly(scope: CustodyScope): CustodyScope {
  return scope.userId !== undefined ? { userId: scope.userId } : { companyId: scope.companyId };
}

/**
 * **Έγκυρος κάτοχος για γραφή;** — ο φρουρός του γραφέα, ίδιο κριτήριο με το σύνορο ανάγνωσης.
 *
 * ⚠️ Ο τύπος εγγυάται **σχήμα**, όχι **τιμή**: ένα `{ userId: '' }` μεταγλωττίζεται και θα
 * γινόταν έγγραφο που **κανείς** δεν μπορεί να διαβάσει. Γι' αυτό ο γραφέας ρωτά **εδώ**.
 */
export function isWritableCustodyScope(scope: CustodyScope): boolean {
  return custodyScopeFromData({ companyId: scope.companyId, userId: scope.userId }) !== null;
}
