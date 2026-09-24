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
 * δημόσιες διαδρομές συνδέσμου (`api/vendor/quote`, `attendance/qr/validate`).
 * **Είναι φρουρός πόρου, όχι φρουρός σημασίας**: εμποδίζει να μας κοστίσει κάποιος
 * χίλια email το λεπτό — δεν αποφασίζει ποιος επιτρέπεται.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { publicOrigin, publicUrl } from '@/lib/http/public-origin';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { firstContactTargetHref } from '@/lib/contact/first-contact-target-href';
import { issueFirstContactInvitation } from '@/services/contact/first-contact-invitation.service';
import { buildFirstContactVerificationEmail } from '@/services/email-templates/first-contact-verification';
import type { FirstContactTarget } from '@/types/first-contact';
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

/**
 * Ο σύνδεσμος επιβεβαίωσης — από το **ΕΝΑ** SSoT της δημόσιας διεύθυνσης (ADR-851 Φ5).
 *
 * 🔴 Εδώ ζούσε τοπικό `publicBase()` = `NEXT_PUBLIC_APP_URL ?? NEXT_PUBLIC_BASE_URL ?? ''` —
 * δίδυμο του `publicOrigin()` με **άλλη** εφεδρεία, και με κενό string ως «απάντηση». Το
 * `NEXT_PUBLIC_BASE_URL` **δεν ορίζεται σε κανένα περιβάλλον** (μετρημένο 2026-09-11) και
 * το κενό έδινε **σχετικό** σύνδεσμο μέσα σε email — που δεν ανοίγει πουθενά.
 */
function confirmUrl(token: string): string | null {
  return publicUrl(`/contact/${token}`);
}

/** Τι πλησίασε, σε ανθρώπινη γλώσσα — **χωρίς καμία ανάγνωση**. */
function targetLabel(kind: 'listing' | 'professional'): string {
  // ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: ο πραγματικός τίτλος της αγγελίας θα ήταν σαφέστερος, αλλά
  //    απαιτεί ανάγνωση δημόσιας αγγελίας — που **οφείλει** να περάσει από το σύνορο
  //    του ADR-839 (CHECK 3.74). Δεν πληρώνεται ανάγνωση για ετικέτα.
  // ✅ **Η ΣΥΓΧΥΣΗ ΠΟΥ ΑΥΤΟ ΑΦΗΝΕ, ΤΗ ΛΥΝΕΙ ΤΟ {@link targetHref}** (2026-09-05): δύο
  //    αγγελίες έδιναν δύο **όμοια** email· τώρα η ετικέτα είναι **σύνδεσμος** προς τη
  //    σελίδα που είδε ο άνθρωπος, και ξεχωρίζουν με το μάτι.
  return kind === 'listing' ? 'την αγγελία που είδατε' : 'τον επαγγελματία που είδατε';
}

/**
 * **Πού στεκόταν ο άνθρωπος**, σε **απόλυτη** μορφή — ή `null` όταν δεν υπάρχει.
 *
 * 🔑 **ΤΗΝ ΕΡΩΤΗΣΗ ΤΗΝ ΑΠΑΝΤΑ ΠΛΕΟΝ ΤΟ {@link firstContactTargetHref}, ΚΑΙ ΔΕΝ ΕΙΝΑΙ
 * ΚΑΛΛΩΠΙΣΜΟΣ.** Η **σελίδα της άρνησης** (`GuestContactContent`) ρώτησε το ίδιο
 * πράγμα — και δύο διατυπώσεις του *«ποια είναι η δημόσια διεύθυνση αυτού του
 * στόχου»* είναι ελεύθερες να **αποκλίνουν**: αρκεί η μία να μάθει κάποτε τη
 * βιτρίνα του επαγγελματία και η άλλη όχι, και ο **ίδιος** άνθρωπος παίρνει κουμπί
 * στο email και **λευκή σελίδα** στην οθόνη.
 *
 * ⚠️ **Ό,τι μένει εδώ είναι η ΡΙΖΑ, και σωστά**: ο παραλήπτης του email είναι **εκτός
 * ιστότοπου** — γι' αυτόν η σχετική διεύθυνση δεν σημαίνει τίποτα. Η οθόνη, που είναι
 * **μέσα**, δεν τη θέλει. Γνώση **περιβάλλοντος**, όχι γνώση **στόχου**.
 */
function targetHref(target: FirstContactTarget): string | null {
  const href = firstContactTargetHref(target);
  return href === null ? null : publicUrl(href);
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

  // 🔴 **ΚΛΕΙΣΤΑ ΣΕ ΑΠΟΤΥΧΙΑ, ΚΑΙ ΠΡΙΝ ΤΗ ΓΡΑΦΗ** (ADR-851 Φ5): χωρίς δημόσια διεύθυνση ο
  //    σύνδεσμος επιβεβαίωσης δεν μπορεί να υπάρξει. Μια πρόσκληση που γράφεται **χωρίς**
  //    δρόμο παράδοσης είναι δεδομένα ανθρώπου σε συλλογή χωρίς σκοπό — καλύτερα καμία.
  if (publicOrigin() === null) {
    logger.error('Δεν υπάρχει δημόσια διεύθυνση — η πρόσκληση πρώτης επαφής δεν εκδόθηκε');
    return NextResponse.json({ error: 'INVITE_NOT_SENT' } as const, { status: 503 });
  }

  const issued = await issueFirstContactInvitation(
    getAdminFirestore(), declaration, email, nowISO(),
  );
  const confirm = confirmUrl(issued.token);
  if (confirm === null) {
    return NextResponse.json({ error: 'INVITE_NOT_SENT' } as const, { status: 503 });
  }

  const { subject, html, text } = buildFirstContactVerificationEmail({
    seekerName: declaration.disclosure.displayName.trim() || 'Καλησπέρα σας',
    targetLabel: targetLabel(declaration.target.kind),
    targetHref: targetHref(declaration.target),
    confirmUrl: confirm,
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
