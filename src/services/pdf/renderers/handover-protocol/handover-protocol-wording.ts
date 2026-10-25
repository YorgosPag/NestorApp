/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — οι ετικέτες του PDF, ανά γλώσσα (ADR-916 Φ-Γ2 Σ4).
 * @module services/pdf/renderers/handover-protocol/handover-protocol-wording
 * @related server/comms/email-texts.ts (το πρότυπο: καθαρά δεδομένα, η γλώσσα είναι **παράμετρος**)
 *
 * @note Οι ελληνικές/αγγλικές συμβολοσειρές εδώ **ΔΕΝ** είναι παράβαση του N.11: το PDF παράγεται από **cron** και
 *       ροές μετά το commit, χωρίς ενεργό i18next. Ένα καθολικό `changeLanguage` ανάμεσα σε δύο παραδόσεις του ίδιου
 *       περάσματος θα ήταν συνθήκη αγώνα «λάθος γλώσσα σε λάθος έγγραφο» (ADR-777 §8.29). Πίνακας με παράμετρο = καμία
 *       κατάσταση.
 *
 * ⚠️ **ΕΔΩ ΜΟΝΟ ΕΤΙΚΕΤΕΣ.** Το κείμενο των **ρητρών** δεν γράφεται ποτέ εδώ: έρχεται αυτολεξεί από την **παγωμένη**
 *    έκδοση σε ισχύ (ADR-861), ώστε το PDF να μη λέει ποτέ κάτι άλλο από τη δημόσια σελίδα της έκδοσής του.
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { HandoverLineClosureCause } from '@/types/property-handover-line-closure';

export interface HandoverProtocolWording {
  readonly protocolNumber: string;
  readonly revision: (revision: number) => string;
  readonly supersedes: (revision: number, protocolId: string) => string;
  readonly firstRevision: string;
  readonly issuedAt: string;
  readonly issuer: string;
  readonly property: string;
  readonly appurtenances: string;
  readonly recipient: string;
  readonly unnamed: string;
  readonly eventsHeading: string;
  readonly events: {
    readonly saleCompleted: string;
    readonly invitationAccepted: string;
    readonly deliveryStarted: string;
    readonly deliveryCompleted: string;
    readonly protocolIssued: string;
  };
  readonly filesHeading: string;
  readonly columns: {
    readonly index: string;
    readonly file: string;
    readonly source: string;
    readonly copy: string;
    readonly sha256: string;
    readonly size: string;
  };
  readonly totals: (files: number, bytes: string) => string;
  /** Φ-Δ.7γ (ADR-916 §5.23) — ο πίνακας των αρχείων χωρίς πλήρες αποτύπωμα (η ρήτρα `closedLines` λέει τι σημαίνει). */
  readonly closedHeading: string;
  readonly closedColumns: {
    readonly index: string;
    readonly file: string;
    readonly source: string;
    readonly copy: string;
    readonly crc32c: string;
    readonly size: string;
    readonly cause: string;
  };
  /** `Record` ⇒ νέα αιτία δεν μεταγλωττίζεται χωρίς ετικέτα· ο κωδικός τυπώνεται δίπλα (μπαίνει στο αποτύπωμα v3). */
  readonly closedCauses: Readonly<Record<HandoverLineClosureCause, string>>;
  readonly closedNote: string;
  readonly digestHeading: string;
  readonly digestScheme: string;
  readonly digestValue: string;
  readonly manifestNote: string;
  readonly legalHeading: (version: number) => string;
  readonly legalDigest: string;
  readonly legalLink: string;
  /** ADR-916 Φ-Γ2 Σ6 — ο σύνδεσμος/QR της δημόσιας πόρτας επαλήθευσης. */
  readonly verifyLink: string;
  readonly operator: {
    readonly vatNumber: string;
    readonly gemiNumber: string;
  };
  readonly page: (page: number, total: number) => string;
  readonly sealReason: (revision: number) => string;
  readonly sealLocation: string;
}

/** ⚠️ `Record<HumanLanguage, …>`, ποτέ `Partial` — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της. */
export const HANDOVER_PROTOCOL_WORDING: Readonly<Record<HumanLanguage, HandoverProtocolWording>> = {
  el: {
    protocolNumber: 'Αριθμός πρωτοκόλλου',
    revision: (revision) => `Αναθεώρηση ${revision}`,
    supersedes: (revision, protocolId) => `Αντικαθιστά την αναθεώρηση ${revision} (${protocolId})`,
    firstRevision: 'Πρώτη έκδοση',
    issuedAt: 'Ημερομηνία έκδοσης',
    issuer: 'Εκδότης',
    property: 'Ακίνητο',
    appurtenances: 'Παρακολουθήματα',
    recipient: 'Παραλήπτης',
    unnamed: '—',
    eventsHeading: 'Ίχνος γεγονότων',
    events: {
      saleCompleted: 'Ολοκλήρωση πώλησης',
      invitationAccepted: 'Αποδοχή πρόσκλησης από τον παραλήπτη',
      deliveryStarted: 'Έναρξη παράδοσης αρχείων',
      deliveryCompleted: 'Ολοκλήρωση παράδοσης αρχείων',
      protocolIssued: 'Έκδοση πρωτοκόλλου',
    },
    filesHeading: 'Πίνακας παραδομένων αρχείων',
    columns: {
      index: '#',
      file: 'Αρχείο',
      source: 'Αναγνωριστικό πηγής',
      copy: 'Αναγνωριστικό αντιγράφου',
      sha256: 'SHA-256',
      size: 'Μέγεθος (bytes)',
    },
    totals: (files, bytes) => `Σύνολο: ${files} αρχεία · ${bytes} bytes`,
    closedHeading: 'Αρχεία χωρίς πλήρες αποτύπωμα',
    closedColumns: {
      index: '#',
      file: 'Αρχείο · παράδοση',
      source: 'Αναγνωριστικό πηγής',
      copy: 'Αναγνωριστικό αντιγράφου',
      crc32c: 'CRC32C',
      size: 'Μέγεθος (bytes)',
      cause: 'Αιτία',
    },
    closedCauses: {
      'bytes-gone': 'Τα δεδομένα διαγράφηκαν οριστικά και από τις δύο πλευρές',
      'source-unlocated': 'Η θέση της πηγής δεν είχε καταγραφεί',
    },
    closedNote: 'Χωρίς τιμή SHA-256 — βλ. τη ρήτρα για τα αρχεία χωρίς πλήρες αποτύπωμα στους όρους.',
    digestHeading: 'Αποτύπωμα φακέλου',
    digestScheme: 'Ετικέτα σχήματος',
    digestValue: 'SHA-256',
    manifestNote: 'Συνημμένο: manifest.json — ο ίδιος πίνακας σε μηχαναγνώσιμη μορφή, μέσα στο σφραγισμένο αρχείο.',
    legalHeading: (version) => `Όροι του πρωτοκόλλου — έκδοση ${version}`,
    legalDigest: 'Αποτύπωμα κειμένου',
    legalLink: 'Δημόσιο κείμενο της έκδοσης',
    verifyLink: 'Επαλήθευση αυτού του πρωτοκόλλου',
    operator: { vatNumber: 'ΑΦΜ', gemiNumber: 'ΓΕΜΗ' },
    page: (page, total) => `Σελίδα ${page}/${total}`,
    sealReason: (revision) => `Πρωτόκολλο παράδοσης ψηφιακών αρχείων — αναθεώρηση ${revision}`,
    sealLocation: 'Ελλάδα',
  },
  en: {
    protocolNumber: 'Protocol number',
    revision: (revision) => `Revision ${revision}`,
    supersedes: (revision, protocolId) => `Supersedes revision ${revision} (${protocolId})`,
    firstRevision: 'First issue',
    issuedAt: 'Date of issue',
    issuer: 'Issuer',
    property: 'Property',
    appurtenances: 'Appurtenances',
    recipient: 'Recipient',
    unnamed: '—',
    eventsHeading: 'Event trail',
    events: {
      saleCompleted: 'Sale completed',
      invitationAccepted: 'Invitation accepted by the recipient',
      deliveryStarted: 'File delivery started',
      deliveryCompleted: 'File delivery completed',
      protocolIssued: 'Protocol issued',
    },
    filesHeading: 'Table of delivered files',
    columns: {
      index: '#',
      file: 'File',
      source: 'Source identifier',
      copy: 'Copy identifier',
      sha256: 'SHA-256',
      size: 'Size (bytes)',
    },
    totals: (files, bytes) => `Total: ${files} files · ${bytes} bytes`,
    closedHeading: 'Files without a full fingerprint',
    closedColumns: {
      index: '#',
      file: 'File · handover',
      source: 'Source identifier',
      copy: 'Copy identifier',
      crc32c: 'CRC32C',
      size: 'Size (bytes)',
      cause: 'Cause',
    },
    closedCauses: {
      'bytes-gone': 'The data was permanently deleted on both sides',
      'source-unlocated': 'The source location was not recorded',
    },
    closedNote: 'No SHA-256 value — see the clause on files without a full fingerprint in the terms.',
    digestHeading: 'Dossier fingerprint',
    digestScheme: 'Scheme label',
    digestValue: 'SHA-256',
    manifestNote: 'Attachment: manifest.json — the same table in machine-readable form, inside the sealed file.',
    legalHeading: (version) => `Terms of the protocol — version ${version}`,
    legalDigest: 'Text fingerprint',
    legalLink: 'Public text of this version',
    verifyLink: 'Verify this protocol',
    operator: { vatNumber: 'VAT No.', gemiNumber: 'G.E.MI.' },
    page: (page, total) => `Page ${page}/${total}`,
    sealReason: (revision) => `Digital file handover protocol — revision ${revision}`,
    sealLocation: 'Greece',
  },
};
