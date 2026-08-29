import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ Σ2 — «ΤΙ ΑΙΤΗΜΑΤΑ ΕΧΩ;»** (ADR-827 §9.21).
 * @related services/mandate/mandate-inbox.service.ts · lib/auth/brokerage-gate.ts
 * @module app/api/mandate-requests/inbox/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΚΗ ΤΗΣ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΟΧΙ `GET` ΣΤΟ `/api/mandate-requests`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κεφαλίδα της γειτονικής διαδρομής το **απαγορεύει ονομαστικά**, και ο λόγος
 * στέκει: *«ό,τι βλέπει ο καθένας είναι **προβολή**, και **ποια** προβολή εξαρτάται
 * από **ποιος ρωτά**. Ένα γενικό `GET` εκεί θα ήταν μία απάντηση για δύο ακροατήρια —
 * δηλαδή θα διάλεγε το ένα, σιωπηλά.»*
 *
 * ⇒ Δύο ακροατήρια, δύο διευθύνσεις, **δύο φρουροί που το καθένα μπορεί να
 * ικανοποιήσει**:
 *
 * | Διαδρομή | Ποιος | Φρουρός | Γιατί ο άλλος θα ήταν λάθος |
 * |---|---|---|---|
 * | `POST /api/mandate-requests` | ο **ιδιώτης** | `withPersonalOrOrgAuth` | το `withAuth` θα του απαντούσε **401**: δεν έχει οργανισμό (ADR-817 §2.2) |
 * | `GET  /api/mandate-requests/inbox` | το **γραφείο** | `withAuth` + `gateBrokerage` | ο ιδιώτης **δεν έχει** εισερχόμενα· η ερώτηση δεν του ανήκει |
 *
 * 🔴 **ΚΑΙ ΤΟ `gateBrokerage` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ.** Μέχρι τις 2026-08-28 ο
 * κατάλογος εντολών ήταν σκέτο `withAuth`: **οποιοδήποτε** μέλος **οποιουδήποτε**
 * οργανισμού έπαιρνε `200`. Η **πράξη** ήταν κλειστή· η **επιφάνεια** όχι. Εδώ η
 * επιφάνεια είναι **αιτήματα τρίτων προσώπων** — το ίδιο λάθος θα ήταν χειρότερο.
 *
 * ⚠️ **ΚΑΜΙΑ ΠΑΡΑΜΕΤΡΟΣ ΑΠΟ ΤΟ ΔΙΚΤΥΟ ΔΕΝ ΑΓΓΙΖΕΙ ΤΗΝ ΕΜΒΕΛΕΙΑ.** Δεν υπάρχει
 * `?companyId=` και δεν υπάρχει φίλτρο κατάστασης: η εμβέλεια είναι το `ctx.companyId`
 * και **μόνο**, ενώ η ομαδοποίηση είναι **υπολογισμένη** στον διακομιστή. Ένα φίλτρο
 * που θα ερχόταν από τον πελάτη θα ήταν δεύτερος ταξινομητής δίπλα στον πρώτο.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { gateBrokerage, type BrokerageDeniedResponse } from '@/lib/auth/brokerage-gate';
import { withAuth } from '@/lib/auth/middleware';
import type { AuthContext } from '@/lib/auth/types';
// ⛔ ΤΟ ΡΟΛΟΪ ΕΧΕΙ ΜΙΑ ΠΗΓΗ (`.ssot-registry.json` → module `date-local`, CHECK 3.7).
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readMandateInbox, type MandateInbox } from '@/services/mandate/mandate-inbox.service';

type InboxResponse =
  | MandateInbox
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με «άδεια εισερχόμενα» (N.12). */
  | { readonly error: 'INBOX_UNVERIFIED' }
  | BrokerageDeniedResponse;

async function inboxHandler(
  _request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<InboxResponse>> {
  const adminDb = getAdminFirestore();

  // 🔴 Ο φρουρός **ΠΡΩΤΟΣ**, πριν από κάθε ανάγνωση: δεν κάνουμε δουλειά για αιτούντα
  //    που δεν επιτρέπεται. Δες {@link gateBrokerage}.
  const authority = await gateBrokerage(adminDb, ctx.companyId);
  if (authority instanceof NextResponse) return authority;

  // ⚠️ **Η εμβέλεια είναι το `ctx.companyId`, ΟΧΙ το `authority`.** Ο φρουρός απαντά
  //    *«επιτρέπεσαι;»*· η **ταυτότητα** του γραφείου έρχεται από την απόδειξη. Δύο
  //    πηγές για το «ποιος είμαι» είναι δύο πηγές που μπορούν να διαφωνήσουν.
  const load = await readMandateInbox(adminDb, ctx.companyId ?? '', nowISO());

  // 🔴 **503, ΠΟΤΕ 200 ΜΕ ΑΔΕΙΑ ΛΙΣΤΑ.** Ένα «κανένα αίτημα» σε βλάβη λέει στον
  //    μεσίτη ότι **κανείς δεν τον ζήτησε** — και θα το πίστευε. Το 503 λέει
  //    *«ξαναδοκίμασε»*, όπως ήδη κάνει το `REQUEST_UNVERIFIED` της γειτονικής πόρτας.
  if (load.kind === 'unavailable') {
    return NextResponse.json({ error: 'INBOX_UNVERIFIED' } as const, { status: 503 });
  }

  return NextResponse.json(load.inbox);
}

export const GET = withStandardRateLimit(withAuth<InboxResponse>(inboxHandler));
