/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τα «Στοιχεία ΓΕΜΗ» της βιτρίνας (ADR-841 §7 Α23.9 Φέτα Β).
 * @related components/mandate/agency-showcase-labels.ts (το πρότυπο) · N.11 · CHECK 3.8 · CHECK 3.34
 * @module components/mandate/agency-showcase-registry-labels
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ**: το `agency-showcase-labels.ts` είναι στις 493 γραμμές (N.7.1) — και η
 * υποσελίδα είναι **δική της πράξη** με **δικό της** route slice, όπως η κάρτα.
 *
 * ⚠️ **Κυριολεκτικά πρότυπα σε σταθερά module, ΜΙΑ ευρετηρίαση** — ποτέ ``t(`…gap.${gap}`)``: το δυναμικό
 * κλειδί είναι αόρατο στη CHECK 3.8 και ανεπίλυτο για τον τεμαχιστή του ADR-744 (μάθημα πληρωμένο τρεις
 * φορές, δες το `SHOWCASE_MARK_KIND_LABEL_KEYS`).
 *
 * 🔑 `Record` πάνω σε **κλειστά σύνολα**: νέο κενό κρίσης, νέος λόγος «δεν απάντησε» ή νέα έκβαση υιοθέτησης
 * **δεν μεταγλωττίζεται** χωρίς κείμενο.
 */

import type {
  LegalNameAdoptionFeedback,
  RegistryCopyErasureFeedback,
} from '@/hooks/company/useCompanyRegistryIdentity';
import type { RegistryAttentionGap, RegistryStanding } from '@/lib/agency/registry-standing';
import type { RegistryUnavailableReason } from '@/types/company-registry';

const K = 'property-market:mandate.showcase.registry';

export const SHOWCASE_REGISTRY_KEYS = {
  /** Ο τίτλος της πόρτας· η γραμμή κατάστασης έρχεται από το {@link SHOWCASE_REGISTRY_DOOR_KEYS}. */
  door: `${K}.door`,
  // ── Η ΥΠΟΣΕΛΙΔΑ ────────────────────────────────────────────────────────────────────────────
  title: `${K}.title`,
  lead: `${K}.lead`,
  /** ⚖️ GDPR άρθ. 14(2)(στ) — **από πού** προέρχονται τα στοιχεία: δημόσιο μητρώο. */
  source: `${K}.source`,
  loading: `${K}.loading`,
  /** 🔴 `forbidden` ≠ «δεν έχει ΓΕΜΗ»: η κρίση ανήκει στον διαχειριστή (η απάντηση φέρει έδρα). */
  forbidden: `${K}.forbidden`,
  unavailable: `${K}.unavailable`,
  verifiedOn: `${K}.verifiedOn`,
  unregistered: `${K}.unregistered`,
  verify: `${K}.verify`,
  verifying: `${K}.verifying`,
  /** Η διόρθωση ζει στο **μοναδικό** σημείο όπου γράφεται ο αριθμός — ποτέ δεύτερο πεδίο εδώ. */
  fixNumber: `${K}.fixNumber`,
  // ── «ΥΙΟΘΕΤΗΣΗ ΕΠΩΝΥΜΙΑΣ ΓΕΜΗ» (Α23.2) ────────────────────────────────────────────────────────
  adoptTitle: `${K}.adoptTitle`,
  adoptLead: `${K}.adoptLead`,
  adoptProfileName: `${K}.adoptProfileName`,
  adoptRegistryName: `${K}.adoptRegistryName`,
  adopt: `${K}.adopt`,
  adopting: `${K}.adopting`,
  // ── ΚΛΕΙΣΤΗ ΣΤΟ ΓΕΜΗ (Α23.1) ─────────────────────────────────────────────────────────────────
  closedTitle: `${K}.closedTitle`,
  closedBody: `${K}.closedBody`,
  closedWithdrawHint: `${K}.closedWithdrawHint`,
  // ── ΔΙΑΓΡΑΦΗ ΑΝΤΙΓΡΑΦΟΥ ΓΕΜΗ (Α23.12 · GDPR άρθ. 17/21) ─────────────────────────────────────
  erase: `${K}.erase`,
  erasing: `${K}.erasing`,
  eraseTitle: `${K}.eraseTitle`,
  /** Τι σβήνεται **και** τι χάνει η βιτρίνα — ο άνθρωπος αποφασίζει ξέροντας τη συνέπεια. */
  eraseBody: `${K}.eraseBody`,
  eraseConfirm: `${K}.eraseConfirm`,
} as const;

/** **Τι έγινε με τη διαγραφή** — αποτυχία λέγεται, ποτέ σιωπηλά (πράξη δικαιώματος του GDPR). */
export const SHOWCASE_REGISTRY_ERASURE_KEYS: Record<Exclude<RegistryCopyErasureFeedback, 'none'>, string> = {
  erased: `${K}.erasure.erased`,
  failed: `${K}.erasure.failed`,
};

/**
 * **Η ΓΡΑΜΜΗ ΚΑΤΑΣΤΑΣΗΣ ΤΗΣ ΠΟΡΤΑΣ** — η πόρτα λέει **πού στέκεται** ο οργανισμός, όχι μόνο πού οδηγεί
 * (Stripe: «action required» πάνω στο στοιχείο ρυθμίσεων). `unregistered`/`unknown` ⇒ η ουδέτερη περιγραφή:
 * ούτε «όλα καλά» σε κάτι που δεν ξέρουμε, ούτε συναγερμός σε όποιον δεν έχει ΓΕΜΗ.
 */
export const SHOWCASE_REGISTRY_DOOR_KEYS: Record<RegistryStanding['kind'], string> = {
  closed: `${K}.doorClosed`,
  verified: `${K}.doorVerified`,
  attention: `${K}.doorAttention`,
  unregistered: `${K}.doorHint`,
  unknown: `${K}.doorHint`,
};

/** **Γιατί δεν είναι επαληθευμένη** — κάθε κενό λέει **τι να κάνει** ο άνθρωπος. */
export const SHOWCASE_REGISTRY_GAP_KEYS: Record<RegistryAttentionGap, string> = {
  'invalid-registration-number': `${K}.gap.invalid-registration-number`,
  'not-checked': `${K}.gap.not-checked`,
  'check-unreadable': `${K}.gap.check-unreadable`,
  'not-in-registry': `${K}.gap.not-in-registry`,
  'number-mismatch': `${K}.gap.number-mismatch`,
  inactive: `${K}.gap.inactive`,
  'status-unknown': `${K}.gap.status-unknown`,
  'name-mismatch': `${K}.gap.name-mismatch`,
};

/** **Το ΓΕΜΗ δεν απάντησε** — N.12: «ξαναδοκίμασε» ≠ «θέμα διαχειριστή πλατφόρμας». */
export const SHOWCASE_REGISTRY_UNAVAILABLE_KEYS: Record<RegistryUnavailableReason, string> = {
  'not-configured': `${K}.unavailableReason.not-configured`,
  unauthorized: `${K}.unavailableReason.unauthorized`,
  'rate-limited': `${K}.unavailableReason.rate-limited`,
  server: `${K}.unavailableReason.server`,
  network: `${K}.unavailableReason.network`,
  'malformed-response': `${K}.unavailableReason.malformed-response`,
};

/** **Τι έγινε με την υιοθέτηση** — AIP-154: `registry-changed` ⇒ «δείτε τη νέα επωνυμία και ξαναπατήστε». */
export const SHOWCASE_REGISTRY_ADOPTION_KEYS: Record<Exclude<LegalNameAdoptionFeedback, 'none'>, string> = {
  adopted: `${K}.adoption.adopted`,
  'registry-changed': `${K}.adoption.registry-changed`,
  'not-adoptable': `${K}.adoption.not-adoptable`,
  failed: `${K}.adoption.failed`,
};
