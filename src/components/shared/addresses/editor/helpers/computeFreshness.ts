/**
 * =============================================================================
 * computeFreshness — pure helper (ADR-332 §3.10 / Phase 8 · D27 Ζ6)
 * =============================================================================
 *
 * Μετατρέπει την **αποθηκευμένη θέση** μιας διεύθυνσης στη διακριτή τιμή `AddressFreshness`
 * που καταναλώνει το `<AddressFreshnessIndicator>`. Καθαρή συνάρτηση — χωρίς React, χωρίς
 * `Date.now()` μέσα στη μετατροπή (το ρολόι εγχέεται για ντετερμινισμό).
 *
 * Κατώφλια χρόνου, ίδια με τις βαθμίδες φρεσκάδας των enterprise CRM/ERP
 * (Salesforce Maps, HubSpot, Pipedrive):
 *
 *   ηλικία = now − verifiedAt
 *   < 24ω        → fresh
 *   24ω .. 7η    → recent
 *   7η  .. 30η   → aging   (staleReason: time-elapsed)
 *   > 30η        → stale   (staleReason: time-elapsed)
 *
 * `null` / `undefined` `verifiedAt` → `never`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-332 D27 Ζ6 — ΓΙΑΤΙ ΔΕΧΕΤΑΙ ΤΗ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΟΧΙ ΣΚΕΤΟ `verifiedAt`
 * ────────────────────────────────────────────────────────────────────────────
 * Ο τύπος `AddressFreshness` δήλωνε **τρεις** λόγους παλαίωσης — `field-changed`,
 * `time-elapsed`, `force-refresh-pending` — και ο δείκτης είχε **μεταφράσεις και για τους
 * τρεις** (`addresses.json`). Σε **παραγωγή** όμως παραγόταν **μόνο** ο `time-elapsed`: το
 * `field-changed` ζούσε αποκλειστικά ως fixture της demo σελίδας και ως **εφήμερη** φάση της
 * μηχανής του editor. Φρουρός με σωστό κριτήριο και **ανύπαρκτη είσοδο**.
 *
 * Η είσοδος υπάρχει από το Ζ6: η θέση κουβαλά **το κείμενο για το οποίο λύθηκε**
 * (`geocodingMetadata.resolvedFor`). Παίρνοντας **τη διεύθυνση** αντί για ένα πεδίο της,
 * κανένας καλών δεν *μπορεί* να ξεχάσει την ερώτηση — ίδιο ιδίωμα με το `AddressPosition`,
 * όπου η απώλεια ακρίβειας δεν είναι δύσκολη αλλά **μη εκφράσιμη**.
 *
 * ⚠️ **«Λύθηκε για άλλο κείμενο» υπερισχύει της ηλικίας.** Μια θέση επιβεβαιωμένη πριν από
 * ένα λεπτό, αλλά για **άλλη** διεύθυνση, δεν είναι «φρέσκια» με καμία έννοια χρήσιμη στον
 * άνθρωπο: η ηλικία απαντά *πότε* ρωτήσαμε, το Ζ6 απαντά *τι* ρωτήσαμε.
 *
 * @module components/shared/addresses/editor/helpers/computeFreshness
 * @see ADR-332 §3.10 Read-only mode enrichment · D27 Ζ6
 */

import { positionTextVerdict, type AddressLike } from '@/lib/geocoding/address-position';
import type { AddressFreshness } from '../types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

function freshnessByAge(verifiedAt: number, nowMs: number): AddressFreshness {
  const age = nowMs - verifiedAt;
  if (age < ONE_DAY_MS) return { verifiedAt, level: 'fresh' };
  if (age < ONE_WEEK_MS) return { verifiedAt, level: 'recent' };
  if (age < ONE_MONTH_MS) return { verifiedAt, level: 'aging', staleReason: 'time-elapsed' };
  return { verifiedAt, level: 'stale', staleReason: 'time-elapsed' };
}

/**
 * Μετατρέπει την αποθηκευμένη θέση σε έτοιμο προς απόδοση σήμα φρεσκάδας.
 * Το `nowMs` εγχέεται ώστε καλούντες και άγκυρες να μένουν ντετερμινιστικοί.
 */
export function computeFreshness(
  address: AddressLike | null | undefined,
  nowMs: number = Date.now(),
): AddressFreshness {
  const verifiedAt = typeof address?.verifiedAt === 'number' ? address.verifiedAt : null;

  // Ζ6 — η **ταυτότητα** του κειμένου κρίνεται πριν από την ηλικία: μια θέση που λύθηκε για
  // άλλη διεύθυνση είναι μπαγιάτικη ό,τι ώρα κι αν επιβεβαιώθηκε.
  if (address && positionTextVerdict(address) === 'differs') {
    return { verifiedAt, level: 'stale', staleReason: 'time-elapsed' };
  }

  if (verifiedAt === null) return { verifiedAt: null, level: 'never' };
  return freshnessByAge(verifiedAt, nowMs);
}
