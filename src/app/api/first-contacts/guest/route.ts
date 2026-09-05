import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΧΩΡΙΣ ΠΟΡΤΑ** — ο ανώνυμος πλησιάζει (ADR-844).
 * @related services/contact/first-contact-invitation.service.ts
 * @module app/api/first-contacts/guest/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΝΕΝΑ `withAuth`, ΚΑΝΕΝΑ `withPersonalOrOrgAuth` — ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αδελφή διαδρομή (`../route.ts`) φοράει `withPersonalOrOrgAuth`, και **σωστά**:
 * εκεί ο άνθρωπος **έχει** ταυτότητα. Εδώ **δεν έχει, και δεν του τη ζητάμε** — αυτό
 * ακριβώς ήταν το ελάττωμα που θεραπεύει το ADR-844: ο επισκέπτης συμπλήρωνε ολόκληρη
 * τη φόρμα, υπέβαλλε, και έπαιρνε **401 → «κάτι πήγε στραβά»**.
 *
 * ⛔ **ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΤΟΥ ADR-817 §5**: εκείνο απαριθμεί
 * τους καταναλωτές του `withPersonalOrOrgAuth`. Αυτή η διαδρομή **δεν είναι** ένας από
 * αυτούς — δεν χαλαρώνει καμία πόρτα, **δεν έχει** πόρτα να χαλαρώσει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 ΤΙ ΤΗΝ ΦΥΛΑΕΙ ΑΝΤΙ ΓΙΑ ΤΑΥΤΟΤΗΤΑ — ΤΡΙΑ, ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΕΙΝΑΙ ΤΟ RATE LIMIT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. 🔑 **Η ΠΡΑΞΗ ΔΕΝ ΓΕΝΝΙΕΤΑΙ ΕΔΩ.** Ό,τι γράφεται είναι **πρόσκληση** — έγγραφο
 *    που κανείς δεν βλέπει, που λήγει σε 7 μέρες, και που **δεν ειδοποιεί κανέναν**.
 *    Χίλιες υποβολές = χίλια εφήμερα έγγραφα και **μηδέν** ενόχληση σε ιδιοκτήτη.
 * 2. 🔑 **Η ΧΩΡΗΤΙΚΟΤΗΤΑ ΚΡΙΝΕΤΑΙ ΣΤΗΝ ΕΞΑΡΓΥΡΩΣΗ**, από τον **ΕΝΑΝ** γραφέα: χίλιες
 *    προσκλήσεις ⇒ **το πολύ 10** ανοιχτές πράξεις (ΠΕ5/Κ5/Κ9).
 * 3. **Το email πάει σε διεύθυνση που ο υποβάλλων δεν ελέγχει, εκτός αν είναι δική
 *    του.** Ο κατά λάθος παραλήπτης διαβάζει *«αγνοήστε το»* και τίποτα δεν συμβαίνει.
 *
 * ⚠️ `withHeavyRateLimit` (10/λεπτό, κατακερματισμένη IP) — ίδιο μοτίβο με τις άλλες
 * δημόσιες διαδρομές συνδέσμου (`vendor/quote/[token]`, `attendance/qr/validate`).
 * **Είναι φρουρός πόρου, όχι φρουρός σημασίας**: εμποδίζει να μας κοστίσει κάποιος
 * χίλια email το λεπτό — δεν αποφασίζει ποιος επιτρέπεται.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import {
  issueFirstContactInvitation,
  normaliseChannelEmail,
} from '@/services/contact/first-contact-invitation.service';
import { buildFirstContactVerificationEmail } from '@/services/email-templates/first-contact-verification';
import { guestContactBodySchema } from './guest-contact-body';

const logger = createModuleLogger('first-contacts-guest-route');

/** Ίδιο με την πολιτική της υπηρεσίας — το email το **λέει** στον άνθρωπο. */
const LIFETIME_DAYS = 7;

type GuestContactResponse =
  | { readonly invitationId: string; readonly maskedEmail: string }
  /** Λείπει το κανάλι που **μπορούμε** να αποδείξουμε (απόφαση #5). */
  | { readonly error: 'EMAIL_REQUIRED' }
  /** Δεν στάλθηκε το email. **«Δεν μάθαμε» ≠ «δεν επιτρέπεσαι»** (N.12). */
  | { readonly error: 'INVITE_NOT_SENT' };

/**
 * **Κρύβει το μεσαίο** — `μ***α@gmail.com`.
 *
 * 🔑 **Γιατί επιστρέφεται καν**: η οθόνη λέει *«στείλαμε σύνδεσμο στο μ***α@gmail.com»*,
 * ώστε ο άνθρωπος που **πληκτρολόγησε λάθος** να το δει **αμέσως** αντί να περιμένει
 * email που δεν θα έρθει ποτέ. Ταυτόχρονα, κάποιος που υποβάλλει με **ξένη** διεύθυνση
 * δεν μαθαίνει τίποτα που δεν ήξερε ήδη.
 */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local.slice(0, 1)}***${domain}`;
  return `${local.slice(0, 1)}***${local.slice(-1)}${domain}`;
}

function confirmUrl(token: string): string {
  // ⚠️ Ίδια ανάγνωση με το `buildReviewUrl` του ADR-660 — **δύο** ονόματα επειδή τα
  //    περιβάλλοντα διαφέρουν ιστορικά, και το κενό είναι **υπαρκτή** περίπτωση.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '').trim();
  return `${base.replace(/\/+$/, '')}/contact/${token}`;
}

/** Τι πλησίασε, σε ανθρώπινη γλώσσα — **χωρίς καμία ανάγνωση**. */
function targetLabel(kind: 'listing' | 'professional'): string {
  // ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: ο πραγματικός τίτλος της αγγελίας θα ήταν σαφέστερος, αλλά
  //    απαιτεί ανάγνωση δημόσιας αγγελίας — που **οφείλει** να περάσει από το σύνορο
  //    του ADR-839 (CHECK 3.74). Δεν πληρώνεται ανάγνωση για ετικέτα. Αν ο άνθρωπος
  //    πλησίασε **δύο** αγγελίες, παίρνει δύο όμοια email με **διαφορετικά** κλειδιά:
  //    και τα δύο δουλεύουν, απλώς δεν ξεχωρίζουν με το μάτι.
  return kind === 'listing' ? 'την αγγελία που είδατε' : 'τον επαγγελματία που είδατε';
}

async function guestHandler(request: NextRequest): Promise<NextResponse<GuestContactResponse>> {
  const parsed = await readJsonBody(request, guestContactBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const declaration = parsed.data;
  const email = declaration.disclosure.email?.trim() ?? '';
  if (email === '') {
    // 🔑 **Ονομαστικά, ποτέ «κακό σώμα»**: ο άνθρωπος μπορεί να το διορθώσει **εκεί
    //    που στέκεται**, και η οθόνη ξέρει σε ποιο πεδίο να τον στείλει.
    return NextResponse.json({ error: 'EMAIL_REQUIRED' } as const, { status: 422 });
  }

  const issued = await issueFirstContactInvitation(
    getAdminFirestore(), declaration, email, nowISO(),
  );

  const { subject, html, text } = buildFirstContactVerificationEmail({
    seekerName: declaration.disclosure.displayName.trim() || 'Καλησπέρα σας',
    targetLabel: targetLabel(declaration.target.kind),
    confirmUrl: confirmUrl(issued.token),
    code: issued.code,
    lifetimeDays: LIFETIME_DAYS,
  });

  const sent = await sendReplyViaMailgun({
    to: normaliseChannelEmail(email), subject, textBody: text, htmlBody: html,
  });

  if (!sent.success) {
    // 🔴 **Η πρόσκληση ΕΧΕΙ ΓΡΑΦΤΕΙ, αλλά ο άνθρωπος δεν έχει πώς να τη φτάσει.**
    //    Λέμε την αλήθεια: «δεν στάλθηκε». Ένα σιωπηλό «εντάξει» θα τον έστελνε να
    //    κοιτά εισερχόμενα που δεν θα γεμίσουν ποτέ.
    logger.error('Το email επιβεβαίωσης δεν στάλθηκε', {
      invitationId: issued.invitationId, error: sent.error,
    });
    return NextResponse.json({ error: 'INVITE_NOT_SENT' } as const, { status: 503 });
  }

  return NextResponse.json(
    { invitationId: issued.invitationId, maskedEmail: maskEmail(normaliseChannelEmail(email)) },
    { status: 202 },
  );
}

/**
 * ⚠️ **202, ΟΧΙ 201.** Δεν δημιουργήθηκε η πράξη — **έγινε δεκτό το αίτημα** και
 * περιμένει απόδειξη. Το 201 θα έλεγε στην οθόνη *«έγινε»* για κάτι που **δεν έγινε**,
 * και ο άνθρωπος θα έφευγε χωρίς να πατήσει τον σύνδεσμο.
 */
export const POST = withHeavyRateLimit(guestHandler);
