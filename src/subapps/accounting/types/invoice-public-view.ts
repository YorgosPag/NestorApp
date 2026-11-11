/**
 * @fileoverview Η **δημόσια** όψη ενός τιμολογίου: ό,τι βλέπει ο κάτοχος του συνδέσμου πληρωμής (ADR-ACC-018 §16)
 * @description Το συμβόλαιο ανάμεσα στο `GET /api/shares/[shareId]/invoice-payment` και στη σελίδα `/shared/[token]`.
 *   Κάθε πεδίο εδώ μπαίνει **ρητά**: η προβολή (`invoice-public-view.ts`) χτίζει νέο αντικείμενο και δεν αντιγράφει
 *   το έγγραφο, οπότε ένα πεδίο που προστίθεται στο `Invoice` δεν διαρρέει από μόνο του.
 *
 *   **Δεν** περιέχει ποτέ: `companyId` · `createdBy` · ids επαφών · email πελάτη · `emailHistory` · αιτιολογία
 *   ακύρωσης · εσωτερικά myDATA (uid, authCode, μηνύματα σφάλματος) · πληρωμές ανά γραμμή.
 *   Τα **σχόλια** (`notes`) περιέχονται, γιατί τυπώνονται ήδη στο PDF που λαμβάνει ο πελάτης.
 */

import type { ChatChannelRef } from '@/lib/contact/social-chat-links';

import type { InvoiceType } from './invoice';
import type { MyDataDocumentStatus } from './common';
import type { InvoicePaymentStanding } from '../services/payments/invoice-payment-link';

export interface InvoicePublicParty {
  readonly name: string;
  readonly vatNumber: string | null;
  readonly taxOffice: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly postalCode: string | null;
}

/** Τα στοιχεία επικοινωνίας του εκδότη. Είναι τα ίδια με εκείνα της κεφαλίδας του PDF. */
export interface InvoicePublicIssuer extends InvoicePublicParty {
  readonly profession: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly website: string | null;
}

export interface InvoicePublicLine {
  readonly lineNumber: number;
  readonly description: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitPrice: number;
  readonly vatRate: number;
  readonly netAmount: number;
}

export interface InvoicePublicVatRow {
  readonly vatRate: number;
  readonly netAmount: number;
  readonly vatAmount: number;
}

/** Ένας λογαριασμός πληρωμής, έτοιμος για αντιγραφή και σάρωση. */
export interface InvoicePublicPaymentAccount {
  readonly bankName: string;
  /** Χωρίς κενά: αυτό αντιγράφεται. Η ομαδοποίηση ανά 4 γίνεται κατά την εμφάνιση. */
  readonly iban: string;
  readonly bic: string | null;
  readonly beneficiary: string;
  /** EPC069-12 (SEPA Credit Transfer QR) με το **υπόλοιπο** ποσό. `null` όταν δεν παράγεται (π.χ. όχι EUR). */
  readonly epcQrPayload: string | null;
}

export interface InvoicePublicPayment {
  /** Το ISO 11649 RF, αλλιώς `null`. Η αιτιολογία που γράφει ο πελάτης είναι το `remittance`. */
  readonly creditorReference: string | null;
  /** Αυτό που μπαίνει στην αιτιολογία της μεταφοράς (RF ή «σειρά-αριθμός»). */
  readonly remittance: string;
  readonly accounts: readonly InvoicePublicPaymentAccount[];
}

export interface InvoicePublicView {
  readonly invoiceId: string;
  readonly series: string;
  readonly number: number;
  readonly type: InvoiceType;
  /** Πρόχειρο, εκδομένο ή ακυρωμένο. Η σελίδα δείχνει ρητή ταινία «Προσχέδιο» όταν δεν έχει εκδοθεί. */
  readonly documentStatus: MyDataDocumentStatus;
  /** Ο ΜΑΡΚ της ΑΑΔΕ, όταν υπάρχει. Τυπώνεται ήδη στο PDF. */
  readonly mark: string | null;
  readonly issueDate: string;
  readonly dueDate: string | null;
  readonly currency: string;
  readonly issuer: InvoicePublicIssuer;
  /**
   * Τα κανάλια συνομιλίας του εκδότη (Viber, WhatsApp, Messenger, Telegram, Instagram). Είναι τα **τρέχοντα** της
   * εταιρείας, όχι στιγμιότυπο της έκδοσης: ένα παλιό τιμολόγιο δεν δείχνει ποτέ κανάλι που δεν υπάρχει πια.
   * Μόνο δημόσιοι λογαριασμοί της εταιρείας, ήδη επικυρωμένοι (`chatChannelsOf`).
   */
  readonly issuerChatChannels: readonly ChatChannelRef[];
  readonly customer: InvoicePublicParty;
  readonly lines: readonly InvoicePublicLine[];
  readonly vatBreakdown: readonly InvoicePublicVatRow[];
  readonly totalNetAmount: number;
  readonly totalVatAmount: number;
  readonly totalGrossAmount: number;
  /** Το πληρωτέο του παραστατικού (σύνολα του PDF). */
  readonly payableAmount: number;
  /** Το υπόλοιπο που οφείλεται τώρα: 0 όταν δεν είναι `payable`. */
  readonly amountDue: number;
  readonly standing: InvoicePaymentStanding;
  /** Οφείλεται και πέρασε η λήξη πληρωμής. Το κρίνει ο διακομιστής, όχι το ρολόι του επισκέπτη. */
  readonly overdue: boolean;
  /** `null` όταν η κατάσταση δεν είναι `payable`: δεν δείχνουμε ποτέ οδηγίες για ποσό που δεν οφείλεται. */
  readonly payment: InvoicePublicPayment | null;
  readonly notes: string | null;
}

/** Γιατί η σελίδα δεν δείχνει τιμολόγιο. Ονομασμένο, όπως οι αρνήσεις της κοινοποίησης. */
export type InvoicePublicRefusal =
  /** Ο σύνδεσμος δεν είναι πια ενεργός ή δεν δείχνει αυτό το τιμολόγιο. Η σελίδα ξαναζητά επίλυση. */
  | 'link-inactive'
  /** Το cookie επίσκεψης λείπει ή έληξε (15′). Η σελίδα ξαναζητά επίλυση με το token. */
  | 'visit-expired'
  /** Το τιμολόγιο δεν υπάρχει πια ή δεν ανήκει στον μισθωτή του συνδέσμου. */
  | 'invoice-absent';

export type InvoicePublicViewResponse =
  | { readonly status: 'ok'; readonly view: InvoicePublicView }
  | { readonly status: 'refused'; readonly reason: InvoicePublicRefusal };
