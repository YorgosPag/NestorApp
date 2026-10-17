import 'server-only';

/**
 * @fileoverview **Ο ΚΩΔΙΚΟΣ ΠΡΟΣΒΑΣΗΣ ΤΟΥ ΣΥΝΔΕΣΜΟΥ** — δεύτερος παράγοντας, σε **δεύτερο** κανάλι, για κάθε είδος
 *   πρόσκλησης χωρίς λογαριασμό (ADR-915 §29).
 * @related invitation-link-redeem.ts (η κλειδαριά που προστατεύει) · server/sharing/share-password-attempt.ts (το πρότυπο
 *   μετρητή, ADR-884) · lib/tokens/signed-token.ts (μυστικό · σύγκριση σταθερού χρόνου)
 * @module server/invitations/invitation-access-code
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΟΧΙ EMAIL — ΚΑΙ ΓΙΑΤΙ «ΤΟ ΛΕΕΙ ΤΟ ΓΡΑΦΕΙΟ»
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο σύνδεσμος ήρθε με email ⇒ κωδικός **στο ίδιο** γραμματοκιβώτιο δεν σταματά το προωθημένο email (NIST SP 800-63B-4
 * §3.1.3.1: το email **δεν** είναι κανάλι εκτός ζώνης). Πρακτική DocuSign / Dropbox Sign «Access Code»: ο αποστολέας λέει
 * τον κωδικό **τηλεφωνικά**. Το κανάλι είναι πεδίο (`channel`) — το SMS μπαίνει ως δεύτερη τιμή, χωρίς αλλαγή εδώ.
 *
 * 🏆 Πέρα από τους μεγάλους:
 *   - ο κωδικός βγαίνει από **CSPRNG** (στο DocuSign τον γράφει ο αποστολέας — «1234»)·
 *   - αποθηκεύεται **HMAC με το μυστικό του είδους, δεμένο στο `invitationId`**: 10⁶ συνδυασμοί σπάνε σε κλάσματα
 *     δευτερολέπτου από σκέτο hash· χωρίς το μυστικό, μια διαρροή της βάσης δεν δίνει τίποτα, και ο κωδικός ενός
 *     αιτήματος δεν ισχύει σε άλλο·
 *   - ο μετρητής ζει **στην πρόσκληση** ⇒ καμία «νέα εμφάνιση» δεν τον μηδενίζει (NIST)· στο **5ο** λάθος κλειδώνει
 *     **μόνιμα** — το γραφείο ξαναστέλνει (πρακτική Adobe Sign: ακύρωση + ειδοποίηση αποστολέα).
 *
 * ⚠️ Ο ωμός κωδικός **ποτέ** σε log, email ή βάση — μόνο μία φορά στην απάντηση της αποστολής προς το γραφείο.
 */

import { createHmac, randomInt } from 'crypto';

import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';

import { equalsInConstantTime, requireTokenSecret } from '@/lib/tokens/signed-token';
import { ACCESS_CODE_CHANNELS, type StoredAccessCode } from '@/types/invitation-core';

export const ACCESS_CODE_DIGITS = 6;
export const ACCESS_CODE_MAX_FAILURES = 5;

/** Το σχήμα αποθήκευσης — ο **τύπος** ζει στο `types/invitation-core.ts` (leaf), εδώ μόνο η επικύρωση του. */
export const storedAccessCodeSchema: z.ZodType<StoredAccessCode> = z.object({
  verifier: z.string().min(1),
  channel: z.enum(ACCESS_CODE_CHANNELS),
  failures: z.number().int().min(0),
  lockedAt: z.string().min(1).nullable(),
});

/** Διαχωρισμός πεδίου: το ίδιο μυστικό υπογράφει και tokens — η ετικέτα κρατά τις δύο χρήσεις χωριστές. */
const VERIFIER_LABEL = 'invitation-access-code:v1';

function verifierOf(secret: string, invitationId: string, code: string): string {
  return createHmac('sha256', secret).update(`${VERIFIER_LABEL}:${invitationId}:${code}`).digest('hex');
}

/** Ό,τι γράφει ο άνθρωπος → μόνο ψηφία: κενά και παύλες της υπαγόρευσης («123 456», «123-456») δεν μετρούν ως λάθος. */
export function normaliseAccessCode(input: string): string {
  return input.replace(/\D/g, '');
}

/** **Νέος κωδικός** για μία πρόσκληση. Πετά αν λείπει το μυστικό — ο καλών το λέει `secret-missing`, δεν στέλνει τίποτα. */
export function mintAccessCode(secretEnv: string, invitationId: string): { readonly code: string; readonly stored: StoredAccessCode } {
  const secret = requireTokenSecret(secretEnv);
  const code = String(randomInt(0, 10 ** ACCESS_CODE_DIGITS)).padStart(ACCESS_CODE_DIGITS, '0');
  return { code, stored: { verifier: verifierOf(secret, invitationId, code), channel: 'office-relay', failures: 0, lockedAt: null } };
}

export type AccessCodeVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'wrong'; readonly remaining: number; readonly next: StoredAccessCode }
  | { readonly kind: 'locked'; readonly next: StoredAccessCode | null };

/**
 * **Η κρίση** — καθαρή. Κλειδωμένος ⇒ `locked` χωρίς σύγκριση (καμία πληροφορία από το λάθος). Λάθος ⇒ η επόμενη
 * κατάσταση· το 5ο λάθος γυρίζει `locked` με `next` που πρέπει να γραφτεί.
 */
export function judgeAccessCode(stored: StoredAccessCode, attempt: string, ctx: { readonly secret: string; readonly invitationId: string; readonly nowIso: string }): AccessCodeVerdict {
  if (stored.lockedAt !== null) return { kind: 'locked', next: null };
  const code = normaliseAccessCode(attempt);
  if (code.length === ACCESS_CODE_DIGITS && equalsInConstantTime(verifierOf(ctx.secret, ctx.invitationId, code), stored.verifier)) {
    return { kind: 'ok' };
  }
  const failures = stored.failures + 1;
  if (failures >= ACCESS_CODE_MAX_FAILURES) return { kind: 'locked', next: { ...stored, failures, lockedAt: ctx.nowIso } };
  return { kind: 'wrong', remaining: ACCESS_CODE_MAX_FAILURES - failures, next: { ...stored, failures } };
}

export type AccessCodeAttempt =
  | { readonly kind: 'ok' }
  | { readonly kind: 'wrong'; readonly remaining: number }
  /** `lockedNow` = **αυτή** η προσπάθεια κλείδωσε (ο καλών ειδοποιεί το γραφείο **μία** φορά). */
  | { readonly kind: 'locked'; readonly lockedNow: boolean };

/**
 * **Μία προσπάθεια, μέσα σε συναλλαγή**: ξαναδιαβάζει τον μετρητή και γράφει την αποτυχία. Δύο παράλληλα λάθη ⇒ +2·
 * κανένα δεν «ξεχνιέται». `readStored` = ο αναγνώστης του είδους (το σχήμα του εγγράφου είναι δικό του).
 */
export async function stageAccessCodeAttempt(
  tx: Transaction,
  ref: DocumentReference,
  input: {
    readonly secretEnv: string;
    readonly invitationId: string;
    readonly attempt: string;
    readonly nowIso: string;
    readonly readStored: (raw: unknown) => StoredAccessCode | null;
  },
): Promise<AccessCodeAttempt> {
  const snap = await tx.get(ref);
  const stored = input.readStored(snap.data());
  // Πρόσκληση χωρίς κωδικό δεν ζητά κωδικό — ο καλών δεν έπρεπε να φτάσει εδώ· «σωστό» θα ήταν ψέμα, άρα κλειδωμένο.
  if (stored === null) return { kind: 'locked', lockedNow: false };
  const verdict = judgeAccessCode(stored, input.attempt, { secret: requireTokenSecret(input.secretEnv), invitationId: input.invitationId, nowIso: input.nowIso });
  if (verdict.kind === 'ok') return verdict;
  if (verdict.next !== null) tx.update(ref, { accessCode: verdict.next });
  return verdict.kind === 'wrong' ? { kind: 'wrong', remaining: verdict.remaining } : { kind: 'locked', lockedNow: verdict.next !== null };
}
