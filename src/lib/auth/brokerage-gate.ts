/**
 * @fileoverview **Ο ΦΡΟΥΡΟΣ ΤΗΣ ΡΥΘΜΙΖΟΜΕΝΗΣ ΠΡΑΞΗΣ ΣΤΟ ΣΥΝΟΡΟ** — μία άρνηση, ένα σχήμα.
 * @related ADR-824 §6 · ADR-827 §9.13 · lib/auth/brokerage-authority.ts
 * @module lib/auth/brokerage-gate
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ — ΤΟ ΑΡΧΕΙΟ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ ΤΟ ΕΙΧΕ ΗΔΗ ΠΡΟΒΛΕΨΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κώδικας αυτός ζούσε **route-local** στο `owner-properties/brokered/route.ts`, με
 * γραμμένο το μάθημα από την πρώτη του αντιγραφή:
 *
 * > *«**ΕΝΑ σχήμα άρνησης, ΕΝΑ σημείο.** Η πρώτη γραφή αντέγραψε το μπλοκ `403` στον
 * > δεύτερο χειριστή. Δύο αντίγραφα σημαίνουν ότι μια μελλοντική αλλαγή στο σχήμα
 * > θα εφαρμοζόταν στο ένα ρήμα και όχι στο άλλο — και ο πελάτης θα διάβαζε **δύο
 * > διαφορετικές** αρνήσεις από την **ίδια** διεύθυνση.»*
 *
 * 🔑 **Η Φάση Β του ADR-827 γεννά τη ΔΕΥΤΕΡΗ ΔΙΕΥΘΥΝΣΗ** *(η βιτρίνα του γραφείου)*,
 * που κάνει **ακριβώς** την ίδια ερώτηση. Αφημένος εκεί, ο φρουρός θα αντιγραφόταν —
 * η ίδια κλάση, ένα επίπεδο ψηλότερα: όχι δύο ρήματα μιας διεύθυνσης, αλλά **δύο
 * διευθύνσεις**. Η εξαγωγή έγινε **πριν** γραφτεί το δίδυμο (N.0.2 · N.18).
 *
 * ⚠️ **ΔΕΝ είναι νέος κριτής** (CHECK 3.68). Ο κριτής παραμένει ο
 * {@link requireBrokerageCapability}· εδώ ζει **μόνο** η μετάφρασή του σε HTTP —
 * ακριβώς ο ρόλος που το `_shared/respond.ts` παίζει για τον γραφέα του ακινήτου.
 *
 * **Layering**: σύνορο — Admin SDK για **μία** ανάγνωση, καμία απόφαση δική του.
 */

import 'server-only';

import { NextResponse } from 'next/server';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import {
  isBrokerageDenial,
  requireBrokerageCapability,
  type BrokerageAuthority,
} from '@/lib/auth/brokerage-authority';
import { readCompanyCapabilities } from '@/services/company/company-capabilities.reader';

/**
 * 🔴 **Η ΑΡΝΗΣΗ ΤΗΣ ΡΥΘΜΙΖΟΜΕΝΗΣ ΠΡΑΞΗΣ — δικό της σχήμα, επίτηδες.**
 *
 * Δεν είναι σφάλμα οντότητας: εκείνο απαντά *«η **αγγελία** σου λέει κάτι λάθος»* και
 * οδηγεί τον άνθρωπο **στη φόρμα**. Αυτό λέει *«**δεν επιτρέπεσαι** σε αυτή τη
 * δραστηριότητα»* και τον οδηγεί **στις ρυθμίσεις του οργανισμού**. Κοινός κάδος θα
 * τον έστελνε να διορθώσει το εμβαδόν επειδή το γραφείο του δεν είναι μεσιτικό.
 *
 * ⚠️ **Το `capabilityStatus` ταξιδεύει**: *«δεν δήλωσες ποτέ»* ≠ *«εκκρεμεί»* ≠
 * *«σου ανακλήθηκε»* — τρεις **διαφορετικές** θεραπείες στην οθόνη.
 */
export interface BrokerageDeniedResponse {
  readonly error: 'BROKERAGE_NOT_ALLOWED';
  readonly reason: string;
  readonly capabilityStatus: string;
}

/**
 * **Η απόδειξη, ή η απάντηση 403** — ποτέ `boolean`.
 *
 * Ένα `true/false` θα ανάγκαζε τον καλούντα να **ξανακατασκευάσει** την απόδειξη,
 * δηλαδή **δεύτερη κρίση** για το ίδιο ερώτημα· και οι γραφείς της Φάσης Α/Β δέχονται
 * **μόνο** {@link BrokerageAuthority} (ADR-824 §6).
 *
 * 🔑 **Καλείται ΠΡΩΤΟΣ, πριν διαβαστεί το σώμα.** Δύο πράγματα μαζί: δεν κάνουμε
 * δουλειά για αιτούντα που δεν επιτρέπεται, και **δεν του λέμε αν το JSON του ήταν
 * έγκυρο** — άρνηση που περιγράφει το σώμα είναι κανάλι πληροφορίας προς κάποιον που
 * δεν έπρεπε καν να φτάσει εκεί.
 */
export async function gateBrokerage(
  adminDb: AdminFirestore,
  companyId: string | null,
): Promise<BrokerageAuthority | NextResponse<BrokerageDeniedResponse>> {
  const verdict = requireBrokerageCapability(
    // ⚠️ Ο κριτής θέλει συμβολοσειρά· ο `null` καλών **δεν έχει οργανισμό**, άρα
    //    δεν έχει ικανότητα — και το κενό αναγνωριστικό δίνει `unrequested`
    //    (fail-closed) χωρίς να χρειάζεται δεύτερος έλεγχος εδώ.
    companyId ?? '',
    await readCompanyCapabilities(adminDb, companyId),
  );

  if (isBrokerageDenial(verdict)) {
    return NextResponse.json(
      {
        error: 'BROKERAGE_NOT_ALLOWED',
        reason: verdict.reason,
        capabilityStatus: verdict.status,
      } as const,
      { status: 403 },
    );
  }

  return verdict;
}
