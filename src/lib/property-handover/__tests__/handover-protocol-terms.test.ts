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
  HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES,
  handoverDeliveryDigest,
  type HandoverClosedDigestLineFields,
  type HandoverDeliveredRow,
} from '@/lib/property-handover/handover-delivery-plan';
import {
  HANDOVER_PROTOCOL_LEGAL_DOCUMENT,
  HANDOVER_PROTOCOL_REQUIRED_CLAUSES,
  handoverProtocolTermsOn,
  missingHandoverProtocolClauses,
} from '@/lib/property-handover/handover-protocol-terms';
import { clauseIdsOf } from '@/lib/legal/legal-clauses';
import { legalDocumentInForce, latestLegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import type { FrozenLegalText } from '@/lib/legal/frozen-legal-document';

const DOCUMENT = HANDOVER_PROTOCOL_LEGAL_DOCUMENT;

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

/** Φ-Δ.7γ — τα πεδία της γραμμής `C|…` **όπως τα ονομάζει το κείμενο v2** (το `C` είναι κυριολεκτικό πρόθεμα). */
const CLOSED_FIELD_NAMES = {
  el: [['C', null], ['αναγνωριστικό πηγής', 'sourceFileId'], ['αναγνωριστικό αντιγράφου', 'copyFileId'], ['CRC32C', 'crc32c'], ['μέγεθος σε bytes', 'size'], ['κωδικός αιτίας', 'cause']],
  en: [['C', null], ['source identifier', 'sourceFileId'], ['copy identifier', 'copyFileId'], ['CRC32C', 'crc32c'], ['size in bytes', 'size'], ['cause code', 'cause']],
} as const;

type ClosedField = keyof HandoverClosedDigestLineFields | null;

/** Όλες οι συνταγές γραμμής και όλες οι ετικέτες του βήματος 3, με τη σειρά που τις γράφει το κείμενο. */
const quotedAll = (step: string, pattern: RegExp): readonly string[] => [...step.matchAll(pattern)].map((m) => m[1]);

/** Η συνταγή της **κλεισμένης** γραμμής (η συνταγή που αρχίζει από `C|`), διαβασμένη από το κείμενο. */
function closedFieldOrderFromText(locale: 'el' | 'en'): readonly ClosedField[] {
  const recipe = quotedAll(verificationStep(locale, 2), /[«"]([^»"]*\|[^»"]*)[»"]/g).find((r) => r.startsWith('C|'));
  if (recipe === undefined) throw new Error(`${locale}: η συνταγή της κλεισμένης γραμμής λείπει από το βήμα 3`);
  return recipe.split('|').map((name) => {
    const field = CLOSED_FIELD_NAMES[locale].find(([label]) => label === name);
    if (field === undefined) throw new Error(`${locale}: άγνωστο πεδίο «${name}»`);
    return field[1];
  });
}

/** **Ο τρίτος, με κλεισμένες γραμμές**: δύο συνταγές, μία ταξινόμηση κατά bytes πάνω σε όλες, ετικέτα από το κείμενο. */
function thirdPartyDigestWithClosed(rows: readonly HashedRow[], closed: readonly HandoverClosedDigestLineFields[], scheme: string, locale: 'el' | 'en'): string {
  const order = fieldOrderFromText(locale);
  const closedOrder = closedFieldOrderFromText(locale);
  const lines = [
    ...rows.map((row) => order.map((field) => String(row[field])).join('|')),
    ...closed.map((row) => closedOrder.map((field) => (field === null ? 'C' : String(row[field]))).join('|')),
  ].map((line) => Buffer.from(line, 'utf8')).sort(Buffer.compare).map((bytes) => bytes.toString('utf8'));
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

  it.each(['el', 'en'] as const)('🔴 %s: Φ-Δ.7γ — με κλεισμένες γραμμές ο τρίτος, ΜΟΝΟ από το κείμενο, βγάζει το αποτύπωμα v3 του κώδικα', async (locale) => {
    const schemes = quotedAll(verificationStep(locale, 2), /[«"](nestor\.[^»"]+)[»"]/g);
    expect(schemes).toEqual([HANDOVER_DELIVERY_DIGEST_SCHEME, HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES]);
    // Κατά bytes «C» (0x43) < «f» (0x66): οι κλεισμένες πάνε ΠΡΩΤΕΣ — «αποδεδειγμένες και μετά κλεισμένες» θα κοκκίνιζε.
    const closed: readonly HandoverClosedDigestLineFields[] = [
      { sourceFileId: 'file_gamma', copyFileId: 'file_nu_copy', crc32c: 'AAAAAA==', size: 9000, cause: 'bytes-gone' },
      { sourceFileId: 'file_delta', copyFileId: 'file_xi_copy', crc32c: 'yZRlqg==', size: 12, cause: 'source-unlocated' },
    ];
    const expected = thirdPartyDigestWithClosed(ROWS, closed, schemes[1], locale);
    await expect(handoverDeliveryDigest(ROWS, closed)).resolves.toBe(expected);
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

  it.each(HANDOVER_PROTOCOL_REQUIRED_CLAUSES)('η ρήτρα «%s» υπάρχει στην τελευταία έκδοση', (id) => {
    const lookup = latestLegalDocumentVersion(DOCUMENT);
    if (lookup.kind !== 'published') throw new Error('καμία έκδοση');
    expect(clauseIdsOf(lookup.version.frozen)).toContain(id);
  });

  it('Γ32 — οι όροι μιας ημέρας: σε ισχύ από 2026-10-22 · πριν από αυτή ⇒ none-in-force (ποτέ εφευρημένο κείμενο)', () => {
    const terms = handoverProtocolTermsOn('2026-10-22');
    expect(terms.kind).toBe('in-force');
    if (terms.kind === 'in-force') expect(terms.version.digest).toBe('sha256:25d9432eb3563718abbf10389c2b4a05f66cd341ec9dfce860b6267629babda4');
    expect(handoverProtocolTermsOn('2026-10-21')).toEqual({ kind: 'none-in-force' });
  });

  it('Γ32 — Φ-Δ.7γ: από 2026-10-26 σε ισχύ το v2 (ουσιώδης αλλαγή) — η 25/10 μένει στο v1, ποτέ αναδρομικά', () => {
    const terms = handoverProtocolTermsOn('2026-10-26');
    expect(terms.kind).toBe('in-force');
    if (terms.kind === 'in-force') {
      expect(terms.version.frozen.version).toBe(2);
      expect(terms.version.digest).toBe('sha256:493e4c36333dd492437469c4dea7d0660d0810317fad39ff75f183fa8c68108a');
    }
    const before = handoverProtocolTermsOn('2026-10-25');
    expect(before.kind === 'in-force' && before.version.frozen.version).toBe(1);
  });

  it('🔴 Γ32 — κείμενο χωρίς υποχρεωτική ρήτρα ⇒ ονομάζει ΠΟΙΑ λείπει', () => {
    const lookup = latestLegalDocumentVersion(DOCUMENT);
    if (lookup.kind !== 'published') throw new Error('καμία έκδοση');
    const { frozen } = lookup.version;
    const stripped = {
      ...frozen,
      locales: {
        ...frozen.locales,
        el: {
          ...frozen.locales.el,
          sections: frozen.locales.el.sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => !(b.kind === 'clause' && b.id === 'notPropertyDelivery')) })),
        },
      },
    };
    expect(missingHandoverProtocolClauses(frozen)).toEqual([]);
    expect(missingHandoverProtocolClauses(stripped)).toEqual(['notPropertyDelivery']);
  });

  it('τα ids των ρητρών είναι ΚΟΙΝΑ στις δύο γλώσσες, με μη κενό κείμενο', () => {
    const idsOf = (locale: 'el' | 'en') =>
      frozenText(locale).sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'clause' && b.text.trim() !== '' ? [b.id] : [])));
    expect(idsOf('en')).toEqual(idsOf('el'));
  });
});
