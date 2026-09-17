/**
 * =============================================================================
 * «ΑΝΗΚΕΙ ΑΥΤΟΣ Ο ΑΝΘΡΩΠΟΣ ΣΕ ΑΥΤΟ ΤΟ ΕΡΓΟ — ΚΑΙ ΣΕ ΠΟΙΑ ΟΜΑΔΑ;»
 * =============================================================================
 *
 * **Ο ΕΝΑΣ αναγνώστης** του εγγράφου μέλους έργου, και **η ΜΙΑ μετάφρασή** του
 * σε {@link ProjectMember}.
 *
 * ⚠️ **ΔΕΝ είναι το ερώτημα του `workspace-membership.ts`** — εκείνο ρωτά *«είναι
 * μέλος αυτού του **ΧΩΡΟΥ**;»* (`companies/{W}/workspace_members/{uid}`). Εδώ
 * ρωτάμε *«είναι μέλος αυτής της **ΥΠΟΘΕΣΗΣ**, και τίνος ομάδας;»*
 * (`companies/{W}/projects/{P}/members/{mbr_…}`). **Άλλο έγγραφο, άλλη συλλογή,
 * άλλη ερώτηση** — και το repo έχει ήδη πληρώσει την ένωσή τους (βλ. παρακάτω).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ: Ο ΑΝΑΓΝΩΣΤΗΣ ΚΑΙ Ο ΓΡΑΦΕΑΣ ΖΗΤΟΥΣΑΝ **ΑΛΛΟ ΚΛΕΙΔΙ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-09-16, πριν γραφτεί αυτό το αρχείο:
 *
 * | Ποιος | Τι έκανε |
 * |---|---|
 * | γραφέας (`project-member-mutations.ts:95`) | `doc(generateMemberId()).set({ uid, … })` ⇒ `members/{mbr_…}`, το `uid` **πεδίο** |
 * | αναγνώστης GET (`project-members/route.ts:147`) | `data.uid ?? doc.id` — **ξέρει** ότι το id δεν είναι uid |
 * | 🔴 αναγνώστης PDP (`resource-lookups.ts:125`) | `.doc(ctx.uid).get()` — **άλλο κλειδί** |
 * | ADR-787 §5.1 (γραμμή 534) | τεκμηριώνει το κανονικό σχήμα: `members/{mbr_…}` |
 *
 * Δηλαδή η αναζήτηση μέλους **δεν έβρισκε ΠΟΤΕ** μέλος που πέρασε από τη μία
 * πόρτα γραφής. Fail-closed, άρα **καμία διαρροή** — αλλά κάθε κρίση ανά έργο
 * ήταν **δομικά νεκρή**, και μια άγκυρα με πλαστή αναζήτηση θα έμενε πράσινη για
 * πάντα. Το σχήμα *«`0` = κανείς δεν κοίταξε»* (N.12), μέσα σε μονοπάτι
 * εξουσιοδότησης.
 *
 * 🔑 **ΓΙΑΤΙ ΔΙΟΡΘΩΘΗΚΕ Ο ΑΝΑΓΝΩΣΤΗΣ ΚΑΙ ΟΧΙ Ο ΓΡΑΦΕΑΣ**: ο **N.6** απαιτεί κάθε
 * έγγραφο Firestore να γεννιέται με `setDoc()` + id από το
 * `enterprise-id.service` — το `members/{mbr_…}` είναι **ο κανόνας**, όχι το
 * σφάλμα. Κλειδί `uid` θα παραβίαζε τον N.6 **και** το ADR-787.
 *
 * ⇒ Ο θεματοφύλακας ρωτά με `where('uid','==',uid)` — **την ίδια ερώτηση που
 * απαντά ο γραφέας** (`findMemberByUid`), οπότε οι δύο **δεν μπορούν πια να
 * αποκλίνουν χωρίς να αλλάξει αυτό το αρχείο**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΚΑΜΙΑ CACHE ΜΕ ΧΡΟΝΟ ΛΗΞΗΣ — ΤΟ ΕΧΕΙ ΟΝΟΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το Zanzibar της Google ονομάζει τη βλάβη *«new enemy problem»*: cache
 * εξουσιοδότησης με TTL κρατά ζωντανή μια **ανακληθείσα** πρόσβαση όσο ζει η
 * εγγραφή. Η βιομηχανία το γράφει ρητά — *«attributes are stale by up to the
 * TTL, so a group removal takes effect at the next expiry»*, δηλαδή ο αριθμός
 * είναι **απόφαση ορθότητας**, όχι ρύθμιση. Η μόνη απομνημόνευση εδώ είναι **ανά
 * αίτημα** (ζει λιγότερο από την ανάκληση, εξ ορισμού) — ίδια πειθαρχία με το
 * `PermissionCache` και το `workspace-membership.ts`.
 *
 * @module lib/auth/project-member-read
 * @see lib/auth/workspace-membership — ο αδελφός («είναι μέλος του ΧΩΡΟΥ;»)
 * @see lib/auth/container-subject — ο καταναλωτής που χτίζει το υποκείμενο
 * @see ADR-862 Φ0 Β7 · ADR-787 §5.1 · N.6
 */

import 'server-only';

import { trimmedStringOrNull as text } from '@/lib/type-guards';

import { getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { isCdeAudience } from '@/types/container-access';
import { isProjectMemberEnrollment } from '@/types/project-member-enrollment';
import { memberByUidQuery, projectMembersCollection } from './project-member-ref';
import { isValidPermission, type PermissionId, type ProjectMember } from './types';

const logger = createModuleLogger('project-member-read');

// =============================================================================
// Η ΕΚΒΑΣΗ — ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΠΟΤΕ `null` ΓΙΑ ΔΥΟ ΠΡΑΓΜΑΤΑ
// =============================================================================

/**
 * 🔴 **ΤΟ `absent` ΚΑΙ ΤΟ `unknown` ΕΙΝΑΙ ΔΙΑΦΟΡΕΤΙΚΑ, ΚΑΙ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ.**
 *
 * Ο προκάτοχος (`getProjectMembership`) επέστρεφε `null` **και** για *«δεν είναι
 * μέλος»* **και** για *«η βάση δεν απάντησε»*. Ένα `null` που σημαίνει δύο
 * πράγματα είναι το σχήμα που το ADR-787 §2.7 κατέγραψε ως ζωντανό ελάττωμα: ένα
 * `PERMISSION_DENIED` υποβαθμιζόταν σε `warn` και ο άνθρωπος έβλεπε **«δεν έχεις
 * χώρους»**. *Άγνωστο ≠ κενό* (N.12).
 */
export type ProjectMemberRead =
  /** Υπάρχει έγγραφο μέλους, και διαβάστηκε. */
  | { readonly outcome: 'member'; readonly member: ProjectMember }
  /** **Ρωτήσαμε** και δεν υπάρχει. Ο άνθρωπος δεν συμμετέχει στην υπόθεση. */
  | { readonly outcome: 'absent' }
  /**
   * 🔴 **Το έγγραφο ΥΠΑΡΧΕΙ και ΔΕΝ ΚΑΤΑΛΑΒΑΙΝΕΤΑΙ** ⇒ fail-closed.
   *
   * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ «ΑΠΟΝ ΠΕΔΙΟ»** — και ήταν ελάττωμα της **πρώτης γραφής**
   * αυτού του αρχείου: το «απόν `cdeAudience`» σημαίνει, κατά δηλωμένο όριο,
   * **`'design'`** — το **πιο προνομιακό** από τα τέσσερα πρότυπα. Άρα μια
   * χαλασμένη τιμή (τυπογραφικό, χειρόγραφη γραφή, παλιό σχήμα) που θα «πεταγόταν
   * σιωπηλά» θα **προήγαγε** τον άνθρωπο σε μελετητή. Σιωπηλή απόρριψη τιμής που
   * δεν καταλαβαίνουμε = **fail-open**, δηλαδή το αντίθετο του
   * `state-outside-vocabulary` του θεματοφύλακα αρχείων.
   *
   * ⇒ **Ονομασμένη κατάσταση**, όπως το `unreadable` του `readContainerState`.
   */
  | { readonly outcome: 'unreadable'; readonly why: string }
  /** **Δεν ρωτήσαμε επιτυχώς.** ⛔ ΠΟΤΕ να διαβαστεί ως «δεν είναι μέλος». */
  | { readonly outcome: 'unknown'; readonly why: string };

export interface ProjectMemberQuery {
  /** Ο μισθωτής — από **επαληθευμένη** ταυτότητα, ποτέ από τον πελάτη. */
  readonly companyId: string;
  /** Η υπόθεση. Έρχεται από το **έγγραφο του πόρου**, ποτέ από σώμα αιτήματος. */
  readonly projectId: string;
  /** Ο άνθρωπος — από το **υπογεγραμμένο** token. */
  readonly uid: string;
  /**
   * Προαιρετική **ανά-αίτημα** απομνημόνευση.
   * ⛔ Ποτέ καθολικό `Map`: σε serverless θα ζούσε ανάμεσα σε **διαφορετικούς
   *    ανθρώπους** (ίδια πειθαρχία με το `PermissionCache`).
   */
  readonly cache?: Map<string, ProjectMemberRead>;
}

/** Το κλειδί της απομνημόνευσης — **και τα τρία** σκέλη, ποτέ δύο. */
export function projectMemberKey(companyId: string, projectId: string, uid: string): string {
  return `${companyId}:${projectId}:${uid}`;
}

// =============================================================================
// Η ΑΝΑΓΝΩΣΗ
// =============================================================================

/**
 * **Η ΜΙΑ ανάγνωση** του μέλους έργου.
 *
 * @example
 * const read = await readProjectMember({ companyId, projectId, uid, cache });
 * if (read.outcome === 'unknown') return unavailable();   // ⛔ ποτέ «δεν είναι μέλος»
 */
export async function readProjectMember(query: ProjectMemberQuery): Promise<ProjectMemberRead> {
  const { companyId, projectId, uid, cache } = query;
  const key = projectMemberKey(companyId, projectId, uid);

  const memo = cache?.get(key);
  if (memo) return memo;

  const read = await fetchProjectMember(companyId, projectId, uid);
  cache?.set(key, read);
  return read;
}

async function fetchProjectMember(
  companyId: string,
  projectId: string,
  uid: string,
): Promise<ProjectMemberRead> {
  if (!isFirebaseAdminAvailable()) {
    // ⚠️ ΟΧΙ «δεν είναι μέλος». **Δεν κοιτάξαμε.**
    logger.error('[PROJECT-MEMBER] Firebase Admin μη διαθέσιμο — άγνωστο, όχι κενό', {
      companyId,
      projectId,
      uid,
    });
    return { outcome: 'unknown', why: 'firebase-admin-unavailable' };
  }

  try {
    // 🔑 **ΕΡΩΤΗΜΑ ΣΤΟ ΠΕΔΙΟ, ΟΧΙ ΚΛΕΙΔΙ ΕΓΓΡΑΦΟΥ** — η ίδια ερώτηση που απαντά ο
    //    γραφέας, ο οποίος εγγυάται **ένα** έγγραφο ανά uid μέσα σε συναλλαγή.
    // 🔑 Μονοπάτι και ερώτηση από το ΕΝΑ σημείο (`project-member-ref`) — τα ίδια που
    //    χρησιμοποιεί ο γραφέας, άρα οι δύο δεν μπορούν πια να αποκλίνουν (ADR-862 Φ0 Β14).
    //    ⚠️ Το `companyId` έρχεται από το `AuthContext` (`withAuth`), **ποτέ** από το
    //    αίτημα — αλλιώς ο αιτών θα διάλεγε σε ποιου τον χώρο ψάχνει.
    const members = projectMembersCollection(getAdminFirestore(), companyId, projectId);
    const snapshot = await memberByUidQuery(members, uid).get();

    const doc = snapshot.docs[0];
    if (doc === undefined) return { outcome: 'absent' };

    return readMemberDoc(uid, doc.data());
  } catch (error: unknown) {
    // ⚠️ Η ΠΙΟ ΕΠΙΚΙΝΔΥΝΗ ΓΡΑΜΜΗ ΤΟΥ ΑΡΧΕΙΟΥ, ΑΝ ΓΡΑΦΤΕΙ ΛΑΘΟΣ. Ένα
    //    `{ outcome: 'absent' }` εδώ θα ήταν «σωστό» για τον μεταγλωττιστή και
    //    **ψέμα** για τον άνθρωπο: «δεν συμμετέχεις» ενώ η αλήθεια είναι «δεν
    //    μπόρεσα να ρωτήσω».
    logger.error('[PROJECT-MEMBER] Η αναζήτηση μέλους απέτυχε — άγνωστο, όχι κενό', {
      companyId,
      projectId,
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unknown', why: 'query-failed' };
  }
}

// =============================================================================
// Η ΑΥΣΤΗΡΗ ΑΝΑΓΝΩΣΗ ΤΩΝ ΔΥΟ ΠΕΔΙΩΝ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ
// =============================================================================

/**
 * **Ανεκτικός αναγνώστης, ΑΛΛΑ ΟΧΙ στα πεδία που δίνουν πρόσβαση.**
 *
 * 🔑 Η ασυμμετρία είναι **σκόπιμη** και ακολουθεί το `showcase-read`/`file-record-read`:
 * ένα χαλασμένο `roleId` ή `addedBy` το αντέχουμε (χειρότερη περίπτωση: κανένα
 * δικαίωμα, δηλαδή **προς τα κλειστά**). Ένα χαλασμένο `cdeAudience` πάει **προς τα
 * ανοιχτά** μέσω της προεπιλογής `'design'`, και ένα χαλασμένο `taskTeamId` θα
 * γινόταν `null` ⇒ `denied-teamless`, δηλαδή θα **έκρυβε** από τον άνθρωπο το
 * **δικό του** WIP χωρίς να πει γιατί.
 *
 * ⇒ Και τα δύο: **παρόντα και ακατάληπτα ⇒ `unreadable`**, ποτέ «σαν να μην ήταν».
 */
function readMemberDoc(
  uid: string,
  raw: Record<string, unknown> | undefined,
): ProjectMemberRead {
  const data = raw ?? {};

  if (isDeclared(data.cdeAudience) && !isCdeAudience(data.cdeAudience)) {
    return { outcome: 'unreadable', why: 'audience-outside-vocabulary' };
  }

  if (isDeclared(data.taskTeamId) && text(data.taskTeamId) === null) {
    return { outcome: 'unreadable', why: 'team-not-a-name' };
  }

  return { outcome: 'member', member: normalizeProjectMember(uid, data) };
}

/**
 * «Κάποιος **έγραψε** αυτό το πεδίο» — `undefined`/`null` σημαίνει *δεν δηλώθηκε*.
 *
 * ⚠️ Το `null` μετριέται ως **απουσία** και όχι ως βλάβη επίτηδες: είναι ο τρόπος
 * που το Firestore εκπροσωπεί «σβήστηκε», και ένα διαγραμμένο πεδίο **είναι**
 * μη-δήλωση.
 */
function isDeclared(value: unknown): boolean {
  return value !== undefined && value !== null;
}

// =============================================================================
// Η ΜΙΑ ΜΕΤΑΦΡΑΣΗ
// =============================================================================

/**
 * Ωμό έγγραφο → {@link ProjectMember}. **Η μία μετάφραση.**
 *
 * 🔴 **Αντικαθιστά ωμό `as ProjectMember`** (`resource-lookups.ts:133`): εκείνο
 * υποσχόταν στον μεταγλωττιστή `PermissionId[]` και `Date` για τιμές που ήρθαν
 * **από τη βάση** ως `string[]` και `Timestamp`. Ένα cast εκεί λέει
 * *«εμπιστέψου με»* για δεδομένα που κανείς δεν επαλήθευσε.
 *
 * ⛔ **ΜΗΝ γράψεις δεύτερη.** Αν χρειάζεσαι άλλο πεδίο, πρόσθεσέ το **εδώ** — το
 * `normalizeMembership` του αδελφού φέρει τον ίδιο κανόνα, και τον απέκτησε
 * **αφού** μετρήθηκαν δύο μεταφράσεις του ίδιου εγγράφου με **αντίθετη**
 * προεπιλογή (ADR-749).
 */
export function normalizeProjectMember(
  uid: string,
  raw: Record<string, unknown> | undefined,
): ProjectMember {
  const data = raw ?? {};

  return {
    companyId: text(data.companyId) ?? '',
    projectId: text(data.projectId) ?? '',
    roleId: text(data.roleId) ?? '',
    permissionSetIds: stringList(data.permissionSetIds),
    // ⚠️ Ο **υπάρχων** φρουρός στενεύει `string → PermissionId` (κανένα cast): μια
    //    ικανότητα εκτός μητρώου δεν είναι «άγνωστη άδεια», είναι **καθόλου** άδεια.
    effectivePermissions: stringList(data.effectivePermissions).filter(
      (id): id is PermissionId => isValidPermission(id),
    ),
    addedAt: asDate(data.addedAt),
    addedBy: text(data.addedBy) ?? '',
    // 🔑 Τα δύο του Β7 — **conditional spread**: πεδίο απόν μένει απόν, ώστε ο
    //    καταναλωτής να ξεχωρίζει «δεν δηλώθηκε» από «δηλώθηκε κενό».
    ...(text(data.taskTeamId) === null ? {} : { taskTeamId: text(data.taskTeamId) as string }),
    ...(isCdeAudience(data.cdeAudience) ? { cdeAudience: data.cdeAudience } : {}),
    // ℹ️ Β14 — η προέλευση είναι **πληροφορία**, όχι εξουσιοδότηση: άγνωστη τιμή ⇒ απούσα,
    //    ποτέ `unreadable` (σε αντίθεση με τα δύο πεδία από πάνω, που δίνουν πρόσβαση).
    ...(isProjectMemberEnrollment(data.enrollment) ? { enrollment: data.enrollment } : {}),
    uid,
  } satisfies ProjectMember & { uid: string };
}


function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * `Timestamp | Date | ό,τι άλλο` → `Date`.
 *
 * ⚠️ **Η εποχή (1970) είναι ΟΡΑΤΟ σφάλμα, ποτέ σιωπηλό**: κανένα μέλος δεν
 * προστέθηκε το 1970, οπότε η τιμή **καταγγέλλει τον εαυτό της** αν φτάσει σε
 * οθόνη. Η εναλλακτική — `Date | null` — θα άλλαζε τον τύπο {@link ProjectMember}
 * και **κάθε** καταναλωτή του, για πεδίο που **κανείς** από τους δύο σημερινούς
 * δρόμους κρίσης δεν διαβάζει (`checkPermission` κρίνει από `roleId` ·
 * `permissionSetIds` · `effectivePermissions`· ο κατάλογος του διαχειριστή
 * μεταφράζει **μόνος του** το ωμό έγγραφο).
 */
function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const { toDate } = value as { toDate: unknown };
    if (typeof toDate === 'function') {
      const converted: unknown = toDate.call(value);
      if (converted instanceof Date) return converted;
    }
  }
  return new Date(0);
}
