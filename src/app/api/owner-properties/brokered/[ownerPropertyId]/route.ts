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
 * ⚠️ **ΔΕΝ είναι `PATCH` και δεν πάει στη διαδρομή του ιδιώτη.** Το αδελφό
 * `api/owner-properties/[ownerPropertyId]` επεξεργάζεται **περιεχόμενο** και κύκλο
 * ζωής, με εξουσιοδότηση `authorUserId === uid` (*«είναι δική σου;»*). Εδώ η ερώτηση
 * είναι **άλλη** — *«είναι του γραφείου σου;»* — και δύο απαντήσεις στο ίδιο αρχείο
 * θα ήταν δύο δόγματα εξουσιοδότησης σε μία πόρτα.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/middleware';
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
