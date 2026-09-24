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

/** Η διαδρομή της πύλης — **χωρίς** διαπιστευτήριο. Το token ζει μόνο στο fragment. */
export const VENDOR_PORTAL_PATH = '/vendor/quote';

/** Τα κλειδιά του fragment — κατασκευαστής και αναγνώστης δένονται στα ίδια ονόματα. */
const FRAGMENT_TOKEN_KEY = 't';
const FRAGMENT_INTENT_KEY = 'intent';

/**
 * Η πρόθεση που κουβαλά ο σύνδεσμος — **μόνο προσυμπλήρωση**, ποτέ πράξη (ADR-876).
 * Κατασκευαστής ({@link vendorDeclineUrl}) και αναγνώστης ({@link readVendorPortalFragment})
 * ζουν εδώ μαζί, ώστε η λέξη να μην μπορεί να αποκλίνει ανάμεσα στο email και στη σελίδα.
 */
export const VENDOR_PORTAL_INTENTS = ['decline'] as const;
export type VendorPortalIntent = (typeof VENDOR_PORTAL_INTENTS)[number];

/**
 * Η **σχετική** θέση της πύλης (διαδρομή + fragment) — ο ΕΝΑΣ κατασκευαστής. Ο απόλυτος σύνδεσμος
 * του email ({@link vendorPortalUrl}) και η ανακατεύθυνση της παλιάς μορφής την καλούν και οι δύο.
 */
export function vendorPortalLocation(token: string, intent: VendorPortalIntent | null): string {
  const fragment = new URLSearchParams({ [FRAGMENT_TOKEN_KEY]: token });
  if (intent) fragment.set(FRAGMENT_INTENT_KEY, intent);
  return `${VENDOR_PORTAL_PATH}#${fragment.toString()}`;
}

function portalLink(token: string, intent: VendorPortalIntent | null): string {
  return `${requirePublicOrigin(VENDOR_PORTAL_PURPOSE)}${vendorPortalLocation(token, intent)}`;
}

/**
 * Η πύλη όπου ο προμηθευτής **υποβάλλει** προσφορά.
 *
 * 🔴 **ΤΟ TOKEN ΣΤΟ FRAGMENT, ΠΟΤΕ ΣΤΗ ΔΙΑΔΡΟΜΗ (ADR-876 §5 Σ8 · W3C TAG *Capability URLs*).**
 * Ο browser **δεν στέλνει ποτέ** το `#…` στον server: μηδέν access log (Netcup), μηδέν
 * `Referer`, και τα Safe Links / Mimecast / Proofpoint που «πατούν» τον σύνδεσμο πριν τον
 * άνθρωπο δεν βλέπουν ποτέ το διαπιστευτήριο. Ζούσε στη διαδρομή (`/vendor/quote/<token>`)
 * και κάθε επίσκεψη το έγραφε στα logs — το `no-referrer` δεν το έλυνε.
 */
export function vendorPortalUrl(token: string): string {
  return portalLink(token, null);
}

/**
 * Η **άρνηση**: η ΙΔΙΑ σελίδα, με τον διάλογο άρνησης ανοιχτό.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ «ΑΡΝΗΣΗ ΜΕ ΕΝΑ GET»**: τα Safe Links **ανοίγουν κάθε σύνδεσμο πριν τον
 * άνθρωπο**. Η πράξη φεύγει **μόνο** από το κουμπί του διαλόγου (POST) — ADR-876 Ε3.
 */
export function vendorDeclineUrl(token: string): string {
  return portalLink(token, 'decline');
}

/** Άγνωστη τιμή → γνωστή πρόθεση ή `null`. Πίνακας ή σκουπίδι ⇒ καμία (όπως το `?answer=`). */
export function asVendorPortalIntent(raw: unknown): VendorPortalIntent | null {
  return VENDOR_PORTAL_INTENTS.find((known) => known === raw) ?? null;
}

/** Ό,τι λέει το fragment: το διαπιστευτήριο και (προαιρετικά) η πρόθεση. */
export interface VendorPortalFragment {
  readonly token: string | null;
  readonly intent: VendorPortalIntent | null;
}

/** `#t=…&intent=…` → {token, intent}. Σκουπίδι ή απουσία ⇒ `null` (όπως το `?answer=`). */
export function readVendorPortalFragment(hash: string): VendorPortalFragment {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const token = params.get(FRAGMENT_TOKEN_KEY);
  const intent = params.get(FRAGMENT_INTENT_KEY);
  return {
    token: token && token.length > 0 ? token : null,
    intent: asVendorPortalIntent(intent),
  };
}
