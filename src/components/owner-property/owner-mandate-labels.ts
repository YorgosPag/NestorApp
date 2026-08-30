'use client';

/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ** για την προβολή της ακμής στον **ιδιοκτήτη**.
 * @related ADR-834 §5 · lib/mandate/owner-mandate-view.ts · N.11 · CHECK 3.8
 * @module components/owner-property/owner-mandate-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΜΙΑ ΑΚΜΗ, ΔΥΟ ΟΠΤΙΚΕΣ — ΚΑΙ Η ΔΙΑΦΟΡΑ ΖΕΙ **ΜΟΝΟ ΕΔΩ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ταξινομητής ({@link mandateStandingOf}) είναι **ο ίδιος** με του καταλόγου του
 * γραφείου. Αυτό που αλλάζει είναι **ποιος ρωτά**, και η ίδια κατάσταση σημαίνει
 * **διαφορετική δουλειά** για τον καθένα:
 *
 * | Κατάσταση | Το γραφείο διαβάζει | Ο ιδιοκτήτης διαβάζει |
 * |---|---|---|
 * | `unannounced-live` | 🔴 *«διαφημίζεται και **δεν του το είπαμε**»* — ζήτημα συμμόρφωσης | *«η εντολή σου **ισχύει**»* — το βλέπει **τώρα**, άρα το ξέρει |
 * | `awaiting-view` | *«δεν άνοιξε το email»* | 🔴 *«ένα γραφείο **δηλώνει** εντολή που **δεν έχεις επιβεβαιώσει**»* |
 * | `expired` | *«κουβέντα ανανέωσης»* | *«τελείωσε — είσαι ελεύθερος»* |
 *
 * ⛔ **ΓΙ' ΑΥΤΟ ΔΕΝ ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΤΑ `STANDING_LABEL_KEYS` ΤΟΥ ΚΑΤΑΛΟΓΟΥ.**
 * Δεν είναι διπλότυπο — είναι **δεύτερο ακροατήριο**. Κοινό κείμενο θα ήταν σωστό σε
 * **καμία** από τις δύο οθόνες (ίδιο σκεπτικό με το `tax-identity-required`, που ζει
 * στη βάση της φόρμας του και όχι στο `common-account`).
 *
 * 🔑 **ΤΟ ΕΙΔΟΣ ΣΥΜΦΩΝΙΑΣ ΚΑΙ ΟΙ ΠΡΑΞΕΙΣ ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΑΥΤΟΥΣΙΑ**
 * (`LISTING_AGREEMENT_I18N_KEYS` · `OFFER_KIND_I18N_KEYS`): εκεί το κείμενο είναι
 * **ονομασία του πράγματος**, όχι οδηγία προς ακροατήριο — «αποκλειστική εντολή»
 * σημαίνει το ίδιο και για τους δύο. Αντιγραφή τους εδώ θα ήταν το διπλότυπο που
 * το CHECK 3.28 μπλοκάρει, και σωστά.
 *
 * ⛔ **ΚΑΝΕΝΑ δυναμικό `t(\`…${x}\`)`** — δομικά αόρατο στη CHECK 3.8 (§8.33, μάθημα Μ-Η).
 */

import type { MandateStanding } from '@/lib/mandate/mandate-standing';
import type { MandateProofVia } from '@/types/owner-property-mandate';

export const OWNER_MANDATE_NS = 'property-market';

/**
 * ⚠️ **ΕΝΙΚΟΣ (`offer.mandate`), και ο κατάλογος του γραφείου είναι ΠΛΗΘΥΝΤΙΚΟΣ
 * (`offer.mandates`)** — η ρίζα ονομάζει το ερώτημα: εδώ *«η σύμβασή **μου**»*, εκεί
 * *«οι εντολές **μας**»*. Δύο ρίζες, δύο ακροατήρια, μηδέν σύγχυση κλειδιών.
 */
const K = 'property-market:offer.mandate';

/** Τα κείμενα του πλαισίου — τίτλοι, ετικέτες πεδίων, εκβάσεις. */
export const OWNER_MANDATE_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  agencyLabel: `${K}.agencyLabel`,
  /**
   * 🔴 **ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ ΔΥΟ** — ίδιο ιδίωμα με την κάρτα αναζήτησης
   * (`ListingCard.tsx`): «γραφείο με επωνυμία», «γραφείο **χωρίς** επωνυμία», και
   * «δεν ξέρω **ποιο** γραφείο» *(έγγραφο προ-ADR-832, χωρίς `agencyCompanyId` —
   * υπάρχει **ζωντανό** στη βάση)*. Ένα κενό «Γραφείο: » διαβάζεται ως σπασμένη οθόνη.
   */
  agencyUnknown: `${K}.agencyUnknown`,
  agencyUnnamed: `${K}.agencyUnnamed`,
  roleLabel: `${K}.roleLabel`,
  roleUnknown: `${K}.roleUnknown`,
  scopeLabel: `${K}.scopeLabel`,
  scopeUnknown: `${K}.scopeUnknown`,
  periodLabel: `${K}.periodLabel`,
  periodOpenStart: `${K}.periodOpenStart`,
  feeLabel: `${K}.feeLabel`,
  feePercentage: `${K}.feePercentage`,
  feeFixed: `${K}.feeFixed`,
  feeVatIncluded: `${K}.feeVatIncluded`,
  feeVatExcluded: `${K}.feeVatExcluded`,
  proofLabel: `${K}.proofLabel`,
  expiresIn: `${K}.expiresIn`,
  /**
   * 🔑 **Η ΜΟΝΗ «πράξη» της οθόνης, και είναι ΠΛΗΡΟΦΟΡΙΑ** (ADR-827 §9.8): η βιτρίνα
   * **δεν** δίνει τηλέφωνο ή email — το άρθρο 200 §1 θέλει **εγγράφως**. Ο άνθρωπος
   * μαθαίνει **σε ποιον** απευθύνεται· το κανάλι δεν το ανοίγει αυτή η οθόνη.
   */
  contactNote: `${K}.contactNote`,
} as const;

/**
 * **Τι σημαίνει η κατάσταση ΓΙΑ ΤΟΝ ΙΔΙΟΚΤΗΤΗ** — εξαντλητικά.
 *
 * ⚠️ Ο τύπος `Record<MandateStanding, string>` ⇒ **ενδέκατη κατάσταση δεν
 * μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι σημαίνει **για αυτόν**. Είναι ο
 * λόγος που ο πίνακας δεν έγινε `Partial` με εφεδρεία: η εφεδρεία θα ζωγράφιζε στον
 * εντολέα κείμενο γραμμένο για τον **μεσίτη**.
 */
export const OWNER_STANDING_KEYS: Record<MandateStanding, string> = {
  'unannounced-live': `${K}.standing.unannounced-live`,
  'never-notified': `${K}.standing.never-notified`,
  'link-revoked': `${K}.standing.link-revoked`,
  'expiring-soon': `${K}.standing.expiring-soon`,
  'awaiting-decision': `${K}.standing.awaiting-decision`,
  'awaiting-view': `${K}.standing.awaiting-view`,
  declined: `${K}.standing.declined`,
  expired: `${K}.standing.expired`,
  'expired-unanswered': `${K}.standing.expired-unanswered`,
  live: `${K}.standing.live`,
};

/**
 * **Πώς προκύπτει η συμφωνία** — η απόδειξη, στη γλώσσα του εντολέα.
 *
 * 🔴 **Η ΔΙΑΦΟΡΑ ΤΩΝ ΔΥΟ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ ΓΙΑ ΑΥΤΟΝ**: `owner-consent` σημαίνει
 * *«το ζήτησες εσύ»*· `agency-attestation` σημαίνει *«το **δήλωσε** το γραφείο»* — και
 * το δεύτερο είναι ακριβώς η περίπτωση όπου ο άνθρωπος πρέπει να μπορεί να πει «όχι».
 */
export const OWNER_PROOF_KEYS: Record<MandateProofVia, string> = {
  'owner-consent': `${K}.proof.owner-consent`,
  'agency-attestation': `${K}.proof.agency-attestation`,
};

/** **Ο παρονομαστής**: κάθε κατάσταση έχει κείμενο **αυτής** της ρίζας (CHECK 3.54). */
export function everyStandingNamedForOwner(standings: readonly MandateStanding[]): boolean {
  return standings.every((standing) => (OWNER_STANDING_KEYS[standing] ?? '').startsWith(K));
}
