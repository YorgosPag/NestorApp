import 'server-only';

/**
 * @fileoverview **Ο ΣΥΝΔΕΣΜΟΣ ΠΡΑΞΗΣ ΛΟΓΑΡΙΑΣΜΟΥ — ΠΑΝΤΑ ΣΤΗ ΔΙΚΗ ΜΑΣ ΔΙΕΥΘΥΝΣΗ** (ADR-851).
 * @module server/auth/auth-action-link
 *
 * Οι γεννήτριες του Admin SDK (`generatePasswordResetLink` · `generateEmailVerificationLink`)
 * χτίζουν τον σύνδεσμο πάνω στο `callbackUri` **της κονσόλας**. Αυτό το πεδίο έδειχνε επί
 * μήνες σε **νεκρό υποdomain του Vercel** (ADR-851 §1), και κανένα αρχείο του repo δεν το ήξερε.
 *
 * 🔑 **Εδώ κρατάμε από τον σύνδεσμο της Firebase ΜΟΝΟ τον κωδικό** (`mode` + `oobCode`) και
 * τον ξαναχτίζουμε πάνω στο `publicUrl()` + `AUTH_ROUTES.action`. Άρα κάθε email που
 * στέλνουμε **εμείς** δεν εξαρτάται **καθόλου** από τη ρύθμιση της κονσόλας — αυτή αφορά
 * πλέον μόνο όσα στέλνει η ίδια η Firebase, και τη φυλάει ο έλεγχος απόκλισης.
 *
 * ⚠️ Το `apiKey` της Firebase **δεν** ταξιδεύει: η σελίδα μας εφαρμόζει τον κωδικό με το
 * **δικό της** SDK, ήδη ρυθμισμένο.
 */

import { publicUrl } from '@/lib/http/public-origin';
import { AUTH_ROUTES } from '@/lib/routes/authRoutes';

/**
 * Οι παράμετροι που διαβάζει ο χειριστής `/auth/action` (`AuthActionContent.tsx`) — και
 * **μόνο** αυτές: ό,τι δεν διαβάζεται δεν ταξιδεύει σε email.
 */
const CARRIED_PARAMS = ['mode', 'oobCode'] as const;

/**
 * **Ο σύνδεσμος της Firebase, ξαναχτισμένος στη δική μας διεύθυνση.**
 *
 * @returns `null` αν λείπει κωδικός ή δημόσια διεύθυνση — ο καλών **δεν** στέλνει email με
 *   σύνδεσμο που δεν ξέρουμε πού οδηγεί (ποτέ σχετικός, ποτέ μαντεμένος — `public-origin.ts`).
 */
export function ownedActionLink(firebaseLink: string): string | null {
  let source: URL;
  try {
    source = new URL(firebaseLink);
  } catch {
    return null;
  }
  if (!source.searchParams.get('mode') || !source.searchParams.get('oobCode')) return null;

  const carried = new URLSearchParams();
  for (const key of CARRIED_PARAMS) {
    const value = source.searchParams.get(key);
    if (value) carried.set(key, value);
  }
  return publicUrl(`${AUTH_ROUTES.action}?${carried.toString()}`);
}
