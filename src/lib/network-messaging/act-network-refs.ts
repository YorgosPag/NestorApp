/**
 * @fileoverview **ΠΟΙΟ ΝΗΜΑ, ΠΟΙΑ ΟΜΑΔΑ ΑΝΗΚΟΥΝ ΣΕ ΑΥΤΗ ΤΗΝ ΕΝΤΟΛΗ** — ντετερμινιστική **εύρεση**, όχι γέννηση.
 * @related ADR-867 Β7 · §8 #8 · §4.1 (κλειδί από την πράξη) · `lib/network-edge/edge-sources.ts` (ο σπόρος)
 * @module lib/network-messaging/act-network-refs
 *
 * 🔑 **Γιατί ο πελάτης το υπολογίζει μόνος του, αντί να το ζητά από τη διαδρομή της εντολής** (το §8 #8
 * έλεγε «θα το εκθέσει η διαδρομή»): ① ο **ιδιοκτήτης** χτίζει τις εντολές του **στον πελάτη**
 * (`ownerMandateViews`) — δεν υπάρχει διαδρομή να το εκθέσει· ② τα κλειδιά είναι **ήδη** ντετερμινιστικά
 * από τον **ίδιο** σπόρο (`mandateActSeed`) με την **ίδια** μηχανή (`deterministicUuid`, browser + Node)·
 * μια διαδρομή θα ήταν **δεύτερη** απάντηση στο ίδιο ερώτημα (ADR-749).
 *
 * 🔒 **Η γνώση ενός id ΔΕΝ δίνει τίποτα**: η ανάγνωση κρίνεται από τον κανόνα (`network_audience/{uid}`
 * ζωντανή) και κάθε γραφή από τον γραφέα, μέσα σε συναλλαγή. Ξένο ή ανύπαρκτο νήμα απαντά **ίδια**
 * (permission-denied) — η οθόνη λέει «δεν υπάρχει συνομιλία εδώ», όχι «δεν σου επιτρέπεται».
 * ⛔ **Μόνο εύρεση**: ο πελάτης **δεν** γεννά νήμα ούτε ομάδα (κεφαλίδα `enterprise-id-network-generators`).
 */

import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import {
  generateDeterministicNetworkActTeamId,
  generateDeterministicNetworkActThreadId,
} from '@/services/enterprise-id.service';

export interface ActNetworkRefs {
  readonly threadId: string;
  readonly teamId: string;
}

/** Σπόρος πράξης ⇒ τα **δύο** κλειδιά της (ίδιος σπόρος — δες `enterprise-id-network-generators.ts`). */
export function actNetworkRefs(actSeed: string): ActNetworkRefs {
  return {
    threadId: generateDeterministicNetworkActThreadId(actSeed),
    teamId: generateDeterministicNetworkActTeamId(actSeed),
  };
}

/** Η εντολή (ακίνητο × γραφείο) ⇒ νήμα + ομάδα. */
export function mandateNetworkRefs(ownerPropertyId: string, agencyCompanyId: string): ActNetworkRefs {
  return actNetworkRefs(mandateActSeed(ownerPropertyId, agencyCompanyId));
}
