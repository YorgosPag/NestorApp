/**
 * @fileoverview **ΚΩΔΙΚΟΣ → ΚΛΕΙΔΙ ΚΕΙΜΕΝΟΥ** για τη βιτρίνα του γραφείου.
 * @related ADR-827 §9.10 · §9.13 στ · N.11 · CHECK 3.8
 * @module components/mandate/agency-showcase-labels
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ``t(`…rejection.${reason}`)``
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δυναμικό κλειδί θα ήταν μία γραμμή αντί για τρεις. Θα ήταν επίσης **αόρατο στη
 * CHECK 3.8**, που διαβάζει **κυριολεκτικά** ορίσματα του `t()` — κλειδί που λείπει θα
 * προσγειωνόταν πράσινο και θα έβγαινε **ωμό στην οθόνη**.
 *
 * 🔑 **Και ο πίνακας δίνει κάτι που καμία άγκυρα δεν μπορεί**: ο τύπος
 * `Record<AgencyProfileRejection, string>` κάνει τον **τέταρτο** λόγο άρνησης **να μη
 * μεταγλωττίζεται** μέχρι κάποιος να του δώσει κείμενο. Δυναμικό κλειδί θα «δούλευε»
 * και θα ζωγράφιζε `mandate.showcase.rejection.νεος-λογος` στην παραγωγή.
 *
 * ⚠️ **Ο πίνακας ΔΕΝ αντικαθιστά την άγκυρα — τη συμπληρώνει.** Ο μεταγλωττιστής φυλά
 * την **πληρότητα του πίνακα**· μόνο το `form-issue-keys.test.ts` (ομάδα `Μ`) φυλά ότι
 * το κλειδί **έχει λέξεις σε δύο γλώσσες**. Ένας πίνακας που δείχνει σε ανύπαρκτο
 * κλειδί μεταγλωττίζεται μια χαρά.
 */

import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import type { ShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';

/** Το namespace της βιτρίνας — **`property-market`**, το ίδιο με τον κατάλογο. */
export const SHOWCASE_NS = 'property-market';

const K = 'property-market:mandate.showcase';

export const SHOWCASE_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  aliasLabel: `${K}.aliasLabel`,
  aliasHint: `${K}.aliasHint`,
  nameLabel: `${K}.nameLabel`,
  nameHint: `${K}.nameHint`,
  namePlaceholder: `${K}.namePlaceholder`,
  // ── Η ΕΙΔΙΚΟΤΗΤΑ (Φ6-Β4) ─────────────────────────────────────────────────
  occupationLabel: `${K}.occupationLabel`,
  occupationHint: `${K}.occupationHint`,
  occupationPlaceholder: `${K}.occupationPlaceholder`,
  /** ⚠️ Ελεύθερο κείμενο **δεν** είναι ταξινομημένη ειδικότητα — το λέμε ρητά. */
  occupationUnclassified: `${K}.occupationUnclassified`,
  addOccupation: `${K}.addOccupation`,
  removeOccupation: `${K}.removeOccupation`,
  // ── ΤΟ ΜΗΤΡΩΟ, ΚΑΤΑ ΕΤΥΜΗΓΟΡΙΑ ───────────────────────────────────────────
  /** Η **αρχή** δεν επιλέγεται — ονομάζεται. Το `{{authority}}` έρχεται από τον πίνακα. */
  registryLabel: `${K}.registryLabel`,
  registryHint: `${K}.registryHint`,
  registryPlaceholder: `${K}.registryPlaceholder`,
  chapterLabel: `${K}.chapterLabel`,
  chapterHint: `${K}.chapterHint`,
  chapterPlaceholder: `${K}.chapterPlaceholder`,
  /** 🔑 *«Δεν τηρείται μητρώο. **Δεν σου λείπει τίποτα.**»* — Α9.3, όχι σιωπή. */
  registryNone: `${K}.registryNone`,
  /** 🔑 *«Δεν **έχουμε εξετάσει**…»* — υποκείμενο **εμείς**, ποτέ ο άνθρωπος. */
  registryUnexamined: `${K}.registryUnexamined`,
  placeLabel: `${K}.placeLabel`,
  placeHint: `${K}.placeHint`,
  noChannel: `${K}.noChannel`,
  publish: `${K}.publish`,
  publishing: `${K}.publishing`,
  publishedAt: `${K}.publishedAt`,
  republish: `${K}.republish`,
  withdraw: `${K}.withdraw`,
  withdrawing: `${K}.withdrawing`,
  withdrawHint: `${K}.withdrawHint`,
  statusPublished: `${K}.statusPublished`,
  statusNotPublished: `${K}.statusNotPublished`,
  notAllowed: `${K}.notAllowed`,
  /** Το URI δεν βρέθηκε στην ταξινομία ⇒ *«διάλεξε ξανά»*. */
  occupationUnknown: `${K}.occupationUnknown`,
  /** 🔴 *«Δεν μπορέσαμε να ρωτήσουμε»* ⇒ **ξαναδοκίμασε**, ΠΟΤΕ «διόρθωσε». */
  temporarilyUnavailable: `${K}.temporarilyUnavailable`,
  /** Ο δεσμός δεν δείχνει σε τόπο που υπάρχει. */
  placeNotFound: `${K}.placeNotFound`,
  failed: `${K}.failed`,
} as const;

/**
 * **ΤΟ ΣΗΜΑ** (ADR-841 §7 Α21, Φάση 2) — ξεχωριστός πίνακας, γιατί είναι ξεχωριστή πράξη.
 *
 * 🔑 **Δεν μπήκε στο {@link SHOWCASE_KEYS}** παρότι μοιράζεται πρόθεμα: εκείνος ο πίνακας
 * είναι το λεξιλόγιο της **δήλωσης** — κάθε γραμμή του ταξιδεύει στο ίδιο `publish`. Το
 * σήμα ταξιδεύει **μόνο του**, σε δική του διαδρομή, με δικές του αρνήσεις· ένας κοινός
 * πίνακας θα έκρυβε ακριβώς τη διάκριση που ολόκληρη η Φάση 2 πήγε να κάνει ορατή.
 *
 * ⚠️ **Κυριολεκτικά κλειδιά μέσα από σταθερά module** — ποτέ ``t(`…mark.${state}`)``: το
 * δυναμικό κλειδί είναι **αόρατο στη CHECK 3.8** και **ανεπίλυτο** για τον τεμαχιστή του
 * ADR-744. Το μάθημα είναι ήδη πληρωμένο σε αυτό ακριβώς το αρχείο.
 */
export const SHOWCASE_MARK_KEYS = {
  label: `${K}.mark.label`,
  hint: `${K}.mark.hint`,
  // ── Η ΕΠΙΛΟΓΗ ΕΙΔΟΥΣ ──────────────────────────────────────────────────────
  /** 🔑 *«Τι **δείχνει** η εικόνα;»* — ερώτηση για το **περιεχόμενο**, όχι για το σχήμα.
   *  Ο άνθρωπος ξέρει τι ανέβασε· δεν ξέρει τι είναι το `object-fit`. */
  kindLegend: `${K}.mark.kindLegend`,
  kindLogo: `${K}.mark.kindLogo`,
  kindLogoHint: `${K}.mark.kindLogoHint`,
  kindPortrait: `${K}.mark.kindPortrait`,
  kindPortraitHint: `${K}.mark.kindPortraitHint`,
  // ── ΟΙ ΠΡΑΞΕΙΣ ────────────────────────────────────────────────────────────
  choose: `${K}.mark.choose`,
  replace: `${K}.mark.replace`,
  remove: `${K}.mark.remove`,
  // ── ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ ────────────────────────────────────────────────────────
  /** ⚠️ **Τρεις**, όχι μία: ο άνθρωπος βλέπει τρία διαφορετικά πράγματα να συμβαίνουν. */
  uploading: `${K}.mark.uploading`,
  publishing: `${K}.mark.publishing`,
  removing: `${K}.mark.removing`,
  /** 🔑 *«Δημοσίευσε πρώτα»* — **ρητά**, ποτέ σιωπηλά γκρι κουμπί. */
  needsShowcase: `${K}.mark.needsShowcase`,
  // ── Ο ΚΡΙΤΗΣ ΕΙΣΟΔΟΥ ──────────────────────────────────────────────────────
  /** ⛔ Κάτω από τη μικρότερη βαθμίδα του ραφιού — **άρνηση**, με **δύο** νούμερα. */
  tooSmall: `${K}.mark.tooSmall`,
  /**
   * ⚠️ **Δύο μηνύματα, όχι ένα**, και η διαφορά είναι μετρήσιμη: το πρώτο λέει *«καθαρό
   * εδώ, θολό εκεί»*, το δεύτερο *«θολό παντού»*. Ένα κοινό «χαμηλή ανάλυση» θα έκρυβε
   * ακριβώς την πληροφορία που κάνει τον άνθρωπο να αποφασίσει.
   */
  blurryPage: `${K}.mark.blurryPage`,
  blurryEverywhere: `${K}.mark.blurryEverywhere`,
  unreadable: `${K}.mark.unreadable`,
  uploadFailed: `${K}.mark.uploadFailed`,
  /** 🔑 *«Οι γωνίες δεν θα φαίνονται»* — **πριν** την περικοπή, όχι μετά. */
  cropNote: `${K}.mark.cropNote`,
} as const;

/**
 * **Κάθε λόγος άρνησης του γραφέα, με το κλειδί του.**
 *
 * 🔴 `Record<…>` πάνω στο **κλειστό σύνολο** — δες το σκεπτικό στην κορυφή.
 */
export const SHOWCASE_REJECTION_KEYS: Record<AgencyProfileRejection, string> = {
  'agency-profile-alias-missing': `${K}.rejection.agency-profile-alias-missing`,
  'agency-profile-name-missing': `${K}.rejection.agency-profile-name-missing`,
  'agency-profile-occupation-missing': `${K}.rejection.agency-profile-occupation-missing`,
  'agency-profile-registration-missing': `${K}.rejection.agency-profile-registration-missing`,
  'agency-profile-chapter-missing': `${K}.rejection.agency-profile-chapter-missing`,
  'agency-profile-mark-not-owned': `${K}.rejection.agency-profile-mark-not-owned`,
  'agency-profile-mark-unknown-kind': `${K}.rejection.agency-profile-mark-unknown-kind`,
  'agency-profile-mark-without-showcase': `${K}.rejection.agency-profile-mark-without-showcase`,
  'agency-profile-mark-unpublishable': `${K}.rejection.agency-profile-mark-unpublishable`,
};

/**
 * **Ετικέτα και υπόδειξη ανά είδος σήματος** — δύο `Record`, **ένα επίπεδο ο καθένας**.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 Η ΘΕΣΗ ΚΑΙ ΤΟ ΣΧΗΜΑ ΤΟΥΣ ΤΑ ΟΡΙΣΕ Ο ΓΕΝΝΗΤΟΡΑΣ — ΤΡΕΙΣ ΦΟΡΕΣ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ο τεμαχιστής του ADR-744 *(CHECK 3.34)* αρνήθηκε τη διαδρομή **τρεις** φορές, και κάθε
 * άρνηση δίδαξε έναν κανόνα της σκάλας επίλυσης:
 *
 * | # | τι δοκιμάστηκε | γιατί δεν λύθηκε |
 * |---|---|---|
 * | 1 | πίνακας **μέσα** στη συνάρτηση | τοπική μεταβλητή = τιμή **χρόνου εκτέλεσης** |
 * | 2 | πίνακας σε επίπεδο module, **ένθετος** *(`{label, hint}`)* | η σκάλα λύνει **μία** ευρετηρίαση· το `X[k].field` είναι **δύο** |
 * | 3 | δύο επίπεδοι πίνακες, με τιμές `SHOWCASE_MARK_KEYS.kindLogo` | οι τιμές ήταν **αναφορές** σε άλλη σταθερά — **δεύτερο** επίπεδο έμμεσης |
 *
 * ⇒ **Εδώ, με κυριολεκτικά πρότυπα** — ακριβώς όπως ο γείτονας
 * {@link SHOWCASE_REJECTION_KEYS}, που λύνεται από την πρώτη μέρα. Το `t()` γίνεται
 * `t(SHOWCASE_MARK_KIND_LABEL_KEYS[kind])`: μία ευρετηρίαση, σε σταθερά module, με
 * κυριολεκτική τιμή.
 *
 * ⚠️ **Η θεραπεία ΔΕΝ ήταν `dynamicKeyPolicy`.** Μια δηλωμένη εξαίρεση θα έλυνε τον
 * τεμαχιστή και θα **άφηνε τα κλειδιά αόρατα στη CHECK 3.8** — ακριβώς το λάθος που η
 * κεφαλίδα αυτού του αρχείου απορρίπτει ονομαστικά. Η μετακίνηση τα λύνει **και στα
 * δύο** εργαλεία, χωρίς καμία εξαίρεση πουθενά.
 *
 * 🔑 `Record<ShowcaseMarkKind, string>` πάνω στο κλειστό σύνολο, **και οι δύο**: τρίτο
 * είδος **δεν μεταγλωττίζεται** μέχρι να αποκτήσει ετικέτα **και** υπόδειξη.
 */
export const SHOWCASE_MARK_KIND_LABEL_KEYS: Record<ShowcaseMarkKind, string> = {
  logo: `${K}.mark.kindLogo`,
  portrait: `${K}.mark.kindPortrait`,
};

/**
 * Δες {@link SHOWCASE_MARK_KIND_LABEL_KEYS}.
 *
 * 🔑 **Η υπόδειξη είναι που κάνει την επιλογή** — *«εμφανίζεται σε κύκλο, οι γωνίες δεν
 * φαίνονται»*. Χωρίς αυτήν, τα δύο κουμπιά είναι δύο λέξεις χωρίς συνέπεια.
 */
export const SHOWCASE_MARK_KIND_HINT_KEYS: Record<ShowcaseMarkKind, string> = {
  logo: `${K}.mark.kindLogoHint`,
  portrait: `${K}.mark.kindPortraitHint`,
};
