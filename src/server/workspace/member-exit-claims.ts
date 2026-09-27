import 'server-only';

/**
 * @fileoverview **Ο ΟΙΚΕΙΟΣ ΧΩΡΟΣ ΜΕΤΑ ΤΗΝ ΕΞΟΔΟ** — ADR-892 §3.2 βήμα 3 · §8.1.
 * @related lib/auth/set-claims-with-mirror (ο ΕΝΑΣ δρόμος προς τα claims) · lib/auth/revocation-watermark
 * @module server/workspace/member-exit-claims
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΠΕΡΙΠΤΩΣΕΙΣ — ΚΑΙ ΜΟΝΟ Η ΜΙΑ ΑΓΓΙΖΕΙ ΤΟ TOKEN
 * ─────────────────────────────────────────────────────────────────────────────
 * - **Ξένος χώρος** (το claim δείχνει αλλού): ο κριτής μέλους διαβάζει το βιβλίο σε **κάθε** αίτημα ⇒
 *   η κλειστή θητεία ισχύει **αμέσως**. Κανένα claim, **καμία** ανάκληση: ο άνθρωπος δεν αποσυνδέεται
 *   από τον προσωπικό του χώρο επειδή τον έβγαλε ένα γραφείο στο οποίο ήταν καλεσμένος (§1.2).
 * - **Οικείος χώρος** (το claim δείχνει **εδώ**): ο κριτής δίνει `home` από το token με **0** αναγνώσεις
 *   ⇒ (α) νέο claim — το επόμενο ενεργό γραφείο του ή ο προσωπικός χώρος· (β) `revokeRefreshTokens`·
 *   (γ) η διεργασία ξεχνά τη σφραγίδα ανάκλησης, ώστε το **επόμενο** αίτημα με το παλιό cookie να κοπεί.
 *
 * ↩️ **Ο αντίστροφος δρόμος** (`adoptHomeWorkspace`, Φ2β επαναφορά): άνθρωπος **χωρίς** οικείο χώρο
 *   ξαναπαίρνει το γραφείο ως οικείο — αλλιώς το σύνορο τον απορρίπτει πριν ρωτήσει το βιβλίο.
 *
 * ⚠️ **ΙΔΕΜΠΟΤΙΚΟ**: ο καλών το ξανατρέχει και σε ήδη κλειστή θητεία — αν μια προηγούμενη προσπάθεια
 * έκλεισε το έγγραφο αλλά απέτυχε στο claim, το claim που δείχνει ακόμη εδώ θα **ξανάνοιγε** την πόρτα
 * στην επόμενη σύνδεση. Η δεύτερη κλήση το επισκευάζει.
 */

import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { isValidGlobalRole } from '@/lib/auth';
import { checkClaimFits, composeCitizenClaimPayload, composeClaimPayload, type AnyClaimPayload } from '@/lib/auth/claim-payload';
import { classifyIdentityClaims } from '@/lib/auth/identity-claims';
import { forgetRevocationState } from '@/lib/auth/revocation-watermark';
import { setClaimsWithMirror } from '@/lib/auth/set-claims-with-mirror';
import { listMemberWorkspaces, normalizeMembership } from '@/lib/auth/workspace-membership';
import { workspaceMemberRef } from '@/lib/workspace/workspace-member-ref';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import type { GlobalRole } from '@/lib/auth/types';

const logger = createModuleLogger('member-exit-claims');

/** Τι έγινε με τον οικείο χώρο — κλειστό σύνολο, για την απάντηση και το ίχνος. */
export type HomeAfterExit =
  | { readonly kind: 'untouched' }
  | { readonly kind: 'moved'; readonly companyId: string }
  | { readonly kind: 'personal' };

/** Τι έγινε με τον οικείο χώρο στην επαναφορά — κλειστό σύνολο. */
export type HomeAfterRestore =
  | { readonly kind: 'untouched' }
  | { readonly kind: 'adopted'; readonly companyId: string };

/** Ένα άλλο γραφείο όπου ο άνθρωπος είναι **ενεργό** μέλος, με τον ρόλο του **εκεί**. */
interface NextHome {
  readonly companyId: string;
  readonly globalRole: GlobalRole;
  readonly joinedAtMs: number;
}

/**
 * Αν το γραφείο ήταν ο οικείος χώρος: νέο claim + ανάκληση συνεδριών. Αλλιώς τίποτα.
 * ⚠️ **Ρίχνει** αν το claim δεν γράφτηκε: claim που δείχνει ακόμη εδώ είναι **ανοιχτή πόρτα** — ο
 * καλών πρέπει να το μάθει (και να το ξαναπροσπαθήσει), όχι να το βρει σε log.
 */
export async function releaseHomeWorkspace(uid: string, companyId: string): Promise<HomeAfterExit> {
  const previousClaims = (await getAdminAuth().getUser(uid)).customClaims ?? {};
  if (previousClaims.companyId !== companyId) return { kind: 'untouched' };

  const next = await findNextHome(uid, companyId);
  const payload: AnyClaimPayload = next === null
    ? composeCitizenClaimPayload(previousClaims)
    : composeClaimPayload({ companyId: next.companyId, globalRole: next.globalRole, previousClaims });

  try {
    await writeFittingClaims(uid, payload);
  } finally {
    // 🔑 Οι ανοιχτές συνεδρίες κόβονται **και** όταν το claim αποτύχει: ό,τι κρατά ήδη ο browser λέει
    //    `home` εδώ, και η θητεία έχει ήδη κλείσει. Το claim το επισκευάζει η επανάληψη (ιδεμποτικό).
    await getAdminAuth().revokeRefreshTokens(uid);
    forgetRevocationState(uid);
  }

  return next === null ? { kind: 'personal' } : { kind: 'moved', companyId: next.companyId };
}

/**
 * **Ο ΑΝΤΙΣΤΡΟΦΟΣ ΔΡΟΜΟΣ** (ADR-892 §12.4 — επαναφορά): αν ο άνθρωπος **δεν έχει οικείο χώρο**, το
 * γραφείο γίνεται ξανά ο οικείος του, με τον ρόλο της θέσης του **εκεί**. Αλλιώς τίποτα.
 *
 * 🔴 **ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ** (μετρημένο ζωντανά 27/09): η παύση σε οικείο χώρο αφήνει claim **χωρίς**
 *    `companyId` (προσωπικός). Ταυτότητα `personal` παίρνει **401 πριν** ο κριτής ρωτήσει το βιβλίο
 *    (`buildRequestContext`, ADR-817) ⇒ «ενεργό μέλος» στα χαρτιά, **καμία** πόρτα στην πράξη.
 * 🔑 **Ο ΚΡΙΤΗΣ ΤΟΥ «ΕΧΕΙ ΟΙΚΕΙΟ;» ΕΙΝΑΙ Ο ΙΔΙΟΣ ΜΕ ΤΟΥ `withAuth`** (`classifyIdentityClaims`) — όχι
 *    δεύτερη ανάγνωση του `companyId`. Άλλος οικείος ⇒ **ανέγγιχτος**: η επαναφορά δεν μετακινεί κανέναν
 *    στη μέση της δουλειάς του. Άκυρα claims ⇒ ανέγγιχτα (δεν είναι δουλειά της επαναφοράς να τα κρίνει).
 * 🔑 **ΚΑΜΙΑ ανάκληση**: προσθέτουμε πρόσβαση, δεν αφαιρούμε· ο πελάτης ανανεώνει μόνος του
 *    (ακροατής `claimsUpdatedAt`, ADR-360).
 * ⛔ Ο γραφέας αρνείται claim χωρίς **ενεργή** θέση (`assertClaimsHaveSeat`) ⇒ μια παύση που πρόλαβε
 *    ανάμεσα στη συναλλαγή και σε αυτή τη γραφή **δεν** ξανανοίγει την πόρτα.
 */
export async function adoptHomeWorkspace(uid: string, companyId: string, globalRole: GlobalRole): Promise<HomeAfterRestore> {
  const previousClaims = (await getAdminAuth().getUser(uid)).customClaims ?? {};
  if (classifyIdentityClaims(previousClaims).kind !== 'personal') return { kind: 'untouched' };

  await writeFittingClaims(uid, composeClaimPayload({ companyId, globalRole, previousClaims }));
  return { kind: 'adopted', companyId };
}

/** Μέτρηση **πριν** τη γραφή (ADR-813) και ο ΕΝΑΣ γραφέας — κοινό για έξοδο και επαναφορά. */
async function writeFittingClaims(uid: string, payload: AnyClaimPayload): Promise<void> {
  const fit = checkClaimFits(payload);
  if (!fit.fits) throw new Error(`[MEMBER-EXIT] claim does not fit: ${fit.bytes}/${fit.limit} bytes for ${uid}`);
  await setClaimsWithMirror(uid, { ...payload });
}

/**
 * **Το επόμενο σπίτι**: το **παλαιότερο** ενεργό γραφείο του (ισοπαλία ⇒ id) — ίδιος κανόνας με τον
 * κληρονόμο (`pickOfficeHeir`: αρχαιότητα, ντετερμινιστικά). Κανένα ⇒ `null` ⇒ προσωπικός χώρος.
 * ⚠️ «Δεν μπόρεσα να ρωτήσω» ⇒ **προσωπικός** χώρος, όχι σφάλμα: η ασφαλής κατεύθυνση είναι πάντα
 * «λιγότερη πρόσβαση»· ο άνθρωπος αλλάζει χώρο από τον επιλογέα.
 */
async function findNextHome(uid: string, leavingCompanyId: string): Promise<NextHome | null> {
  const list = await listMemberWorkspaces(uid);
  if (list.outcome === 'unknown') {
    logger.warn('Άγνωστοι χώροι μετά την έξοδο — προσωπικός χώρος', { uid, reason: list.reason });
    return null;
  }
  const candidates = await Promise.all(
    list.companyIds.filter((id) => id !== leavingCompanyId).map((id) => readHome(uid, id)),
  );
  const eligible = candidates.filter((home): home is NextHome => home !== null);
  eligible.sort((a, b) => a.joinedAtMs - b.joinedAtMs || a.companyId.localeCompare(b.companyId));
  return eligible[0] ?? null;
}

async function readHome(uid: string, companyId: string): Promise<NextHome | null> {
  const snapshot = await workspaceMemberRef(getAdminFirestore(), companyId, uid).get();
  if (!snapshot.exists) return null;
  const seat = normalizeMembership(uid, snapshot.data());
  if (seat.status !== 'active' || !isValidGlobalRole(seat.globalRole)) return null;
  return { companyId, globalRole: seat.globalRole, joinedAtMs: normalizeToMillisOrNull(seat.joinedAt) ?? Number.POSITIVE_INFINITY };
}
