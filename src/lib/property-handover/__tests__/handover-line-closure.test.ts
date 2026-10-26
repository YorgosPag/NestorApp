/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Ζ97–Ζ103 (§5.23 Φ-Δ.7γ) — **η κρίση του κλεισίματος γραμμής, το αποτύπωμα v3, ο αναγνώστης v2.**
 *   Καθαρές συναρτήσεις· όλα τα δεδομένα συνθετικά.
 */

import { createHash } from 'crypto';

import { handoverFixture } from '@/components/property-handover-office/testing/handover-office-scenarios';
import { legalDocumentInForce } from '@/lib/legal/legal-document-versions';
import {
  HANDOVER_DELIVERY_DIGEST_SCHEME,
  HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES,
  handoverClosedDigestLineOf,
  handoverDeliveryDigest,
  type HandoverClosedDigestLineFields,
} from '@/lib/property-handover/handover-delivery-plan';
import { handoverLineClosureOf, handoverLineClosureOfferOf } from '@/lib/property-handover/handover-line-closure';
import {
  HANDOVER_PROTOCOL_MANIFEST_SCHEME,
  HANDOVER_PROTOCOL_MANIFEST_SCHEME_WITH_CLOSURES,
  parseHandoverProtocolManifest,
} from '@/lib/property-handover/handover-protocol-manifest-parse';
import { declaresClosedLines } from '@/lib/property-handover/handover-protocol-terms';
import type { HandoverLineEvidence } from '@/types/property-handover-line-closure';

const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const OWED = handoverFixture();
const ROWS = [
  { sourceFileId: 'file_b', copyFileId: 'copy_b', sha256: sha('b'), size: 7 },
  { sourceFileId: 'file_a', copyFileId: 'copy_a', sha256: sha('a'), size: 42 },
];
const CLOSED: HandoverClosedDigestLineFields = { sourceFileId: 'file_c', copyFileId: 'copy_c', crc32c: 'AAAAAA==', size: 9, cause: 'bytes-gone' };

describe('Ζ97 — μία κρίση για κουμπί ΚΑΙ πόρτα', () => {
  const cases: readonly [HandoverLineEvidence, ReturnType<typeof handoverLineClosureOfferOf>][] = [
    [{ kind: 'lost', cause: 'bytes-gone' }, { kind: 'close', cause: 'bytes-gone' }],
    [{ kind: 'lost', cause: 'source-unlocated' }, { kind: 'close', cause: 'source-unlocated' }],
    [{ kind: 'provable' }, { kind: 'blocked', reason: 'provable' }],
    [{ kind: 'recovering' }, { kind: 'blocked', reason: 'recovering' }],
    [{ kind: 'proven' }, { kind: 'blocked', reason: 'proven' }],
    [{ kind: 'closed' }, { kind: 'blocked', reason: 'closed' }],
  ];
  it.each(cases)('μέτρηση %j ⇒ προσφορά %j', (evidence, offer) => {
    expect(handoverLineClosureOfferOf(OWED, evidence)).toEqual(offer);
  });

  it('🔴 η πόρτα δέχεται ΜΟΝΟ ό,τι προσφέρει το κουμπί · ήδη κλεισμένη ⇒ `unchanged` · χωρίς γραμμή ⇒ `line-unknown`', () => {
    for (const [evidence, offer] of cases) {
      const verdict = handoverLineClosureOf(OWED, evidence);
      if (evidence.kind === 'closed') expect(verdict).toEqual({ kind: 'unchanged' });
      else expect(verdict).toEqual(offer.kind === 'close' ? offer : { kind: 'refused', reason: offer.reason });
    }
    expect(handoverLineClosureOf(OWED, null)).toEqual({ kind: 'refused', reason: 'line-unknown' });
  });

  it('🔴 παράδοση που δεν οφείλεται (ανακλημένη · χωρίς παραλήπτη) ⇒ `not-owed`, ακόμη και με χαμένα bytes', () => {
    const lost: HandoverLineEvidence = { kind: 'lost', cause: 'bytes-gone' };
    expect(handoverLineClosureOfferOf(handoverFixture({ lifecycle: 'withdrawn' }), lost)).toEqual({ kind: 'blocked', reason: 'not-owed' });
    expect(handoverLineClosureOf(handoverFixture({ recipient: null }), lost)).toEqual({ kind: 'refused', reason: 'not-owed' });
  });
});

describe('Ζ98–Ζ100 — το αποτύπωμα: v2 αυτολεξεί χωρίς κλεισμένες, v3 που δεσμεύει κάθε πεδίο τους', () => {
  it('🔴 Ζ98 — χωρίς κλεισμένες = η συνταγή v2 του παγωμένου κειμένου v1, χαρακτήρα προς χαρακτήρα', async () => {
    const recipe = [HANDOVER_DELIVERY_DIGEST_SCHEME, `file_a|copy_a|${sha('a')}|42`, `file_b|copy_b|${sha('b')}|7`].join('\n');
    await expect(handoverDeliveryDigest(ROWS)).resolves.toBe(sha(recipe));
    await expect(handoverDeliveryDigest(ROWS, [])).resolves.toBe(sha(recipe));
  });

  it('🔴 Ζ99 — με κλεισμένη: ετικέτα v3 + γραμμή `C|…`, μία ταξινόμηση κατά bytes (η συνταγή του κειμένου v2)', async () => {
    const lines = [`C|file_c|copy_c|AAAAAA==|9|bytes-gone`, `file_a|copy_a|${sha('a')}|42`, `file_b|copy_b|${sha('b')}|7`];
    await expect(handoverDeliveryDigest(ROWS, [CLOSED])).resolves.toBe(sha([HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES, ...lines].join('\n')));
    expect(handoverClosedDigestLineOf(CLOSED)).toBe(lines[0]);
  });

  it('🔴 Ζ100 — κάθε πεδίο της κλεισμένης αλλάζει το αποτύπωμα · μόνο κλεισμένες ⇒ αποτύπωμα · τίποτα ⇒ `null`', async () => {
    const base = await handoverDeliveryDigest(ROWS, [CLOSED]);
    const variants: readonly HandoverClosedDigestLineFields[] = [
      { ...CLOSED, sourceFileId: 'file_d' }, { ...CLOSED, copyFileId: 'copy_d' }, { ...CLOSED, crc32c: 'BBBBBB==' },
      { ...CLOSED, size: 10 }, { ...CLOSED, cause: 'source-unlocated' },
    ];
    for (const variant of variants) await expect(handoverDeliveryDigest(ROWS, [variant])).resolves.not.toBe(base);
    await expect(handoverDeliveryDigest([], [CLOSED])).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(handoverDeliveryDigest([], [])).resolves.toBeNull();
    await expect(handoverDeliveryDigest([{ ...ROWS[0], sha256: null }], [CLOSED])).resolves.toBeNull();
  });
});

describe('Ζ101–Ζ102 — ο ΕΝΑΣ αναγνώστης: v1 όπως πριν, v2 μόνο αν λέει την αλήθεια για τις κλεισμένες', () => {
  const manifestOf = (schema: string, delivery: Record<string, unknown>) => JSON.stringify({
    schema,
    protocol: { id: 'phpr_x', revision: 1, supersedes: null, issuedAt: '2026-10-25T10:00:00.000Z' },
    issuer: { name: 'Άλφα' }, property: { label: null }, recipient: { name: null },
    legalText: { version: 2, digest: 'sha256:abc' },
    delivery: { digest: 'd'.repeat(64), totalBytes: 49, files: ROWS.map((row) => ({ ...row, name: null })), ...delivery },
  });
  const closedFile = { ...CLOSED, deliveredAt: '2026-10-21T07:35:00.000Z', name: null };

  it('Ζ101 — v1 αυτούσιο: ετικέτα v2, χωρίς `closed` ⇒ διαβάζεται, με κενή λίστα κλεισμένων', () => {
    expect(parseHandoverProtocolManifest(manifestOf(HANDOVER_PROTOCOL_MANIFEST_SCHEME, { scheme: HANDOVER_DELIVERY_DIGEST_SCHEME }))?.delivery.closed).toEqual([]);
  });

  it('🔴 Ζ102 — v2: απαιτεί ετικέτα v3 και ≥ 1 κλεισμένη · δέχεται κενά `files` μόνο μαζί με κλεισμένες · απορρίπτει άγνωστη αιτία', () => {
    const v2 = (delivery: Record<string, unknown>) => parseHandoverProtocolManifest(manifestOf(HANDOVER_PROTOCOL_MANIFEST_SCHEME_WITH_CLOSURES, delivery));
    expect(v2({ scheme: HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES, closed: [closedFile] })?.delivery.closed).toHaveLength(1);
    expect(v2({ scheme: HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES, files: [], closed: [closedFile] })?.delivery.files).toEqual([]);
    expect(v2({ scheme: HANDOVER_DELIVERY_DIGEST_SCHEME, closed: [closedFile] })).toBeNull();
    expect(v2({ scheme: HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES, closed: [] })).toBeNull();
    expect(v2({ scheme: HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES, files: [], closed: [] })).toBeNull();
    expect(v2({ scheme: HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES, closed: [{ ...closedFile, cause: 'whatever' }] })).toBeNull();
    // v1 με ετικέτα v3 ⇒ δηλώνει κλεισμένες που το σχήμα του δεν μπορεί να κρατήσει.
    expect(parseHandoverProtocolManifest(manifestOf(HANDOVER_PROTOCOL_MANIFEST_SCHEME, { scheme: HANDOVER_DELIVERY_DIGEST_SCHEME_WITH_CLOSURES }))).toBeNull();
  });
});

describe('Ζ103 — δίχτυ κειμένου: το παγωμένο v1 ΔΕΝ φέρει τη ρήτρα των κλεισμένων γραμμών', () => {
  it('🔴 Πρωτόκολλο με κλεισμένη γραμμή δεν μπορεί να εκδοθεί με το κείμενο v1 (`legal-text-lacks-closures`)', () => {
    const v1 = legalDocumentInForce('handover-protocol', '2026-10-22');
    if (v1.kind !== 'in-force') throw new Error('fixture: κείμενο v1 λείπει');
    expect(v1.version.frozen.version).toBe(1);
    expect(declaresClosedLines(v1.version.frozen)).toBe(false);
  });

  it('Ζ103β — το v2 (σε ισχύ από 2026-10-26) ΦΕΡΕΙ τη ρήτρα, και στις δύο γλώσσες, αμέσως μετά το `contentNotCertified`', () => {
    const v2 = legalDocumentInForce('handover-protocol', '2026-10-26');
    if (v2.kind !== 'in-force') throw new Error('fixture: κείμενο v2 λείπει');
    expect(v2.version.frozen.version).toBe(2);
    expect(declaresClosedLines(v2.version.frozen)).toBe(true);
    for (const locale of ['el', 'en'] as const) {
      const statements = v2.version.frozen.locales[locale].sections.find((s) => s.id === 'statements');
      const ids = statements?.blocks.flatMap((b) => (b.kind === 'clause' ? [b.id] : [])) ?? [];
      expect(ids.indexOf('closedLines')).toBe(ids.indexOf('contentNotCertified') + 1);
    }
  });
});
