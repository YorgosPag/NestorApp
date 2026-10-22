/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 Φ-Γ2 Σ3 — **το παγωμένο κείμενο του Πρωτοκόλλου λέει την αλήθεια για τον κώδικα.**
 *
 * Η ρήτρα `verification.item3` υπόσχεται στον τρίτο (δικηγόρο, συμβολαιογράφο, δικαστήριο) ότι ξαναϋπολογίζει το
 * αποτύπωμα του φακέλου **χωρίς εμάς**. Εδώ ο «τρίτος» είναι μια **ανεξάρτητη** υλοποίηση της συνταγής — `node:crypto`,
 * ταξινόμηση κατά bytes (`Buffer.compare`), ένωση με LF — που διαβάζει ετικέτα σχήματος και σειρά πεδίων **από το ίδιο
 * το παγωμένο κείμενο**. Αν ο κώδικας αλλάξει συνταγή χωρίς νέα έκδοση κειμένου (και νέα ετικέτα), κοκκινίζει.
 *
 * Και οι ρήτρες που η Σ4 θα τυπώσει υποχρεωτικά υπάρχουν στην **παγωμένη** έκδοση σε ισχύ — όχι στο `legal.json`.
 */

import { createHash } from 'crypto';

import {
  HANDOVER_DELIVERY_DIGEST_SCHEME,
  handoverDeliveryDigest,
  type HandoverDeliveredRow,
} from '@/lib/property-handover/handover-delivery-plan';
import { clauseIdsOf } from '@/lib/legal/legal-clauses';
import { legalDocumentInForce, latestLegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import type { FrozenLegalText } from '@/lib/legal/frozen-legal-document';

const DOCUMENT = 'handover-protocol';

/** Οι ρήτρες που το Πρωτόκολλο **δεν** εκδίδεται χωρίς αυτές (σχέδιο Σ3/Σ4 · ADR-916 §5.11). */
const REQUIRED_CLAUSES = ['digitalFilesOnly', 'notPropertyDelivery', 'noWaiver', 'contentNotCertified'] as const;

/** Η ονομασία κάθε πεδίου της γραμμής **όπως τη γράφει το κείμενο**, ανά γλώσσα → πεδίο του καθολικού. */
const FIELD_NAMES = {
  el: [['αναγνωριστικό πηγής', 'sourceFileId'], ['αναγνωριστικό αντιγράφου', 'copyFileId'], ['SHA-256', 'sha256'], ['μέγεθος σε bytes', 'size']],
  en: [['source identifier', 'sourceFileId'], ['copy identifier', 'copyFileId'], ['SHA-256', 'sha256'], ['size in bytes', 'size']],
} as const;

type HashedRow = HandoverDeliveredRow & { readonly sha256: string };
type RowField = 'sourceFileId' | 'copyFileId' | 'sha256' | 'size';

function frozenText(locale: 'el' | 'en'): FrozenLegalText {
  const lookup = latestLegalDocumentVersion(DOCUMENT);
  if (lookup.kind !== 'published') throw new Error('handover-protocol: καμία παγωμένη έκδοση');
  return lookup.version.frozen.locales[locale];
}

function verificationStep(locale: 'el' | 'en', index: number): string {
  const section = frozenText(locale).sections.find((s) => s.id === 'verification');
  const list = section?.blocks.find((b) => b.kind === 'list');
  if (list === undefined || list.kind !== 'list') throw new Error('verification: λείπει η λίστα βημάτων');
  return list.items[index].text;
}

/** Η σειρά πεδίων της γραμμής, **διαβασμένη από το κείμενο** (`«α|β|γ|δ»` / `"a|b|c|d"`). */
function fieldOrderFromText(locale: 'el' | 'en'): readonly RowField[] {
  const step = verificationStep(locale, 2);
  const quoted = /[«"]([^»"]*\|[^»"]*)[»"]/.exec(step);
  if (quoted === null) throw new Error(`${locale}: η συνταγή γραμμής λείπει από το βήμα 3`);
  return quoted[1].split('|').map((name) => {
    const field = FIELD_NAMES[locale].find(([label]) => label === name);
    if (field === undefined) throw new Error(`${locale}: άγνωστο πεδίο «${name}»`);
    return field[1];
  });
}

/** Η ετικέτα σχήματος, **διαβασμένη από το κείμενο** — η μόνη συμβολοσειρά `nestor.*` μέσα σε εισαγωγικά. */
function schemeFromText(locale: 'el' | 'en'): string {
  const match = /[«"](nestor\.[^»"]+)[»"]/.exec(verificationStep(locale, 2));
  if (match === null) throw new Error(`${locale}: η ετικέτα σχήματος λείπει από το βήμα 3`);
  return match[1];
}

/** **Ο τρίτος**: η συνταγή του κειμένου, χωρίς καμία εισαγωγή από τον κώδικα που κρίνεται. */
function thirdPartyDigest(rows: readonly HashedRow[], scheme: string, order: readonly RowField[]): string {
  const lines = rows
    .map((row) => order.map((field) => String(row[field])).join('|'))
    .map((line) => Buffer.from(line, 'utf8'))
    .sort(Buffer.compare)
    .map((bytes) => bytes.toString('utf8'));
  return createHash('sha256').update([scheme, ...lines].join('\n'), 'utf8').digest('hex');
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const row = (sourceFileId: string, copyFileId: string, size: number): HashedRow =>
  ({ sourceFileId, copyFileId, crc32c: 'unused', size, sha256: sha(`${sourceFileId}:${size}`) });

/**
 * Γραμμές που **διακρίνουν**: η σειρά εισαγωγής ≠ ταξινομημένη (ταξινόμηση που λείπει κοκκινίζει) · η ταξινόμηση κατά
 * πηγή ≠ κατά αντίγραφο (αντιμετάθεση πεδίων κοκκινίζει) · μεγέθη με διαφορετικό πλήθος ψηφίων (μορφή αριθμού).
 */
const ROWS: readonly HashedRow[] = [
  row('file_zeta', 'file_alpha_copy', 7),
  row('file_beta', 'file_omega_copy', 1048576),
  row('file_alpha', 'file_mu_copy', 42),
];

describe('ADR-916 Σ3 — η ρήτρα «τρόπος επαλήθευσης» = ο κώδικας', () => {
  it.each(['el', 'en'] as const)('%s: η ετικέτα σχήματος του κειμένου είναι η ετικέτα του κώδικα', (locale) => {
    expect(schemeFromText(locale)).toBe(HANDOVER_DELIVERY_DIGEST_SCHEME);
  });

  it.each(['el', 'en'] as const)('%s: ο τρίτος, ακολουθώντας ΜΟΝΟ το κείμενο, βγάζει το αποτύπωμα του κώδικα', async (locale) => {
    const expected = thirdPartyDigest(ROWS, schemeFromText(locale), fieldOrderFromText(locale));
    await expect(handoverDeliveryDigest(ROWS)).resolves.toBe(expected);
  });

  it('η σειρά εγγραφής δεν αλλάζει το αποτύπωμα (το κείμενο λέει «ταξινομήστε»)', async () => {
    await expect(handoverDeliveryDigest([...ROWS].reverse())).resolves.toBe(await handoverDeliveryDigest(ROWS));
  });

  it('μάρτυρας διάκρισης: οι γραμμές ΔΕΝ είναι ήδη ταξινομημένες ούτε ίδιες κατά πηγή και κατά αντίγραφο', () => {
    const bySource = [...ROWS].sort((a, b) => a.sourceFileId.localeCompare(b.sourceFileId)).map((r) => r.sourceFileId);
    const byCopy = [...ROWS].sort((a, b) => a.copyFileId.localeCompare(b.copyFileId)).map((r) => r.sourceFileId);
    expect(ROWS.map((r) => r.sourceFileId)).not.toEqual(bySource);
    expect(bySource).not.toEqual(byCopy);
  });
});

describe('ADR-916 Σ3 — οι ρήτρες του Πρωτοκόλλου ζουν στην ΠΑΓΩΜΕΝΗ έκδοση', () => {
  it('υπάρχει έκδοση σε ισχύ από την ημέρα του πρώτου παγώματος', () => {
    expect(legalDocumentInForce(DOCUMENT, '2026-10-22').kind).toBe('in-force');
  });

  it.each(REQUIRED_CLAUSES)('η ρήτρα «%s» υπάρχει στην τελευταία έκδοση', (id) => {
    const lookup = latestLegalDocumentVersion(DOCUMENT);
    if (lookup.kind !== 'published') throw new Error('καμία έκδοση');
    expect(clauseIdsOf(lookup.version.frozen)).toContain(id);
  });

  it('τα ids των ρητρών είναι ΚΟΙΝΑ στις δύο γλώσσες, με μη κενό κείμενο', () => {
    const idsOf = (locale: 'el' | 'en') =>
      frozenText(locale).sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'clause' && b.text.trim() !== '' ? [b.id] : [])));
    expect(idsOf('en')).toEqual(idsOf('el'));
  });
});
