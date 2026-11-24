/**
 * @fileoverview **Η επαφή του χώρου** — ποια επαφή-εταιρεία ΕΙΝΑΙ ο ίδιος ο χώρος (ADR-951).
 * @module types/company-self-contact
 *
 * 🔑 **Μοντέλο Odoo** (`res.company.partner_id`, επαληθευμένο στον κώδικα 17.0): ο δεσμός ζει **στον χώρο**
 *    (`companies/{companyId}.selfContact`), μία τιμή ανά χώρο ⇒ δύο επαφές δεν μπορούν να «δηλώσουν» τον ίδιο χώρο.
 *    Τον γράφει **ένας** γραφέας του server (`self-contact-store.server.ts`)· οι κανόνες κλείνουν τον πελάτη.
 * 🔑 **Μία πηγή εικόνας**: η επαφή του χώρου **δείχνει** το `companies/{id}.brandLogo` — όχι δεύτερο αντίγραφο,
 *    όχι συγχρονισμός (ADR-ACC-018 §17).
 * 🔑 Το σχήμα είναι γενικό σε «οντότητα ↔ επαφή» ώστε οι νομικές οντότητες του ADR-232 να το πάρουν χωρίς ξαναγράψιμο.
 */

/** Ο δεσμός όπως ζει στο `companies/{companyId}.selfContact`. */
export interface WorkspaceSelfContact {
  readonly contactId: string;
  /** ISO 8601 — πότε δηλώθηκε. */
  readonly linkedAt: string;
  /** Το id του φορέα που τον δήλωσε (ADR-195). */
  readonly linkedBy: string;
}

/**
 * Τι γίνεται με την εικόνα της επαφής τη στιγμή της σύνδεσης — **μία** δήλωση, απ' όπου ο τύπος και ο έλεγχος εισόδου
 * του route (`z.enum`).
 * - `keep-workspace-logo`: το λογότυπο του χώρου μένει ως έχει· η εικόνα της επαφής δεν σβήνεται.
 * - `use-contact-image`: η εικόνα της επαφής γίνεται το λογότυπο του χώρου — μέσα από τον ΕΝΑ γραφέα (κανονικοποίηση,
 *   αμετάβλητο asset).
 */
export const SELF_CONTACT_LOGO_CHOICES = ['keep-workspace-logo', 'use-contact-image'] as const;

export type SelfContactLogoChoice = (typeof SELF_CONTACT_LOGO_CHOICES)[number];

/** Μια επαφή όπως τη βλέπει η κάρτα σύνδεσης — ελαχιστοποιημένη. */
export interface SelfContactCandidate {
  readonly contactId: string;
  readonly displayName: string;
  /** Έχει δική της εικόνα (`logoURL`) ⇒ η σύνδεση ρωτά τι θα κρατηθεί. */
  readonly hasOwnImage: boolean;
}

/**
 * Η πρόταση του server, από το ΑΦΜ του προφίλ (ADR-439) — **ποτέ** αυτόματη σύνδεση.
 * - `suggested`: μία επαφή-εταιρεία του χώρου με το ίδιο ΑΦΜ.
 * - `ambiguous`: περισσότερες — διαλέγει ο άνθρωπος.
 * - `none`: καμία — προσφέρεται «Δημιουργία από τα στοιχεία του χώρου».
 * - `no-tax-id`: το προφίλ δεν έχει έγκυρο ΑΦΜ — καμία πρόταση.
 */
export type SelfContactSuggestion =
  | { readonly kind: 'suggested'; readonly candidate: SelfContactCandidate }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly SelfContactCandidate[] }
  | { readonly kind: 'none' }
  | { readonly kind: 'no-tax-id' };

/** Η κατάσταση του χώρου, όπως τη διαβάζει ο server — ίδια για κάθε μέλος. */
export interface SelfContactView {
  /** Η συνδεδεμένη επαφή, ή `null`. */
  readonly linked: SelfContactCandidate | null;
  /** Μόνο όταν δεν υπάρχει σύνδεση. */
  readonly suggestion: SelfContactSuggestion | null;
}

/**
 * Η απάντηση του `GET /api/companies/self-contact` (και των πράξεων): η όψη **και** τι επιτρέπεται στον αιτούντα.
 * Το `canEdit` το κρίνει ο server με το ΙΔΙΟ ταβάνι ρόλων που φυλά τις εγγραφές — ο browser δεν κρίνει ρόλους, ώστε να
 * μη δείχνει κουμπί που ο server θα αρνηθεί (μοτίβο `settings/ai-processing`).
 */
export interface SelfContactResponse extends SelfContactView {
  readonly canEdit: boolean;
}

/** Οι κατονομασμένες αρνήσεις — ο browser τις μεταφράζει, ποτέ ελεύθερο κείμενο. */
export type SelfContactRefusal =
  /** Η επαφή δεν υπάρχει ή ανήκει σε άλλο χώρο. */
  | 'contact-not-found'
  /** Δεν είναι νομικό πρόσωπο. */
  | 'not-a-company'
  /** Αρχειοθετημένη ή διαγραμμένη. */
  | 'contact-inactive'
  /** Ο χώρος είναι ήδη συνδεδεμένος με ΑΛΛΗ επαφή — πρώτα αποσύνδεση. */
  | 'already-linked'
  /** Ζητήθηκε η εικόνα της επαφής, αλλά δεν έχει, ή δεν διαβάστηκε, ή δεν είναι του χώρου. */
  | 'contact-image-unavailable'
  /** Η εικόνα δεν πέρασε την κανονικοποίηση λογοτύπου (μορφή · μέγεθος · αποκωδικοποίηση). */
  | 'contact-image-refused'
  /** Το προφίλ δεν έχει επωνυμία — δεν γεννιέται επαφή χωρίς όνομα. */
  | 'profile-nameless';
