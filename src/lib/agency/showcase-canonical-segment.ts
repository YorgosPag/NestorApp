/**
 * @fileoverview **ΠΟΙΑ ΕΙΝΑΙ Η ΚΑΝΟΝΙΚΗ ΔΙΕΥΘΥΝΣΗ ΜΙΑΣ ΒΙΤΡΙΝΑΣ;** — καθαρή κρίση, μηδέν I/O.
 * @related ADR-841 §7 Α22 · ADR-787 §5.3 ζ · app/(light)/pro/[alias]/page.tsx · lib/workspace/alias-registry
 * @module lib/agency/showcase-canonical-segment
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΥΜΠΤΩΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κάρτα αγγελίας συνδέει **κατά ταυτότητα** (`/pro/comp_<uuid>`) — απόφαση της Α1.6, με
 * λόγο: ένα ψευδώνυμο μέσα στο `PublicListing` θα ήταν **τρίτο** αντίγραφο του
 * `workspace_aliases`. Ο επισκέπτης όμως έβλεπε στη γραμμή διευθύνσεων
 * `localhost:3000/pro/comp_9c7c1a50-…` αντί για `/pro/pagonis` — ενώ η βιτρίνα **έχει**
 * ψευδώνυμο και το QR της κοινοποίησης **ήδη** το χρησιμοποιεί. Δύο διευθύνσεις για το ίδιο
 * περιεχόμενο = διπλότυπο (ίδιος λόγος με το `/search → /`).
 *
 * ✅ **Η θεραπεία ΔΕΝ είναι αντίγραφο — είναι ανακατεύθυνση** στον διακομιστή, όπως
 * LinkedIn/GitHub/Stack Overflow: η σταθερή ταυτότητα **πάντα λύνεται**, και στέλνει στο
 * ανθρώπινο όνομα. Το ADR-787 §5.3 ζ το έχει ήδη γραμμένο για τη **σχέση ταυτότητα →
 * ψευδώνυμο**: *«ο καλών που ξέρει το ψευδώνυμο οφείλει να στείλει εκεί (308)»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΨΕΥΔΩΝΥΜΟ ΤΗΣ ΒΙΤΡΙΝΑΣ ΕΙΝΑΙ ΑΝΤΙΓΡΑΦΟ — ΑΡΑ ΕΠΑΛΗΘΕΥΕΤΑΙ ΠΡΙΝ ΤΟ 308
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `PublicShowcase.alias` γράφει ο ίδιος ο τύπος: *«αντίγραφο, όχι αυθεντία»*. Ένα 308
 * **αποθηκεύεται** από τον φυλλομετρητή: αν στέλναμε σε ψευδώνυμο που πλέον λύνεται σε
 * **άλλο** γραφείο, θα κλειδώναμε τον επισκέπτη σε **ξένη** βιτρίνα. Άρα η ανακατεύθυνση
 * γίνεται **μόνο** όταν η αυθεντία (`resolveAlias`) επιβεβαιώνει ότι το ψευδώνυμο ανήκει
 * στο **ίδιο** `companyId` — αλλιώς η σελίδα αποδίδεται κανονικά. *Άγνωστο ≠ «στείλε»*.
 *
 * 🔑 **Καθαρή συνάρτηση επίτηδες**: η απόφαση ελέγχεται χωρίς Next, χωρίς Firestore — και
 * η σελίδα κάνει μόνο I/O.
 */

import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import type { AliasResolution } from '@/lib/workspace/alias-registry';

type FoundAlias = Extract<AliasResolution, { readonly outcome: 'found' }>;

export interface ShowcaseCanonicalInput {
  /** Πώς λύθηκε **η διεύθυνση που ζητήθηκε**. */
  readonly requested: FoundAlias;
  /** Το ψευδώνυμο που κρατά η **δημοσιευμένη** βιτρίνα, ή `null` όταν δεν δημοσιεύεται. */
  readonly publishedAlias: string | null;
  /** Τι απάντησε η αυθεντία για το `publishedAlias` — `null` όταν δεν ρωτήθηκε. */
  readonly publishedAliasResolution: AliasResolution | null;
}

/** Το τρέχον όνομα πίσω από ένα ψευδώνυμο που **λύθηκε** — παλιό ⇒ το κανονικό του. */
function currentName(resolution: FoundAlias, asked: string): string | null {
  return resolution.current ? asked : resolution.canonicalAlias;
}

/**
 * **Το τμήμα διεύθυνσης όπου ΠΡΕΠΕΙ να ζει αυτή η βιτρίνα**, ή `null` αν ήδη είμαστε εκεί
 * (ή αν δεν μπορεί να αποδειχθεί καλύτερο).
 *
 * | Ζητήθηκε | Κρίση |
 * |---|---|
 * | τρέχον ψευδώνυμο | `null` — ήδη κανονικό |
 * | **παλιό** ψευδώνυμο με γνωστό κανονικό | το κανονικό |
 * | ταυτότητα `comp_*`, βιτρίνα με ψευδώνυμο **του ίδιου** γραφείου | το ψευδώνυμο |
 * | ταυτότητα, ψευδώνυμο **ξένο / ανύπαρκτο / άγνωστο** | `null` — ποτέ 308 σε αμφιβολία |
 */
export function canonicalShowcaseSegment(input: ShowcaseCanonicalInput): string | null {
  const { requested, publishedAlias, publishedAliasResolution } = input;

  if (requested.form === 'alias') {
    return requested.current ? null : requested.canonicalAlias;
  }

  if (publishedAlias === null || publishedAliasResolution?.outcome !== 'found') return null;
  if (publishedAliasResolution.form !== 'alias') return null;
  // 🔑 Η ΜΙΑ ερώτηση «ίδιο γραφείο;» (ADR-742) — κενό `companyId` είναι απουσία, ποτέ ταύτιση.
  if (!isPayloadOwnedByCompany(publishedAliasResolution, requested.companyId)) return null;

  return currentName(publishedAliasResolution, publishedAlias);
}
