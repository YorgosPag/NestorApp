/**
 * =============================================================================
 * ΠΑΡΑΔΙΔΕΤΑΙ ΑΥΤΟ ΤΟ EMAIL, Ή ΚΡΑΤΙΕΤΑΙ; — το email ακολουθεί το ΕΠΙΠΕΔΟ ΔΕΔΟΜΕΝΩΝ
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ** (ADR-876 §5.8 Σ22, μετρημένο 2026-09-24): με `dev:emulator` ο server
 * έστειλε **πραγματικό** email μέσω Mailgun. Τέσσερις δρόμοι έφταναν στο δίκτυο και κανείς
 * δεν ήξερε ότι τα δεδομένα του ήταν ψεύτικα.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ.** Rails `delivery_method :test` · Laravel `log`/`alwaysTo()` ·
 * Django `filebased.EmailBackend` · Mailpit: όλοι κρίνουν με **διακόπτη περιβάλλοντος** που κάποιος
 * πρέπει να θυμηθεί — ασφάλεια **opt-in**. Εδώ δεν υπάρχει διακόπτης: αν ο server μιλά σε
 * **emulator**, κάθε σύνδεσμος του email δείχνει σε δεδομένα που **δεν υπάρχουν** στον πραγματικό
 * κόσμο ⇒ το email **δεν έχει θέση** εκεί. Όσα κλειδιά κι αν έχει το `.env`.
 *
 * ⚠️ **ΓΕΓΟΝΟΣ, ΟΧΙ ΠΟΛΙΤΙΚΗ** — ίδια δικαιολόγηση με το ADR-821 §3.1α (`identity-fabrication`):
 * οι μεταβλητές είναι του **ίδιου του Firebase SDK**, ήδη ορισμένες από το `dev:emulator`. Δεύτερη
 * μεταβλητή-διακόπτης δίπλα στο `NODE_ENV` θα ήταν ακριβώς το λάθος. Το `NODE_ENV` **δεν** ρωτιέται:
 * `next dev` πάνω στην πραγματική βάση = πραγματικά δεδομένα = πραγματικό email (σκόπιμα).
 *
 * @module server/comms/egress/email-delivery-mode
 * @see ADR-876 §5.8 Σ22
 */

/** `deliver` = στο δίκτυο του παρόχου · `capture` = στο τοπικό outbox, **ποτέ** στο δίκτυο. */
export type EmailDeliveryMode = 'deliver' | 'capture';

/** Οι μεταβλητές του Firebase SDK που λένε «μιλάς σε emulator». */
const EMULATOR_HOST_VARS = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'] as const;

type EnvLike = Readonly<Record<string, string | undefined>>;

export function emailDeliveryMode(env: EnvLike = process.env): EmailDeliveryMode {
  const onEmulator = EMULATOR_HOST_VARS.some((name) => (env[name] ?? '').trim().length > 0);
  return onEmulator ? 'capture' : 'deliver';
}
