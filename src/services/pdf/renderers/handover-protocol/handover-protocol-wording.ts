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
