/**
 * Η αναφορά εισαγωγής ETIM xChange (ADR-923 Φάση 7 · §23.2 K4γ). Χωριστό αρχείο τύπων: τη διαβάζει η παρτίδα, άρα δεν πρέπει να φέρνει τον προσαρμογέα.
 * Μία αναφορά ανά **σκοπό** της παρτίδας: ό,τι δεν μπήκε στην πρόταση μετριέται εδώ, ποτέ σιωπηλά.
 * @module subapps/catalog/interop/etim/xchange-report
 */

export interface XChangeAttributeImportReport {
  /** Απών στις αναφορές που αποθηκεύτηκαν πριν από την εισαγωγή τιμών: τότε υπήρχε μόνο αυτός ο σκοπός. */
  readonly purpose?: 'attributes';
  readonly products: number;
  readonly imported: number;
  /** Οι άλλες κλάσεις του αρχείου: τα προϊόντα τους ανήκουν σε άλλη οικογένεια. */
  readonly otherClasses: readonly string[];
  readonly otherClassProducts: number;
  /** Χαρακτηριστικά της κλάσης χωρίς ιδιότητα. Οι ιντσικοί δίδυμοι δεν μετρούν: λένε το ίδιο με τα μετρικά. */
  readonly unmappedFeatures: readonly string[];
  /** Εύρος τιμών: καμία ιδιότητα καταλόγου δεν το κρατά. */
  readonly rangeFeatures: readonly string[];
  /** Δηλωμένα `NA` / `UN`: μπήκαν στην πρόταση ως ρητή απουσία, για έλεγχο. */
  readonly declaredNoValue: number;
  /** Προϊόντα με πολλά εμπορεύσιμα είδη: κρατήθηκε το πρώτο. */
  readonly extraTradeItems: number;
  /**
   * Προϊόντα με **κι άλλα** GTIN πέρα από αυτό που κρατήθηκε (ADR-934 Σ1γ Δ2: πρώτα το `ItemGtin` του είδους, μετά το `ProductGtin`).
   * Απόν στις αναφορές πριν από το Σ1γ.
   */
  readonly extraGtins?: number;
  /** Προϊόντα χωρίς `BrandName`, όπου η μάρκα πάρθηκε από το `ManufacturerName`. Απόν πριν από το Σ1γ. */
  readonly brandFromManufacturer?: number;
}

export interface XChangePriceImportReport {
  readonly purpose: 'priceLines';
  readonly products: number;
  /** Προϊόντα που έδωσαν γραμμή τιμής στην πρόταση. */
  readonly imported: number;
  /** `PriceOnRequest`: ο προμηθευτής δεν δίνει τιμή, άρα καμία γραμμή. */
  readonly onRequest: number;
  /** Λείπει το ποσό που λέει ο τύπος της λίστας (`GrossListPrice` για λίστα, `NetPrice` για τιμή πελάτη). Το άλλο ποσό δεν το παίρνει ποτέ. */
  readonly amountMissing: number;
  /** Η εγγραφή τιμής δεν δηλώνει `PriceUnit` ή `PriceQuantity` (υποχρεωτικά στο πρότυπο): ποσό χωρίς μονάδα δεν είναι τιμή. */
  readonly entryIncomplete: number;
  /** Κωδικοί SKU χωρίς εγγραφή τιμής που να καλύπτει την έναρξη ισχύος της έκδοσης. */
  readonly validityUncovered: readonly string[];
  /** Κωδικοί SKU με πολλές εγγραφές τιμής, ενώ η έκδοση δεν έχει έναρξη ισχύος: η επιλογή θα ήταν μαντεψιά. */
  readonly validityAmbiguous: readonly string[];
  /** Το αρχείο δεν δηλώνει νόμισμα: λογίστηκε το νόμισμα της πλατφόρμας. */
  readonly currencyAssumed: boolean;
  /** Προϊόντα με κλιμάκια ή επιβαρύνσεις (`AllowanceSurcharge`): η γραμμή τιμής δεν τα κρατά. */
  readonly allowanceSurcharges: number;
  /** Προϊόντα με πολλά εμπορεύσιμα είδη: κρατήθηκε το πρώτο. */
  readonly extraTradeItems: number;
}

export type XChangeImportReport = XChangeAttributeImportReport | XChangePriceImportReport;
