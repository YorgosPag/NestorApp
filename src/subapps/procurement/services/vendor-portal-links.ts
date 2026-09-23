/**
 * =============================================================================
 * ΟΙ ΣΥΝΔΕΣΜΟΙ ΤΗΣ ΠΥΛΗΣ ΠΡΟΜΗΘΕΥΤΗ — **ΕΝΑ** ΣΗΜΕΙΟ (N.0.2 · N.18 · ADR-853 §19 Θ6)
 * =============================================================================
 *
 * 🔴 **Το εύρημα (2026-09-22)**: το `rfq-service` και το `vendor-invite-service` έγραφαν
 * **τους ίδιους δύο** συνδέσμους (`/vendor/quote/{token}` και `…/decline`), με **ίδια**
 * αιτιολόγηση αποτυχίας, κάτω από **διαφορετικά ονόματα** (`rfqPortalUrl` ·
 * `buildPortalUrl`). Ο κλασικός sibling clone του N.18: το διπλό όνομα κρύβει το διπλό
 * σώμα από κάθε αναζήτηση με ονόματα — το βλέπει **μόνο** ο token-based έλεγχος.
 *
 * ⚠️ **Το ίδιο το σχόλιο περιέγραφε τον κλώνο και τον κρατούσε** — και στα δύο αρχεία,
 * αυτολεξεί. Τεκμηρίωση της αντιγραφής δεν είναι κεντρικοποίηση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Η ΑΠΟΤΥΧΙΑ ΕΙΝΑΙ ΟΡΑΤΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μια πρόσκληση προμηθευτή **είναι** ο σύνδεσμός της: δεν υπάρχει «μισή πρόσκληση» να
 * σταλεί. Γι' αυτό `requirePublicOrigin` και όχι `publicUrl` — καλύτερα να κοκκινίσει η
 * πράξη παρά να φύγει email με σχετικό ή ξένο σύνδεσμο.
 *
 * @module subapps/procurement/services/vendor-portal-links
 * @enterprise ADR-327 §7 — Phase 3 Vendor Portal
 */

import { requirePublicOrigin } from '@/lib/http/public-origin';

/** Η πράξη που χάνεται όταν δεν ξέρουμε ποιοι είμαστε — μπαίνει στο μήνυμα του σφάλματος. */
const VENDOR_PORTAL_PURPOSE = 'ο σύνδεσμος της πύλης προμηθευτή δεν μπορεί να χτιστεί.';

/** Η πύλη όπου ο προμηθευτής **υποβάλλει** προσφορά. */
export function vendorPortalUrl(token: string): string {
  return `${requirePublicOrigin(VENDOR_PORTAL_PURPOSE)}/vendor/quote/${encodeURIComponent(token)}`;
}

/**
 * Η πρόθεση που κουβαλά ο σύνδεσμος — **μόνο προσυμπλήρωση**, ποτέ πράξη (ADR-876).
 * Κατασκευαστής ({@link vendorDeclineUrl}) και αναγνώστης ({@link readVendorPortalIntent})
 * ζουν εδώ μαζί, ώστε η λέξη να μην μπορεί να αποκλίνει ανάμεσα στο email και στη σελίδα.
 */
export const VENDOR_PORTAL_INTENTS = ['decline'] as const;
export type VendorPortalIntent = (typeof VENDOR_PORTAL_INTENTS)[number];

/**
 * Η **άρνηση**: η ΙΔΙΑ σελίδα, με τον διάλογο άρνησης ανοιχτό.
 *
 * 🔴 **ΔΙΟΡΘΩΣΗ ΝΕΚΡΟΥ ΣΥΝΔΕΣΜΟΥ (ADR-876 Ε3).** Εδώ έγραφε `…/<token>/decline` — διαδρομή
 * **χωρίς σελίδα** (υπάρχει μόνο το `POST /api/vendor/quote/<token>/decline`). Ο σύνδεσμος
 * «δεν ενδιαφέρομαι» κάθε πρόσκλησης έβγαζε 404, σε κάθε περιβάλλον, από την πρώτη μέρα.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ «ΑΡΝΗΣΗ ΜΕ ΕΝΑ GET»**: το email του προμηθευτή καταλήγει συχνά πίσω από
 * Microsoft Defender Safe Links / Mimecast / Proofpoint, που **ανοίγουν κάθε σύνδεσμο πριν
 * τον άνθρωπο**. GET που αρνείται θα αρνιόταν για λογαριασμό του προμηθευτή χωρίς να το δει
 * κανείς. Η πράξη φεύγει **μόνο** από το κουμπί του διαλόγου (POST) — πρότυπο του
 * `hours-question/[token]` (`?answer=` = προσυμπλήρωση).
 */
export function vendorDeclineUrl(token: string): string {
  const intent: VendorPortalIntent = 'decline';
  return `${vendorPortalUrl(token)}?intent=${intent}`;
}

/** `?intent=` → γνωστή πρόθεση ή `null`. Πίνακας ή σκουπίδι ⇒ καμία (όπως το `?answer=`). */
export function readVendorPortalIntent(raw: string | string[] | undefined): VendorPortalIntent | null {
  return VENDOR_PORTAL_INTENTS.find((intent) => intent === raw) ?? null;
}
