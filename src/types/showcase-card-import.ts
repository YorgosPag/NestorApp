/**
 * @fileoverview **ΤΙ ΞΕΡΕΙ ΗΔΗ ΤΟ ΣΥΣΤΗΜΑ ΓΙΑ ΤΟ ΠΟΥ ΣΕ ΒΡΙΣΚΟΥΝ** — η πηγή της «Εισαγωγής από τα στοιχεία της
 *   εταιρείας» (ADR-841 §7 Α21.19).
 * @related services/mandate/showcase-card-import-source.ts (ο συνθέτης) · lib/agency/showcase-card-import.ts (η σύγκριση)
 * @module types/showcase-card-import
 *
 * 🔑 **Πρόταση, όχι δήλωση.** Τίποτε από εδώ δεν αποθηκεύεται: γεμίζει το **πρόχειρο**, και η κάρτα κρίνεται
 * ολόκληρη στο «Αποθήκευση» από τον ίδιο κριτή (`formCard`). Γι' αυτό οι τιμές ταξιδεύουν **όπως δηλώθηκαν** — η
 * κανονικοποίηση γίνεται στη σύγκριση, με τους κριτές του έργου.
 *
 * ⛔ **Κανένα όνομα** (Α22): η ταυτότητα του γραφείου έχει ήδη μία σειρά προτεραιότητας· η εισαγωγή δεν γεννά τρίτη.
 */

/**
 * **Από πού ήρθε μια τιμή** — φαίνεται στον άνθρωπο δίπλα στο πεδίο.
 *
 * `business-registry` = η απάντηση του ΓΕΜΗ (Α23, `company_registry_records`)· `company-profile` = η δήλωση του
 * οργανισμού (`accounting_settings`, ADR-439). Η πρώτη **προηγείται στη διεύθυνση** — επαληθευμένη πηγή πριν από
 * αυτο-δήλωση, όπως στο Stripe.
 */
export type ImportOrigin = 'company-profile' | 'business-registry';

/** Τα πεδία που αγγίζει η εισαγωγή — **κλειστό σύνολο**. Ο τόπος (`place`) και η ονομασία (`label`) ΔΕΝ είναι εδώ. */
export type ImportField = 'street' | 'phones' | 'emails' | 'website';

export const IMPORT_FIELDS: readonly ImportField[] = ['street', 'phones', 'emails', 'website'];

/** Η διεύθυνση της έδρας, **δομημένη** — ή ελεύθερο κείμενο που δεν είχε άγκυρα αριθμού. */
export interface ImportedAddress {
  readonly street: string;
  /** `''` όταν η γραμμή δεν είχε αριθμό — ίδια σύμβαση με το `ShowcaseStreetLine`. */
  readonly number: string;
  /** Κανονική μορφή (5 ψηφία) ή `''`. */
  readonly postalCode: string;
  /** Πόλη/δήμος — **μόνο** για το ερώτημα εντοπισμού στον χάρτη· η κάρτα δεν έχει τέτοιο πεδίο. */
  readonly locality: string;
  readonly origin: ImportOrigin;
  /** Πότε ρωτήθηκε το μητρώο (ISO) — `null` για τη δήλωση του προφίλ. */
  readonly checkedAt: string | null;
}

export interface CompanyContactSource {
  readonly address: ImportedAddress | null;
  /** Με τη σειρά του προφίλ (σταθερό, κινητό), χωρίς κενά. */
  readonly phones: readonly string[];
  readonly email: string | null;
  readonly website: string | null;
}

/** Τι απαντά η πόρτα `GET /api/agency-profile/card/import-source`. */
export type CompanyContactSourceResponse =
  | { readonly source: CompanyContactSource }
  /** Ο οργανισμός δεν έχει δηλώσει ακόμη κανένα στοιχείο επικοινωνίας. */
  | { readonly error: 'NO_COMPANY_DATA' }
  /** 🔴 Δεν μάθαμε — ποτέ «δεν έχεις στοιχεία». */
  | { readonly error: 'READ_FAILED' };
