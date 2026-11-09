/**
 * @fileoverview **Το κοινό συμβόλαιο διαβίβασης** — ένα τιμολόγιο σε σχήμα `InvoicesDoc` της ΑΑΔΕ.
 * @module subapps/accounting/services/mydata/mydata-payload.types
 *
 * Καθρεφτίζει το υποσύνολο του XSD **v2.0.2** (`AadeBookInvoiceType`) που χρησιμοποιεί η εφαρμογή,
 * **με τα ίδια ονόματα στοιχείων** — ώστε η μελλοντική σειριοποίηση XML να είναι μηχανική
 * αντιστοίχιση, όχι μετάφραση.
 *
 * 🔑 **Γιατί ένα συμβόλαιο για ΔΥΟ κανάλια** (ADR-ACC-022 Α1/Α2): το ίδιο παραστατικό φεύγει είτε
 * απευθείας στο myDATA είτε μέσω παρόχου ηλεκτρονικής τιμολόγησης· το περιεχόμενο που δηλώνεται
 * στην ΑΑΔΕ είναι το ίδιο. Ο πάροχος αλλάζει τη **μεταφορά**, όχι τη **δήλωση**.
 *
 * Ποσά: αριθμοί στρογγυλεμένοι σε 2 δεκαδικά (XSD `AmountType`, `fractionDigits = 2`).
 * ΜΑΡΚ: συμβολοσειρά (XSD `xs:long` — έως 19 ψηφία, πέρα από την ακρίβεια του `number`).
 */

import type { MyDataIncomeType } from '../../types/common';
import type { MyDataInvoiceTypeCode } from './mydata-codes';

/** XSD `AddressType`: ΤΚ και πόλη υποχρεωτικά. */
export interface MyDataAddress {
  street: string | null;
  number: string | null;
  postalCode: string;
  city: string;
}

/**
 * XSD `PartyType`. Για οντότητα **GR**: ο εκδότης στέλνει **μόνο** ΑΦΜ/χώρα/εγκατάσταση, ο λήπτης
 * **χωρίς** επωνυμία (§5.1, παρατήρηση 3) — το `name`/`address` εδώ είναι `null` σε αυτές τις περιπτώσεις.
 */
export interface MyDataParty {
  vatNumber: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  /** Εγκατάσταση στο Μητρώο Taxis· `0` = έδρα ή δεν υφίσταται (§5.1, παρατήρηση 2). */
  branch: number;
  name: string | null;
  address: MyDataAddress | null;
}

/** XSD `InvoiceHeaderType` (υποσύνολο). */
export interface MyDataInvoiceHeader {
  series: string;
  aa: string;
  /** YYYY-MM-DD */
  issueDate: string;
  invoiceType: MyDataInvoiceTypeCode;
  currency: 'EUR';
  /** ΜΑΡΚ συσχετιζόμενων παραστατικών — υποχρεωτικό για το 5.1. */
  correlatedInvoices: readonly string[];
}

/**
 * XSD `IncomeClassificationType`. Το `classificationType` (κωδικός Ε3, π.χ. `E3_561_001`) μένει
 * `null` μέχρι να αποφασιστεί η χαρτογράφηση από τον πίνακα συνδυασμών της ΑΑΔΕ (ADR-ACC-003 §20).
 */
export interface MyDataIncomeClassification {
  classificationType: string | null;
  classificationCategory: MyDataIncomeType;
  amount: number;
}

/** XSD `InvoiceRowType` (υποσύνολο). */
export interface MyDataInvoiceRow {
  lineNumber: number;
  netValue: number;
  vatCategory: number;
  vatAmount: number;
  /** Υποχρεωτικό όταν `vatCategory` = 7 (0%). */
  vatExemptionCategory: number | null;
  withheldAmount: number | null;
  withheldPercentCategory: number | null;
  incomeClassification: readonly MyDataIncomeClassification[];
}

/** XSD `PaymentMethodDetailType` (υποσύνολο). Το άθροισμα των `amount` = `totalGrossValue`. */
export interface MyDataPaymentDetail {
  type: number;
  amount: number;
  paymentMethodInfo: string | null;
}

/** XSD `InvoiceSummaryType`. */
export interface MyDataInvoiceSummary {
  totalNetValue: number;
  totalVatAmount: number;
  totalWithheldAmount: number;
  totalFeesAmount: number;
  totalStampDutyAmount: number;
  totalOtherTaxesAmount: number;
  totalDeductionsAmount: number;
  totalGrossValue: number;
  incomeClassification: readonly MyDataIncomeClassification[];
}

/** Ένα παραστατικό έτοιμο για διαβίβαση — ό,τι θα γίνει `<invoice>` μέσα στο `<InvoicesDoc>`. */
export interface MyDataInvoicePayload {
  /** Η έκδοση προδιαγραφών ΑΑΔΕ βάσει της οποίας χτίστηκε. */
  specVersion: string;
  issuer: MyDataParty;
  counterpart: MyDataParty | null;
  invoiceHeader: MyDataInvoiceHeader;
  paymentMethods: readonly MyDataPaymentDetail[];
  invoiceDetails: readonly MyDataInvoiceRow[];
  invoiceSummary: MyDataInvoiceSummary;
}
