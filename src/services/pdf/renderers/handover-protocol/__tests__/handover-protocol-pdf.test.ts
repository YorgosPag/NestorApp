/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ34 (Φ-Γ2 Σ4) — **το σφραγισμένο Πρωτόκολλο λέει ό,τι υπόσχεται το παγωμένο κείμενο.**
 *
 * Σφράγιση με τον **συνθετικό πάροχο του ADR-918** (CSC v2 + TSA σε επίπεδο HTTP — κανένας πραγματικός πελάτης δεν
 * παρακάμπτεται). Ο «τρίτος» διαβάζει το PDF όπως θα το διάβαζε: `verifyPdfSeal` · το συνημμένο `manifest.json` ·
 * το κείμενο των σελίδων (pdf.js, μέσω του χάρτη ToUnicode).
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { legalDocumentInForce } from '@/lib/legal/legal-document-versions';
import { operatorStatementOn } from '@/lib/platform-operator/operator-presentation';
import { readProtocolLocally } from '@/components/handover-protocol-verify/protocol-local-read';
import {
  HANDOVER_DELIVERY_DIGEST_SCHEME,
  HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES,
  handoverDeliveryDigest,
} from '@/lib/property-handover/handover-delivery-plan';
import {
  HANDOVER_PROTOCOL_MANIFEST_SCHEME,
  HANDOVER_PROTOCOL_MANIFEST_SCHEME_WITH_CLOSURES,
  parseHandoverProtocolManifest,
} from '@/lib/property-handover/handover-protocol-manifest-parse';
import {
  assessHandoverProtocolManifest,
  handoverProtocolVerdictOf,
  registryAnswerOf,
} from '@/lib/property-handover/handover-protocol-verification';
import type { PropertyHandoverProtocol } from '@/types/property-handover-protocol';
import { openSealSession } from '@/server/pdf-seal/seal-pdf.server';
import { verifyPdfSeal } from '@/server/pdf-seal/verify-pdf-seal';
import { makeSigner, syntheticProvider, type SyntheticSigner } from '@/server/pdf-seal/__tests__/synthetic-seal-provider';

import { handoverProtocolManifestOf, readHandoverProtocolManifest } from '../handover-protocol-manifest';
import { produceHandoverProtocolPdf } from '../handover-protocol-pdf.server';
import { NO_HANDOVER_PROTOCOL_QR, renderHandoverProtocolPdf } from '../handover-protocol-pdf-renderer';
import {
  handoverProtocolViewOf,
  type HandoverProtocolClosedRow,
  type HandoverProtocolRow,
  type HandoverProtocolView,
} from '../handover-protocol-view';
import { HANDOVER_PROTOCOL_WORDING } from '../handover-protocol-wording';

const warn = jest.fn();
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: (...a: unknown[]) => warn(...a), error: jest.fn() }) }));

const DAY = 86_400_000;
const NOW = new Date('2026-10-22T10:00:00.000Z');
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

const ROWS: readonly HandoverProtocolRow[] = [
  { sourceFileId: 'file_zeta', copyFileId: 'file_copy_1', sha256: sha('zeta'), size: 1048576, name: 'Οικοδομική άδεια.pdf' },
  { sourceFileId: 'file_alpha', copyFileId: 'file_copy_2', sha256: sha('alpha'), size: 42, name: 'Πιστοποιητικό ενεργειακής απόδοσης.pdf' },
  { sourceFileId: 'file_beta', copyFileId: 'file_copy_3', sha256: sha('beta'), size: 7, name: null },
];

async function viewOf(overrides: Partial<HandoverProtocolView> = {}): Promise<HandoverProtocolView> {
  const terms = legalDocumentInForce('handover-protocol', '2026-10-22');
  const operator = operatorStatementOn('2026-10-22');
  if (terms.kind !== 'in-force' || operator.kind !== 'declared') throw new Error('fixture: κείμενο ή φορέας λείπει');
  return handoverProtocolViewOf({
    protocolId: 'phpr_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16',
    revision: 2,
    supersedes: { protocolId: 'phpr_11111111-2222-4333-8444-555555555555', revision: 1 },
    issuedAt: NOW.toISOString(),
    issuerName: 'Κατασκευαστική Άλφα Α.Ε.',
    propertyLabel: 'Διαμέρισμα Α1',
    appurtenances: ['Θέση στάθμευσης Π3', 'Αποθήκη Υ2'],
    recipientName: 'Άννα Παπαδοπούλου',
    events: {
      saleCompletedAt: '2026-10-20T09:00:00.000Z', invitationAcceptedAt: '2026-10-21T07:30:00.000Z',
      deliveryStartedAt: '2026-10-21T07:31:00.000Z', deliveryCompletedAt: '2026-10-21T07:40:00.000Z',
    },
    ledgerDigest: (await handoverDeliveryDigest(ROWS)) ?? '',
    rows: ROWS,
    legalText: {
      version: terms.version.frozen.version, digest: terms.version.digest, text: terms.version.frozen.locales.el,
      path: '/handover-protocol/versions/1', url: 'https://nestorconstruct.gr/handover-protocol/versions/1',
    },
    verification: {
      path: '/handover-protocol/verify/phpr_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16',
      url: 'https://nestorconstruct.gr/handover-protocol/verify/phpr_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16',
    },
    operator: operator.view,
    closed: [],
    ...overrides,
  });
}

let seal: SyntheticSigner;
let tsa: SyntheticSigner;

beforeAll(async () => {
  seal = await makeSigner('VATEL-999999999', new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 365 * DAY));
  tsa = await makeSigner('SYNTHETIC-TSA', new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 365 * DAY), 'SYNTHETIC TSA');
}, 30_000);

beforeEach(() => warn.mockClear());

const configured = () => {
  const provider = syntheticProvider(seal, tsa, { tsa: { genTime: NOW } });
  return openSealSession(provider.env, provider.transport);
};

async function sealedOf(view: HandoverProtocolView) {
  const outcome = await produceHandoverProtocolPdf(view, configured());
  if (outcome.kind !== 'sealed') throw new Error(`αναμενόταν σφράγιση: ${JSON.stringify(outcome)}`);
  return outcome;
}

/**
 * **Ο τρίτος διαβάζει το κείμενο** — χωριστή διεργασία Node με το **πραγματικό** pdf.js (ES module, που το jest δεν
 * φορτώνει), πάνω στο αρχείο στον δίσκο: ό,τι θα έκανε ένα πρόγραμμα ανάγνωσης, χωρίς τίποτα από τον κώδικα που κρίνεται.
 */
const PDFJS_ORACLE = String.raw`(async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(require('fs').readFileSync(process.argv[1]));
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(items.map((item) => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join(''));
  }
  process.stdout.write(pages.join('\n'));
})()`;

function textOf(pdf: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), 'phpr-'));
  try {
    const file = join(dir, 'protocol.pdf');
    writeFileSync(file, pdf);
    return execFileSync(process.execPath, ['-e', PDFJS_ORACLE, file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('Γ34 — το σφραγισμένο Πρωτόκολλο', () => {
  let view: HandoverProtocolView;
  let sealed: Awaited<ReturnType<typeof sealedOf>>;
  let text: string;

  beforeAll(async () => {
    view = await viewOf();
    sealed = await sealedOf(view);
    text = textOf(sealed.pdf);
  }, 60_000);

  it('γνήσια σφραγίδα PAdES με χρονοσήμανση (ο ελεγκτής του ADR-902)', async () => {
    await expect(verifyPdfSeal(sealed.pdf)).resolves.toMatchObject({ kind: 'valid', timestamped: true });
    expect(sealed.sha256).toBe(sha256Of(sealed.pdf));
  });

  it('το συνημμένο manifest.json = οι γραμμές του καθολικού, με τη σειρά του αποτυπώματος', async () => {
    const manifest = JSON.parse((await readHandoverProtocolManifest(sealed.pdf)) ?? 'null');
    expect(manifest.delivery.scheme).toBe(HANDOVER_DELIVERY_DIGEST_SCHEME);
    expect(manifest.delivery.digest).toBe(view.ledgerDigest);
    expect(manifest.delivery.files.map((f: HandoverProtocolRow) => f.sourceFileId)).toEqual(['file_alpha', 'file_beta', 'file_zeta']);
    expect(manifest.protocol).toEqual({ id: view.protocolId, revision: 2, supersedes: { id: view.supersedes?.protocolId, revision: 1 }, issuedAt: view.issuedAt });
  });

  it('ο τρίτος ξαναϋπολογίζει το αποτύπωμα ΜΟΝΟ από το manifest', async () => {
    const manifest = JSON.parse((await readHandoverProtocolManifest(sealed.pdf)) ?? 'null');
    await expect(handoverDeliveryDigest(manifest.delivery.files)).resolves.toBe(view.ledgerDigest);
  });

  it('το κείμενο τυπώνει: αποτύπωμα · «δεν αποτελεί παραλαβή» · έκδοση + αποτύπωμα κειμένου · αναθεώρηση + αντικαθιστά', () => {
    const flat = text.replace(/\s+/g, '');
    expect(flat).toContain(view.ledgerDigest);
    expect(text).toContain('δεν αποτελεί παράδοση ούτε παραλαβή του ακινήτου');
    expect(flat).toContain(view.legalText.digest.replace(/\s+/g, ''));
    expect(text).toContain(HANDOVER_PROTOCOL_WORDING.el.legalHeading(1));
    expect(text).toContain(HANDOVER_PROTOCOL_WORDING.el.revision(2));
    expect(text).toContain('Αντικαθιστά την αναθεώρηση 1');
    for (const row of ROWS) expect(flat).toContain(row.sha256);
  });

  it('Σ6: τυπώνει τον σύνδεσμο της πόρτας επαλήθευσης ΑΥΤΟΥ του κωδικού — και το manifest μένει χωρίς αυτόν (σχήμα v1)', async () => {
    expect(text).toContain(HANDOVER_PROTOCOL_WORDING.el.verifyLink);
    expect(text.replace(/\s+/g, '')).toContain(view.verification.url ?? 'λείπει');
    expect(await readHandoverProtocolManifest(sealed.pdf)).not.toContain('/verify');
  });

  it('🔒 GDPR: ΚΑΝΕΝΑ «@» στο κείμενο ή στο manifest — ούτε του φορέα, που ΕΧΕΙ email στο μητρώο του', async () => {
    expect(view.operator.contactEmail).toContain('@'); // μάρτυρας διάκρισης: το email υπάρχει και θα φαινόταν
    expect(text).not.toContain('@');
    expect(await readHandoverProtocolManifest(sealed.pdf)).not.toContain('@');
  });
});

function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('Γ34 — άρνηση και ντετερμινισμός', () => {
  it('ντετερμινισμός: δύο αποδόσεις της ίδιας όψης ⇒ ΙΔΙΑ bytes πριν τη σφράγιση', async () => {
    const view = await viewOf();
    const [a, b] = await Promise.all([renderHandoverProtocolPdf(view, HANDOVER_PROTOCOL_WORDING.el, NO_HANDOVER_PROTOCOL_QR), renderHandoverProtocolPdf(view, HANDOVER_PROTOCOL_WORDING.el, NO_HANDOVER_PROTOCOL_QR)]);
    expect(sha256Of(a)).toBe(sha256Of(b));
    expect(handoverProtocolManifestOf(view)).toBe(handoverProtocolManifestOf(await viewOf({ rows: [...ROWS].reverse() })));
  }, 30_000);

  it('🔴 χωρίς ρύθμιση παρόχου ⇒ κανένα PDF, ένα σήμα ανά εκτέλεση', async () => {
    const session = openSealSession({}, { fetchImpl: jest.fn(), env: {}, now: () => NOW });
    const view = await viewOf();
    const outcomes = await Promise.all([produceHandoverProtocolPdf(view, session), produceHandoverProtocolPdf(view, session)]);
    expect(outcomes.map((o) => o.kind)).toEqual(['awaiting-seal-configuration', 'awaiting-seal-configuration']);
    expect(outcomes.some((o) => 'pdf' in o)).toBe(false);
    expect(session.finish()).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
  }, 30_000);

  it('🔴 πίνακας που δεν δίνει το αποτύπωμα του καθολικού ⇒ digest-mismatch, τίποτα δεν σφραγίζεται', async () => {
    const outcome = await produceHandoverProtocolPdf(await viewOf({ ledgerDigest: 'f'.repeat(64) }), configured());
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'digest-mismatch' });
  });
});

/**
 * Γ41 (Σ6) — **η πόρτα επαλήθευσης διαβάζει το ΠΡΑΓΜΑΤΙΚΑ σφραγισμένο Πρωτόκολλο** όπως ο browser του τρίτου: ο ίδιος
 * αναγνώστης, το ίδιο Web Crypto, η ίδια κρίση. Γραφέας → αναγνώστης κλείνει εδώ, όχι σε χειρόγραφο fixture.
 */
describe('Γ41 — η πόρτα επαλήθευσης πάνω στο σφραγισμένο PDF', () => {
  let view: HandoverProtocolView;
  let sealed: Awaited<ReturnType<typeof sealedOf>>;

  beforeAll(async () => {
    view = await viewOf();
    sealed = await sealedOf(view);
  }, 60_000);

  const storedFor = (pdfSha256: string): PropertyHandoverProtocol => ({
    protocolId: view.protocolId, revision: view.revision, digest: view.ledgerDigest, issuedAt: view.issuedAt,
    companyFileId: 'file_company', recipientFileId: 'file_recipient', companyId: 'comp_1', propertyId: 'prop_1',
    handoverId: 'phov_1', recipientUserId: 'user_1', supersedesProtocolId: view.supersedes?.protocolId ?? null,
    pdfSha256, legalText: { version: view.legalText.version, digest: view.legalText.digest }, rows: view.rows.length, bytes: view.totalBytes,
  });

  it('ο αναγνώστης της πόρτας = ο γραφέας: manifest αναγνωρίσιμο, πίνακας αυτοσυνεπής, αποτύπωμα αρχείου = του μητρώου', async () => {
    const reading = await readProtocolLocally(new Blob([Uint8Array.from(sealed.pdf)]));
    if (reading.kind !== 'readable') throw new Error(`αναμενόταν readable: ${reading.kind}`);
    expect(reading.pdfSha256).toBe(sealed.sha256);
    expect(reading.manifest.protocol).toEqual({ id: view.protocolId, revision: 2, supersedes: { id: view.supersedes?.protocolId, revision: 1 }, issuedAt: view.issuedAt });
    expect(reading.manifest.delivery.digest).toBe(view.ledgerDigest);
    expect(parseHandoverProtocolManifest(sealed.manifest)).toEqual(reading.manifest);
  });

  it('καταχωρισμένο + ίδια bytes + τρέχον ⇒ «Επαληθευμένο»', async () => {
    const reading = await readProtocolLocally(new Blob([Uint8Array.from(sealed.pdf)]));
    if (reading.kind !== 'readable') throw new Error(reading.kind);
    const pointer = { ...storedFor(sealed.sha256) };
    const registry = registryAnswerOf(storedFor(sealed.sha256), pointer, reading.pdfSha256);
    expect(handoverProtocolVerdictOf(reading, registry, view.protocolId).kind).toBe('verified');
  });

  it('🔴 ΕΝΑ byte προστεθειμένο (incremental update) ⇒ διαβάζεται ακόμη, αλλά «Δεν είναι το αρχείο που εκδόθηκε»', async () => {
    const touched = Uint8Array.from([...sealed.pdf, 0x0a]);
    await expect(verifyPdfSeal(touched)).resolves.toMatchObject({ kind: 'invalid' });
    const reading = await readProtocolLocally(new Blob([touched]));
    if (reading.kind !== 'readable') throw new Error(reading.kind);
    const registry = registryAnswerOf(storedFor(sealed.sha256), storedFor(sealed.sha256), reading.pdfSha256);
    expect(handoverProtocolVerdictOf(reading, registry, null).kind).toBe('altered');
  });

  it('🔴 PDF χωρίς manifest (π.χ. σάρωση του χαρτιού) ⇒ no-manifest, καμία ερώτηση στο μητρώο', async () => {
    const blank = await renderHandoverProtocolPdf(view, HANDOVER_PROTOCOL_WORDING.el, NO_HANDOVER_PROTOCOL_QR);
    await expect(readProtocolLocally(new Blob([Uint8Array.from(blank)]))).resolves.toEqual({ kind: 'refused', reason: 'no-manifest' });
  });
});

/** Φ-Δ.7γ (ADR-916 §5.23) — Ζ93–Ζ96: το Πρωτόκολλο με γραμμές κλεισμένες χωρίς πλήρες αποτύπωμα. */
describe('Ζ93–Ζ96 — Φ-Δ.7γ: το Πρωτόκολλο με κλεισμένες γραμμές', () => {
  const CLOSED: readonly HandoverProtocolClosedRow[] = [
    { sourceFileId: 'file_omega', copyFileId: 'file_copy_9', crc32c: 'AAAAAA==', size: 4096, cause: 'bytes-gone', deliveredAt: '2026-10-21T07:35:00.000Z', name: 'Τοπογραφικό.pdf' },
  ];
  const closedView = async () => viewOf({ closed: CLOSED, ledgerDigest: (await handoverDeliveryDigest(ROWS, CLOSED)) ?? '' });

  it('🔴 Ζ93 — χωρίς κλεισμένες γραμμές το manifest μένει v1 ΑΥΤΟΛΕΞΕΙ: καμία λίστα `closed`, ετικέτα αποτυπώματος v2', async () => {
    const manifest = handoverProtocolManifestOf(await viewOf());
    expect(JSON.parse(manifest)).toMatchObject({ schema: HANDOVER_PROTOCOL_MANIFEST_SCHEME, delivery: { scheme: HANDOVER_DELIVERY_DIGEST_SCHEME } });
    expect(manifest).not.toContain('closed');
  });

  it('🔴 Ζ94 — με κλεισμένη γραμμή: manifest v2 · ετικέτα v3 · χωριστή λίστα · ο τρίτος το βρίσκει αυτοσυνεπές', async () => {
    const view = await closedView();
    const manifest = handoverProtocolManifestOf(view);
    expect(JSON.parse(manifest)).toMatchObject({
      schema: HANDOVER_PROTOCOL_MANIFEST_SCHEME_WITH_CLOSURES,
      delivery: { scheme: HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES, closedLine: 'C|sourceFileId|copyFileId|crc32c|size|cause', closed: [{ sourceFileId: 'file_omega', cause: 'bytes-gone' }] },
    });
    await expect(assessHandoverProtocolManifest(manifest)).resolves.toMatchObject({ kind: 'consistent' });
    // Αλλαγή της αιτίας μιας κλεισμένης γραμμής στο manifest ⇒ ο τρίτος το βλέπει (το v3 τη δεσμεύει).
    const tampered = JSON.parse(manifest);
    tampered.delivery.closed[0].cause = 'source-unlocated';
    await expect(assessHandoverProtocolManifest(JSON.stringify(tampered))).resolves.toMatchObject({ kind: 'digest-inconsistent' });
  });

  it('🔴 Ζ95 — το σφραγισμένο PDF τυπώνει τον ΔΕΥΤΕΡΟ πίνακα: κωδικός αιτίας + CRC32C, και το manifest v2 μέσα του', async () => {
    const view = await closedView();
    const sealed = await sealedOf(view);
    const text = textOf(sealed.pdf);
    expect(text).toContain(HANDOVER_PROTOCOL_WORDING.el.closedHeading);
    expect(text).toContain('bytes-gone');
    expect(text).toContain('AAAAAA==');
    expect(text.replace(/\s+/g, '')).toContain(HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES);
    expect(parseHandoverProtocolManifest((await readHandoverProtocolManifest(sealed.pdf)) ?? '')?.delivery.closed).toHaveLength(1);
  }, 60_000);

  it('🔴 Ζ96 — αποτύπωμα που ΔΕΝ δεσμεύει την κλεισμένη γραμμή ⇒ digest-mismatch, τίποτα δεν σφραγίζεται', async () => {
    const outcome = await produceHandoverProtocolPdf(await viewOf({ closed: CLOSED }), configured());
    expect(outcome).toMatchObject({ kind: 'failed', reason: 'digest-mismatch' });
  });
});
