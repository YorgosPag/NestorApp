/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΠΗΓΩΝ ΑΚΜΗΣ** — ποιες πράξεις γεννούν ακμή, και πώς διαβάζεται η καθεμία.
 * @related ADR-867 §3 · §5 · ADR-834 §5 Β (α) ① · (δ) · types/network-thread.ts `NETWORK_ACT_KINDS`
 * @module lib/network-edge/edge-sources
 *
 * 🔑 **Εδώ, και ΜΟΝΟ εδώ, ο πυρήνας συναντά τις πράξεις.** Ο κριτής (`edge-judge.ts`) δεν
 * εισάγει τίποτα από αυτό το αρχείο. Σήμερα μία πηγή (`mandate`)· η συμμετοχή σε υπόθεση
 * (ADR-862 Φ1) = **μία** τιμή στο `NETWORK_ACT_KINDS` + **ένα** κλειδί στο `EdgeEvidenceByKind`
 * + **ένας** προβολέας εδώ. Ο τύπος `EdgeProjectors` **απαιτεί** το κλειδί, και η άγκυρα
 * συγκρίνει το μητρώο με το κλειστό σύνολο.
 */

import { isMandateAttributable } from '@/types/mandate';
import {
  mandatesOf,
  type BrokeredListingMandate,
  type OwnerPropertyMandate,
} from '@/types/owner-property-mandate';
import type { NetworkActKind } from '@/types/network-thread';
import {
  judgeEdge,
  presentId,
  type EdgeEnds,
  type EdgeEvidence,
  type EdgeProjectors,
  type EdgeVerdict,
  type NetworkEdge,
} from './edge-judge';

// ============================================================================
// ΠΗΓΗ 1 — ΕΝΤΟΛΗ (ADR-827 / ADR-832)
// ============================================================================

/**
 * Ό,τι χρειάζεται ο προβολέας από ένα `owner_properties/{ownp_*}` — **δομικός** τύπος, ώστε
 * να δέχεται και το ζωντανό έγγραφο με τον **ενικό** `mandate` (γι' αυτό `mandatesOf`, ποτέ
 * ωμό `.mandates`).
 */
export interface MandateEdgeRecord {
  readonly propertyId: string;
  readonly mandates?: readonly BrokeredListingMandate[];
  readonly mandate?: OwnerPropertyMandate;
}

/**
 * **Μία εντολή → μία ακμή, ή καμία.**
 *
 * | Συνθήκη | Γιατί |
 * |---|---|
 * | `isMandateAttributable` (`confirmed`) | «αποδεκτή» = ο άνθρωπος είπε ναι. ⚠️ **ΟΧΙ** `bindingMandates`: εκείνο κόβει και την **ανάκληση άδειας** του γραφείου — γεγονός του ρυθμιστή, όχι της σχέσης. Η ακμή **υπήρξε** (α) ① |
 * | **καμία** κρίση λήξης | (α) ① — τρέχουσα **ή παλιά** |
 * | `agencyCompanyId` παρόν | έγγραφο προ-ADR-832 **δεν ξέρει ποιο γραφείο** ⇒ καμία ακμή με όνομα, ποτέ μαντεψιά |
 * | `confirmedByUserId` παρόν | ιδιοκτήτης **χωρίς λογαριασμό** (απάντηση με σύνδεσμο) ⇒ κανένα πρόσωπο, κανένα νήμα — ADR-867 §8 #1 |
 *
 * 🔑 Το `confirmedByUserId` είναι το πρόσωπο **και στους δύο δρόμους** (ADR-867 §2.3): η αποδοχή
 * αιτήματος το γράφει = `requestedByUserId` (`mandate-acceptance-prepare.ts`)· η καταχώριση από
 * μεσίτη το αφήνει `null` μέχρι να επιβεβαιώσει ο ίδιος συνδεδεμένος.
 *
 * ⚠️ **Σπόρος `propertyId:agencyCompanyId`**: μία εντολή ανά (αγγελία, γραφείο) — ο γραφέας
 * αντικαθιστά κατά `agencyCompanyId` (`mandateWriteVerdict`). Νέα εντολή στο **ίδιο** γραφείο για
 * την **ίδια** αγγελία συνεχίζει το **ίδιο** νήμα, όπως η σχέση που συνεχίζεται.
 */
/**
 * 🔑 **Ο σπόρος της πράξης «εντολή», ΜΙΑ φορά.** Τον ζητούν **τρεις**: ο προβολέας ακμής εδώ,
 * ο γραφέας ομάδας (`act-team-writer.ts`) και ο γραφέας νήματος (Β4). Γραμμένος στο χέρι σε
 * καθέναν, μια αλλαγή μορφής θα γεννούσε **δεύτερο** νήμα για την **ίδια** πράξη — σιωπηλά.
 */
export function mandateActSeed(propertyId: string, agencyCompanyId: string): string {
  return `${propertyId}:${agencyCompanyId}`;
}

export function mandateEdgesOf(record: MandateEdgeRecord): readonly NetworkEdge<'mandate'>[] {
  const propertyId = presentId(record.propertyId);
  if (propertyId === null) return [];

  return mandatesOf(record).flatMap((mandate) => {
    const hostCompanyId = presentId(mandate.agencyCompanyId);
    const counterpartUid = presentId(mandate.confirmedByUserId);
    if (!isMandateAttributable(mandate) || hostCompanyId === null || counterpartUid === null) {
      return [];
    }
    return [
      {
        actKind: 'mandate',
        actSeed: mandateActSeed(propertyId, hostCompanyId),
        hostCompanyId,
        counterpartUid,
      },
    ];
  });
}

// ============================================================================
// ΤΟ ΜΗΤΡΩΟ
// ============================================================================

/** «Είδος πράξης → σχήμα τεκμηρίου». Τα κλειδιά **είναι** το `NETWORK_ACT_KINDS`. */
export interface EdgeEvidenceByKind {
  readonly mandate: MandateEdgeRecord;
}

/** Κάθε `NetworkActKind` **χωρίς** πηγή σπάει εδώ, στη μεταγλώττιση. */
type EveryActKindHasSource = Exclude<NetworkActKind, keyof EdgeEvidenceByKind> extends never ? true : never;
const EVERY_ACT_KIND_HAS_SOURCE: EveryActKindHasSource = true;
void EVERY_ACT_KIND_HAS_SOURCE;

export const EDGE_SOURCES: EdgeProjectors<EdgeEvidenceByKind> = {
  mandate: mandateEdgesOf,
};

export type NetworkEdgeEvidence = EdgeEvidence<EdgeEvidenceByKind>;

/** Ο κριτής δεμένος στο **πραγματικό** μητρώο — ό,τι καλεί ο διακομιστής. */
export function judgeNetworkEdge(
  evidence: readonly NetworkEdgeEvidence[],
  ends: EdgeEnds,
): EdgeVerdict<NetworkActKind> {
  return judgeEdge(evidence, ends, EDGE_SOURCES);
}

// ============================================================================
// ΤΟ ΑΝΤΙΚΕΙΜΕΝΟ ΤΗΣ ΠΡΑΞΗΣ — «για ΠΟΙΟ πράγμα μιλάμε;» (ADR-867 Β6)
// ============================================================================

/**
 * **Το αντικείμενο μιας πράξης**, όσο χρειάζεται ένα μήνυμα προς άνθρωπο («νέο μήνυμα για «Διαμέρισμα
 * Κυψέλη»»). Κλειστή ένωση: νέα πηγή ακμής με άλλο αντικείμενο = νέο μέλος εδώ.
 *
 * 🔑 **Ζει ΕΔΩ, όχι στον αποστολέα ειδοποιήσεων**: ο πυρήνας δεν ξέρει τι είναι «εντολή» (ADR-867 §3)·
 * το **μόνο** αρχείο που ξέρει ότι ο σπόρος μιας εντολής είναι `propertyId:agencyCompanyId` είναι αυτό.
 */
export type ActSubject = { readonly kind: 'listing'; readonly ownerPropertyId: string };

/**
 * Το **αντίστροφο** του {@link mandateActSeed} — `null` σε σπόρο που δεν έφτιαξε εκείνο.
 * ⚠️ Ελέγχεται με **επιστροφή**: ό,τι αναλύθηκε πρέπει να ξαναχτίζει **τον ίδιο** σπόρο, αλλιώς
 * `null` — ποτέ μισή ανάγνωση που θα έδειχνε λάθος αγγελία.
 */
export function mandateActSubject(actSeed: string): ActSubject | null {
  const cut = actSeed.indexOf(':');
  if (cut <= 0 || cut === actSeed.length - 1) return null;
  const propertyId = actSeed.slice(0, cut);
  const agencyCompanyId = actSeed.slice(cut + 1);
  return mandateActSeed(propertyId, agencyCompanyId) === actSeed
    ? { kind: 'listing', ownerPropertyId: propertyId }
    : null;
}

/** «Είδος πράξης → πώς διαβάζεται το αντικείμενο από τον σπόρο». Νέα πηγή χωρίς γραμμή ⇒ δεν μεταγλωττίζεται. */
const ACT_SUBJECTS: { readonly [K in NetworkActKind]: (actSeed: string) => ActSubject | null } = {
  mandate: mandateActSubject,
};

/** Το αντικείμενο μιας πράξης — ό,τι καλεί ο διακομιστής. */
export function actSubjectOf(actKind: NetworkActKind, actSeed: string): ActSubject | null {
  return ACT_SUBJECTS[actKind](actSeed);
}
