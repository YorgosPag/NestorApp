/**
 * Τα τρία βήματα που κάνει **κάθε** διαδρομή διαχείρισης μέλους — γραμμένα μία φορά.
 *
 * 🔴 **Γιατί υπάρχει**: οι τρεις αδελφές διαδρομές `users/[uid]/{role,status,permission-sets}`
 * επαναλάμβαναν **αυτούσια** το ίδιο τρίπτυχο — parse σώματος · εύρεση μέλους με απομόνωση
 * μισθωτή · ουρά αποτυχίας. Μετρημένο από το CHECK 3.28 (jscpd): **6 κλώνοι**, ζωντανοί από
 * πριν, ορατοί μόνο επειδή τα τρία αρχεία βρέθηκαν για πρώτη φορά στο **ίδιο** diff.
 *
 * 🔑 **ΕΠΙΣΤΡΕΦΟΥΝ ΕΤΥΜΗΓΟΡΙΑ, ΟΧΙ ΠΕΤΑΝΕ**. Ένα `throw` θα έδινε στον καλούντα **μία**
 * απάντηση (500) εκεί που το συμβόλαιο HTTP έχει **τρεις** (400 · 404 · 500), και ο
 * καλών θα έπρεπε να τις ξαναχτίσει από το μήνυμα — δηλαδή δεύτερη αλήθεια (ADR-749).
 *
 * ⚠️ **ΜΗΝ βάλεις εδώ την απόφαση «ποιος επιτρέπεται»** — αυτή ζει στο `withAuth` και στο
 * `workspace-membership.ts` (ADR-787 §5.1). Εδώ είναι **μηχανική αιτήματος**, όχι πολιτική.
 *
 * @module lib/api/role-management-helpers
 * @see ADR-245 API Routes Centralization · ADR-244 Role Management Admin Console
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import type { Auth } from 'firebase-admin/auth';
import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';

import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';

/** Επιτυχία με φορτίο, ή έτοιμη απάντηση HTTP που ο καλών απλώς επιστρέφει. */
export type RouteStep<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: NextResponse };

/**
 * Το μέλος που βρέθηκε: **τα δεδομένα ΚΑΙ η αναφορά του**.
 *
 * ⚠️ Η `ref` δεν είναι πολυτέλεια — χωρίς αυτήν ο καλών ξαναχτίζει τη διαδρομή με το
 * χέρι για να γράψει, δηλαδή **δεύτερη γραφή του ίδιου μονοπατιού** που μπορεί να
 * αποκλίνει από αυτήν που μόλις διαβάστηκε.
 */
export interface WorkspaceMemberHit {
  readonly data: DocumentData;
  readonly ref: DocumentReference;
}

/**
 * Διαβάζει και επικυρώνει το σώμα με το δοσμένο schema.
 *
 * ⚠️ Ξεχωρίζει **ρητά** το άκυρο JSON (`Invalid JSON body`) από την αποτυχία επικύρωσης
 * (`Validation failed` + `details`): το πρώτο είναι σφάλμα **μεταφοράς**, το δεύτερο
 * σφάλμα **συμβολαίου** — και ο πελάτης δεν μπορεί να διορθώσει το ίδιο πράγμα.
 */
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
): Promise<RouteStep<T>> {
  try {
    const rawBody: unknown = await request.json();
    return { ok: true, value: schema.parse(rawBody) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Validation failed', details: error.errors },
          { status: 400 },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}

/**
 * **Απομόνωση μισθωτή**: το μέλος αναζητείται ΜΟΝΟ κάτω από τον χώρο του καλούντος.
 *
 * ⚠️ Η διαδρομή χτίζεται από τις σταθερές `COLLECTIONS`/`SUBCOLLECTIONS` — **ποτέ**
 * χειρόγραφο string: το `workspace_members` είναι το όνομα που κάνει το
 * `collectionGroup` **αδύνατο** να πιάσει μέλος έργου (ADR-787 §5.1 β).
 */
export async function loadWorkspaceMember(
  db: Firestore,
  companyId: string,
  targetUid: string,
): Promise<RouteStep<WorkspaceMemberHit>> {
  const path = `${COLLECTIONS.COMPANIES}/${companyId}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}/${targetUid}`;
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'User not found in this company' },
        { status: 404 },
      ),
    };
  }
  return { ok: true, value: { data: snap.data() ?? {}, ref } };
}

/** Ο ελάχιστος καταγραφέας που χρειάζεται η {@link failWithLoggedError}. */
interface RouteLogger {
  error(message: string, meta: Record<string, unknown>): void;
}

/**
 * Η ουρά αποτυχίας: **ένα** μήνυμα, καταγεγραμμένο **και** επιστρεφόμενο.
 *
 * ⚠️ Το μήνυμα που φεύγει στο σύρμα είναι **το ίδιο** που μπαίνει στο log — αλλιώς η
 * αναφορά του χρήστη και η γραμμή του log δεν μπορούν να αντιστοιχηθούν.
 */
export function failWithLoggedError(
  logger: RouteLogger,
  logMessage: string,
  error: unknown,
  fallback: string,
  meta: Record<string, unknown>,
): NextResponse {
  const message = getErrorMessage(error, fallback);
  logger.error(logMessage, { error: message, ...meta });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

/**
 * **Αυτοπροστασία**: ο διαχειριστής δεν αλλάζει τον ΕΑΥΤΟ του.
 *
 * 🔑 Επιστρέφει `null` όταν επιτρέπεται — **όχι** boolean: ο καλών γράφει
 * `if (blocked) return blocked;` και το 403 μαζί με το μήνυμά του μένουν **εδώ**,
 * σε ένα σημείο. Με boolean, κάθε διαδρομή ξαναέγραφε το `NextResponse.json(...)`
 * και ο κώδικας ήταν πάλι δίδυμος (CHECK 3.28).
 *
 * ⚠️ Το `message` είναι όρισμα επειδή **λέει τι ακριβώς εμποδίστηκε** («own role» ≠
 * «own account status»)· κοινό μήνυμα θα ήταν σιωπηλή απώλεια πληροφορίας.
 */
export function rejectSelfTarget(
  targetUid: string,
  callerUid: string,
  message: string,
): NextResponse | null {
  if (targetUid !== callerUid) return null;
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

/** Ό,τι χρειάζεται μια μετάλλαξη μέλους, αφού περάσουν όλοι οι φρουροί. */
export interface MemberMutationContext {
  readonly db: Firestore;
  readonly auth: Auth;
  readonly member: WorkspaceMemberHit;
}

/**
 * **Η προετοιμασία κάθε μετάλλαξης μέλους, ως ΕΝΑ βήμα** — αυτοπροστασία · Firestore ·
 * Firebase Auth · εύρεση μέλους με απομόνωση μισθωτή.
 *
 * 🔑 Συντίθεται από τα {@link rejectSelfTarget} και {@link loadWorkspaceMember}, δεν τα
 * αντικαθιστά: μια διαδρομή που **δεν** αλλάζει τον χρήστη στη Firebase Auth (π.χ.
 * `permission-sets`) καλεί μόνο το δεύτερο και **δεν πληρώνει** το `getAdminAuth()`.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: η αυτοπροστασία κρίνεται **πριν** ακουμπήσουμε τη βάση —
 * ένας διαχειριστής που προσπαθεί να αλλάξει τον εαυτό του δεν κοστίζει ανάγνωση, και το
 * 403 δεν μπορεί ποτέ να μετατραπεί σε 404 από ένα ενδιάμεσο σφάλμα.
 */
export async function prepareMemberMutation(
  ctx: { readonly uid: string; readonly companyId: string },
  targetUid: string,
  selfProtectionMessage: string,
): Promise<RouteStep<MemberMutationContext>> {
  const selfBlocked = rejectSelfTarget(targetUid, ctx.uid, selfProtectionMessage);
  if (selfBlocked) return { ok: false, response: selfBlocked };

  const db = getAdminFirestore();
  const auth = getAdminAuth();

  const member = await loadWorkspaceMember(db, ctx.companyId, targetUid);
  if (!member.ok) return { ok: false, response: member.response };

  return { ok: true, value: { db, auth, member: member.value } };
}
