/**
 * @fileoverview **Η ταυτότητα εμφάνισης του χώρου** — το λογότυπο της εταιρείας ως **αμετάβλητο** asset (ADR-ACC-018 §17).
 * @module types/company-brand
 *
 * 🔑 **ΜΙΑ πηγή** (ADR-928 §5.11): το έγγραφο του χώρου `companies/{companyId}`, πεδίο `brandLogo`. Το λογιστικό
 *    `CompanyProfile` **δεν** έχει λογότυπο. Το παλιό `logoURL` γράφεται ως **παράγωγο** του `brandLogo` (για τους
 *    αναγνώστες βιτρινών, ADR-312) — ποτέ δεύτερη αλήθεια.
 * 🔑 **Αμετάβλητο**: κάθε ανέβασμα είναι **νέο** αντικείμενο (νέο `fileId`)· το παλιό δεν σβήνεται ποτέ, γιατί το
 *    δείχνουν παγωμένα στιγμιότυπα εκδομένων παραστατικών. Η αναφορά κρατά και τη **γενιά** GCS και το **sha256**:
 *    η επανεκτύπωση διαβάζει ακριβώς αυτά τα bytes ή τίποτα.
 */

/** Οι μορφές που αποθηκεύονται — αυτές που ενσωματώνουν αυτούσιες jsPDF **και** Typst. */
export type BrandLogoContentType = 'image/png' | 'image/jpeg';

/**
 * **Η αναφορά** σε συγκεκριμένα bytes του λογοτύπου — ό,τι χρειάζεται ένα PDF για να το ζωγραφίσει, και ό,τι παγώνει
 * μέσα σε ένα εκδομένο παραστατικό (`InvoiceIssuer.logo`).
 */
export interface BrandLogoRef {
  readonly storagePath: string;
  /** Η γενιά GCS των bytes — η ανάγνωση καρφώνεται σε αυτήν. */
  readonly generation: string;
  /** sha256 (hex) των αποθηκευμένων bytes — η απόδειξη ότι διαβάστηκαν τα ίδια. */
  readonly sha256: string;
  readonly contentType: BrandLogoContentType;
  /** Διαστάσεις σε pixel, μετά τον προσανατολισμό — για σωστή αναλογία στη σελίδα. */
  readonly width: number;
  readonly height: number;
}

/** Το λογότυπο όπως ζει στο `companies/{companyId}.brandLogo`. */
export interface CompanyBrandLogo extends BrandLogoRef {
  readonly fileId: string;
  readonly sizeBytes: number;
  /** ISO 8601 — πότε ορίστηκε ως τρέχον. */
  readonly updatedAt: string;
}

/** Η απάντηση του `GET/PUT /api/companies/brand-logo`. */
export interface CompanyBrandLogoResponse {
  readonly brandLogo: CompanyBrandLogo | null;
}
