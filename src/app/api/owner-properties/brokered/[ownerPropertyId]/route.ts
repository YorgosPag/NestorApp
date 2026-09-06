/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — ξαναστείλε τον σύνδεσμο, ανακάλεσέ τον.
 * @related ADR-777 §8.34 · services/mandate/mandate-actions.service.ts
 * @module app/api/owner-properties/brokered/[ownerPropertyId]/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΜΙΑ ΔΙΑΔΡΟΜΗ ΜΕ **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ** ΠΡΑΞΕΩΝ, ΟΧΙ ΔΥΟ ΔΙΕΥΘΥΝΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο πράξεις γράφουν **το ίδιο πεδίο** (`consentNonce`) και μοιράζονται **την
 * ίδια** εξουσιοδότηση (η αγγελία ανήκει σε **αυτό** το γραφείο). Δύο διευθύνσεις θα
 * σήμαιναν δύο τόποι που πρέπει να θυμούνται τον ίδιο έλεγχο — και ο δεύτερος θα τον
 * ξεχνούσε στην πρώτη αλλαγή.
 *
 * ⚠️ **Το `action` είναι κλειστό σύνολο, ελεγμένο πριν φτάσει σε υπηρεσία**
 * ({@link isMandateAction}). Μια ωμή συμβολοσειρά από το δίκτυο που καταλήγει σε
 * `switch` χωρίς `default` είναι λευκή οθόνη· εδώ γίνεται **400 με όνομα πεδίου**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΙ ΤΟ `GET` — **Η ΕΝΤΟΛΗ ΑΠΟΚΤΗΣΕ ΔΙΕΥΘΥΝΣΗ** (ADR-841 §7 Α18.12, 2026-09-05)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γονέας δηλώνει αυτολεξεί: *«το `POST` γεννά μία, το `GET` τις απαριθμεί»*. Εδώ,
 * με την ίδια λογική, το `GET` **δείχνει αυτήν** — και ζει στο **ίδιο** αρχείο με τις
 * πράξεις της, γιατί απαντά για το **ίδιο πράγμα** στην **ίδια** διεύθυνση. Ξεχωριστή
 * ρίζα θα σήμαινε δεύτερος τόπος που πρέπει να θυμάται *«ποιο είναι το γραφείο;»*.
 *
 * ⚠️ **ΤΑ ΔΥΟ ΡΗΜΑΤΑ ΕΧΟΥΝ ΔΙΑΦΟΡΕΤΙΚΟΥΣ ΦΡΟΥΡΟΥΣ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ**: το `GET`
 * καλεί {@link gateBrokerage} *(όπως ο κατάλογος)*, το `POST` **όχι** *(η εμβέλεια
 * κρίνεται μέσα στην υπηρεσία πράξεων, κατά `companyId`)*. Το `GET` **οφείλει** να τον
 * έχει: δείχνει **ακριβώς** τα δεδομένα του καταλόγου, και εκείνος τον απέκτησε μετά
 * από μετρημένο περιστατικό *(ως τις 2026-08-28 «οποιοδήποτε μέλος οποιουδήποτε
 * γραφείου έπαιρνε 200»)*. Χωρίς αυτόν εδώ, η ίδια τρύπα θα ξανάνοιγε **ανά γραμμή**.
 *
 * ⚠️ **ΔΕΝ είναι `PATCH` και δεν πάει στη διαδρομή του ιδιώτη.** Το αδελφό
 * `api/owner-properties/[ownerPropertyId]` επεξεργάζεται **περιεχόμενο** και κύκλο
 * ζωής, με εξουσιοδότηση `authorUserId === uid` (*«είναι δική σου;»*). Εδώ η ερώτηση
 * είναι **άλλη** — *«είναι του γραφείου σου;»* — και δύο απαντήσεις στο ίδιο αρχείο
 * θα ήταν δύο δόγματα εξουσιοδότησης σε μία πόρτα.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
import { gateBrokerage } from '@/lib/auth/brokerage-gate';
import type { AuthContext } from '@/lib/auth/types';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import {
  isMandateAction,
  resendMandateInvitation,
  revokeMandateInvitation,
  type MandateActionOutcome,
} from '@/services/mandate/mandate-actions.service';
import { readMandateDetail } from '@/services/mandate/mandate-detail.service';
// 🔑 **Ο τύπος της απόκρισης ΔΕΝ γεννιέται εδώ**: το `MandateDetailResponse` είναι
//    `Exclude<…, not-yours>` πάνω στο λεξιλόγιο — άρα η παράλειψη του ξένου εγγράφου
//    είναι **δομική**, όχι σύμβαση που θυμάται αυτό το αρχείο.
import {
  MANDATE_FOUND,
  MANDATE_MISSING,
  MANDATE_NOT_A_MANDATE,
  type MandateDetailResponse,
} from '@/lib/mandate/mandate-detail-outcome';

/**
 * **Αποτέλεσμα πράξης → HTTP**, κάθε λόγος ρητά και **χωρίς `default`**.
 *
 * | Λόγος | Κωδικός | Γιατί |
 * |---|---|---|
 * | `absent` | **404** | *«δεν υπάρχει **για το γραφείο σου**»* — 403 θα **επιβεβαίωνε** ξένο έγγραφο |
 * | `not-brokered` | **409** | Υπάρχει και είναι **άλλο πράγμα** (αγγελία ιδιώτη): σύγκρουση κατάστασης, όχι κακό αίτημα |
 * | `declined` · `expired` · `not-pending` · `no-address` | **409** | Η πράξη είναι έγκυρη· **η κατάσταση του κόσμου** δεν τη δέχεται. Ονομαστικά, ώστε η οθόνη να πει **ποια** — και το `no-address` έχει **δική του θεραπεία** («βάλε email στην επαφή»), όχι «δοκίμασε ξανά» |
 * | `write-failed` | **502** | Ο σύνδεσμος φτιάχτηκε αλλά **το μήνυμα δεν έφυγε** — δεν φταίει ο άνθρωπος, και **δεν** είναι δικό μας σφάλμα λογικής |
 */
function respondToAction(
  outcome: MandateActionOutcome,
): NextResponse<MandateActionOutcome | { error: string }> {
  if (outcome.ok) return NextResponse.json(outcome);

  switch (outcome.reason) {
    case 'absent':
      return NextResponse.json({ error: outcome.reason }, { status: 404 });
    case 'not-brokered':
    case 'declined':
    case 'expired':
    case 'not-pending':
    case 'already-revoked':
    case 'no-address':
      return NextResponse.json({ error: outcome.reason }, { status: 409 });
    case 'write-failed':
      return NextResponse.json({ error: outcome.reason }, { status: 502 });
  }
}

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

type ActionResponse = MandateActionOutcome | { error: string };

async function handler(
  request: NextRequest,
  ctx: AuthContext,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse<ActionResponse>> {
  const params = await routeContext?.params;
  const ownerPropertyId = params?.ownerPropertyId?.trim() ?? '';
  if (ownerPropertyId === '') {
    return NextResponse.json({ error: 'MALFORMED_BODY' }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  if (!isMandateAction(action)) {
    return NextResponse.json({ error: 'MALFORMED_BODY' }, { status: 400 });
  }

  const adminDb = getAdminFirestore();

  if (action === 'revoke') {
    return respondToAction(
      await revokeMandateInvitation(adminDb, ownerPropertyId, ctx.companyId, nowISO()),
    );
  }

  // ⚠️ Η επωνυμία διαβάζεται **εδώ** και περνιέται, ίδια κίνηση με την πόρτα
  // καταχώρησης: η υπηρεσία της εντολής δεν ξέρει από εταιρείες. Κενό `''` σημαίνει
  // «δεν βρέθηκε» και **δεν** ακυρώνει την αποστολή — αλλά το μήνυμα θα είναι
  // ανώνυμο, οπότε λέγεται κενό και όχι μπαλαντέρ.
  const agencyName = (await readCompanyPublicName(adminDb, ctx.companyId)) ?? '';

  return respondToAction(
    await resendMandateInvitation(
      adminDb,
      ownerPropertyId,
      ctx.companyId,
      agencyName,
      nowISO(),
    ),
  );
}

export const POST = withStandardRateLimit(
  withAuth<ActionResponse, RouteContext>(handler),
);


// =============================================================================
// GET — «δείξε μου ΑΥΤΗΝ την εντολή» (ADR-841 §7 Α18.12)
// =============================================================================

async function detailHandler(
  _request: NextRequest,
  ctx: AuthContext,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse<MandateDetailResponse | { error: string }>> {
  const adminDb = getAdminFirestore();

  // 🔴 **Ο ΙΔΙΟΣ ΦΡΟΥΡΟΣ ΜΕ ΤΟΝ ΚΑΤΑΛΟΓΟ, ΚΑΙ ΠΡΩΤΟΣ** — δες την κεφαλίδα για το γιατί
  //    το `GET` τον έχει ενώ το `POST` όχι.
  const authority = await gateBrokerage(adminDb, ctx.companyId);
  if (authority instanceof NextResponse) return authority;

  const params = await routeContext?.params;
  const ownerPropertyId = params?.ownerPropertyId?.trim() ?? '';
  if (ownerPropertyId === '') {
    return NextResponse.json({ error: 'MALFORMED_BODY' }, { status: 400 });
  }

  // ⚠️ **Η εμβέλεια είναι το `ctx.companyId`, ΟΧΙ το `authority.companyId`** — ίδια τιμή,
  //    και η ίδια απόφαση με τον κατάλογο: η απόδειξη υπάρχει για να φυλάει τη **γραφή**.
  // 🔑 **Περνά ΟΛΟΚΛΗΡΗ η ταυτότητα** (`uid` + `companyId`): η θεματοφυλακή κρίνεται στο
  //    SSoT (`lib/owner-property/listing-custody`), και εκείνο ρωτά **τον χώρο**, όχι ένα
  //    πεδίο. Το κενό `''` **δεν** ταιριάζει πια με κενό — fail-closed by construction.
  // ⚠️ **Ένα ρολόι** — δες `mandateStandingOf`.
  const outcome = await readMandateDetail(
    adminDb,
    { uid: ctx.uid, companyId: ctx.companyId ?? null },
    ownerPropertyId,
    nowISO(),
  );

  switch (outcome.kind) {
    case MANDATE_FOUND:
      return NextResponse.json(outcome);
    case MANDATE_NOT_A_MANDATE:
      // **200**: το έγγραφο **υπάρχει και είναι δικό του**. Ένα 404 θα έλεγε «δεν
      // υπάρχει» για αγγελία που ο ίδιος βλέπει στον κατάλογό του — ψέμα της διαδρομής.
      return NextResponse.json({ kind: MANDATE_NOT_A_MANDATE } as const);
    default:
      // 🔴 `missing` **ΚΑΙ** `not-yours` — ίδιο σώμα, ίδιο status. Δες τον τύπο παραπάνω.
      return NextResponse.json({ kind: MANDATE_MISSING } as const, { status: 404 });
  }
}

export const GET = withStandardRateLimit(
  withAuth<MandateDetailResponse | { error: string }, RouteContext>(detailHandler),
);
