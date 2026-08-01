/**
 * Το «δεν βρέθηκε» της οικογένειας **`NextResponse`** του πόρου `contact`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΜΕΣΑ ΣΤΟ `contact-ownership.ts`
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο φύλακας είναι **καθαρό module** (μηδέν Firebase, μηδέν `next/server`) ώστε
 * η απόφαση ασφαλείας να δοκιμάζεται με σκέτα αντικείμενα σε περιβάλλον `node`.
 * Το `import { NextResponse } from 'next/server'` σέρνει το runtime του Next
 * και **έσπασε μετρημένα** τη σουίτα με `ReferenceError: Request is not defined`
 * — δηλαδή θα άφηνε τον φύλακα αδοκίμαστο για να κερδίσει ένα αρχείο.
 *
 * ⇒ Το κείμενο ζει στον φύλακα ({@link CONTACT_NOT_FOUND_MESSAGE}), το **σχήμα
 * σύρματος** εδώ.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `contactId` ΜΠΑΙΝΕΙ ΣΤΟ ΣΩΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο **γνήσιος** κλάδος αυτών των διαδρομών έγραφε
 * `{ success: false, error: 'Contact not found', contactId }` με `404`.
 * Μεταμφίεση που παρέλειπε το `contactId` θα ξεχώριζε από το γνήσιο **στο
 * σώμα** — δηλαδή θα μαρτυρούσε ακριβώς αυτό που υποτίθεται ότι κρύβει.
 * Η μεταμφίεση κρίνεται στο **ολόκληρο** σχήμα: κωδικός + σώμα + μήνυμα
 * (ADR-742 §7.1).
 *
 * @module app/api/contacts/_shared/contact-not-found-response
 * @see ./contact-ownership — το κείμενο (SSoT) + η απόφαση
 */

import { NextResponse } from 'next/server';
import { CONTACT_NOT_FOUND_MESSAGE } from './contact-ownership';

/**
 * Το **ένα** «δεν βρέθηκε» για τις διαδρομές που απαντούν με `NextResponse`
 * (`GET /[contactId]`, `[contactId]/properties`).
 *
 * Καλείται από **δύο** κλάδους που πρέπει να είναι πανομοιότυποι: το έγγραφο
 * όντως λείπει, ή ανήκει αλλού και ο καλών δεν δικαιούται να το μάθει.
 */
export function contactNotFoundResponse(contactId: string): NextResponse {
  return NextResponse.json(
    { success: false, error: CONTACT_NOT_FOUND_MESSAGE, contactId },
    { status: 404 },
  );
}
