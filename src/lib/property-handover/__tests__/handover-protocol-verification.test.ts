/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ42 (Φ-Γ2 Σ6) — **η κρίση της πόρτας επαλήθευσης**: ο αναγνώστης του manifest, η απάντηση του
 * μητρώου, ο αποκωδικοποιητής του πελάτη, η αυτοσυνέπεια του πίνακα και η ΜΙΑ ετυμηγορία.
 * 🔴 Η κεντρική υπόσχεση: «Επαληθευμένο» **μόνο** όταν καταχωρισμένο + ίδια bytes + τρέχουσα αναθεώρηση.
 */

import { HANDOVER_DELIVERY_DIGEST_SCHEME, handoverDeliveryDigest } from '../handover-delivery-plan';
import { HANDOVER_PROTOCOL_MANIFEST_SCHEME, parseHandoverProtocolManifest, type HandoverProtocolManifest } from '../handover-protocol-manifest-parse';
import {
  assessHandoverProtocolManifest,
  handoverProtocolVerdictOf,
  isPdfHeader,
  registryAnswerFromResponse,
  registryAnswerOf,
  type HandoverProtocolRegistryAnswer,
} from '../handover-protocol-verification';
import type { PropertyHandoverProtocol, PropertyHandoverProtocolPointer } from '@/types/property-handover-protocol';

const ID = 'phpr_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16';
const NEWER = 'phpr_11111111-2222-4333-8444-555555555555';
const PDF_SHA = 'c'.repeat(64);

const FILES = [
  { sourceFileId: 'file_b', copyFileId: 'copy_b', sha256: 'b'.repeat(64), size: 20, name: 'Κάτοψη.dwg' },
  { sourceFileId: 'file_a', copyFileId: 'copy_a', sha256: 'a'.repeat(64), size: 10, name: null },
] as const;

async function manifestJson(overrides: Record<string, unknown> = {}, delivery: Record<string, unknown> = {}): Promise<string> {
  return JSON.stringify({
    schema: HANDOVER_PROTOCOL_MANIFEST_SCHEME,
    protocol: { id: ID, revision: 2, supersedes: { id: 'phpr_prev', revision: 1 }, issuedAt: '2026-10-22T10:00:00.000Z' },
    issuer: { name: 'Άλφα Α.Ε.' },
    property: { label: 'Διαμέρισμα Α1', appurtenances: [] },
    recipient: { name: 'Άννα Π.' },
    events: {},
    legalText: { document: 'handover-protocol', version: 1, digest: 'sha256:xyz', path: '/handover-protocol/versions/1' },
    delivery: {
      scheme: HANDOVER_DELIVERY_DIGEST_SCHEME, line: 'sourceFileId|copyFileId|sha256|size',
      digest: await handoverDeliveryDigest(FILES), totalBytes: 30, files: FILES, ...delivery,
    },
    ...overrides,
  });
}

const stored = (overrides: Partial<PropertyHandoverProtocol> = {}): PropertyHandoverProtocol => ({
  protocolId: ID, revision: 2, digest: 'd'.repeat(64), issuedAt: '2026-10-22T10:00:00.000Z', companyFileId: 'f1', recipientFileId: 'f2',
  companyId: 'comp_1', propertyId: 'prop_1', handoverId: 'phov_1', recipientUserId: 'u1', supersedesProtocolId: 'phpr_prev',
  pdfSha256: PDF_SHA, legalText: { version: 1, digest: 'sha256:xyz' }, rows: 2, bytes: 30, ...overrides,
});

const pointer = (protocolId: string, revision: number): PropertyHandoverProtocolPointer => ({
  protocolId, revision, digest: 'd'.repeat(64), issuedAt: '2026-10-22T10:00:00.000Z', companyFileId: 'f1', recipientFileId: 'f2',
});

async function manifest(): Promise<HandoverProtocolManifest> {
  const parsed = parseHandoverProtocolManifest(await manifestJson());
  if (parsed === null) throw new Error('fixture');
  return parsed;
}

describe('Γ42 — ο αναγνώστης του manifest', () => {
  it('διαβάζει το σχήμα v1 πεδίο προς πεδίο (όνομα `null` μένει `null`)', async () => {
    const parsed = parseHandoverProtocolManifest(await manifestJson());
    expect(parsed?.protocol).toEqual({ id: ID, revision: 2, supersedes: { id: 'phpr_prev', revision: 1 }, issuedAt: '2026-10-22T10:00:00.000Z' });
    expect(parsed?.delivery.files[1]).toEqual({ ...FILES[1], name: null });
    expect(parsed?.recipientName).toBe('Άννα Π.');
  });

  it.each([
    ['άκυρο JSON — ποτέ εξαίρεση', '{'],
    ['ξένο σχήμα', 'schema'],
    ['ξένη συνταγή αποτυπώματος', 'scheme'],
    ['sha256 με κεφαλαία', 'upper'],
    ['άδειος πίνακας', 'empty'],
  ])('%s ⇒ null', async (_label, kind) => {
    const text = kind === '{' ? '{'
      : kind === 'schema' ? await manifestJson({ schema: 'acme.v9' })
        : kind === 'scheme' ? await manifestJson({}, { scheme: 'nestor.handover-delivery.v1' })
          : kind === 'upper' ? await manifestJson({}, { files: [{ ...FILES[0], sha256: 'B'.repeat(64) }] })
            : await manifestJson({}, { files: [] });
    expect(parseHandoverProtocolManifest(text)).toBeNull();
  });
});

describe('Γ42 — η αυτοσυνέπεια του πίνακα (στον browser, πριν το δίκτυο)', () => {
  it('συνεπής πίνακας ⇒ consistent', async () => {
    await expect(assessHandoverProtocolManifest(await manifestJson())).resolves.toMatchObject({ kind: 'consistent' });
  });
  it('🔴 πειραγμένη γραμμή ⇒ digest-inconsistent', async () => {
    const text = await manifestJson({}, { files: [{ ...FILES[0], size: 21 }, FILES[1]], totalBytes: 31 });
    await expect(assessHandoverProtocolManifest(text)).resolves.toMatchObject({ kind: 'digest-inconsistent' });
  });
  it('🔴 πειραγμένο σύνολο bytes ⇒ digest-inconsistent', async () => {
    await expect(assessHandoverProtocolManifest(await manifestJson({}, { totalBytes: 999 }))).resolves.toMatchObject({ kind: 'digest-inconsistent' });
  });
  it('κανένα συνημμένο ⇒ no-manifest · ξένο ⇒ manifest-invalid', async () => {
    await expect(assessHandoverProtocolManifest(null)).resolves.toEqual({ kind: 'no-manifest' });
    await expect(assessHandoverProtocolManifest('[]')).resolves.toEqual({ kind: 'manifest-invalid' });
  });
  it('κεφαλίδα PDF', () => {
    expect(isPdfHeader(new TextEncoder().encode('%PDF-1.7\n'))).toBe(true);
    expect(isPdfHeader(new TextEncoder().encode('%PDX'))).toBe(false);
  });
});

describe('Γ42 — η απάντηση του μητρώου', () => {
  it('ίδια bytes + δείκτης σε αυτό ⇒ match · current', () => {
    expect(registryAnswerOf(stored(), pointer(ID, 2), PDF_SHA)).toMatchObject({ kind: 'registered', file: 'match', standing: { kind: 'current' } });
  });
  it('🔴 άλλα bytes ⇒ mismatch', () => {
    expect(registryAnswerOf(stored(), pointer(ID, 2), 'e'.repeat(64))).toMatchObject({ file: 'mismatch' });
  });
  it('χωρίς αρχείο (χαρτί) ⇒ not-provided', () => {
    expect(registryAnswerOf(stored(), pointer(ID, 2), null)).toMatchObject({ file: 'not-provided' });
  });
  it('νεότερη αναθεώρηση ⇒ superseded με τον αριθμό της', () => {
    expect(registryAnswerOf(stored(), pointer(NEWER, 3), PDF_SHA)).toMatchObject({ standing: { kind: 'superseded', latestRevision: 3 } });
  });
  it('δείκτης που δεν διαβάζεται ή δεν συμφωνεί ⇒ undetermined (ποτέ «τρέχον» στα τυφλά)', () => {
    expect(registryAnswerOf(stored(), null, PDF_SHA)).toMatchObject({ standing: { kind: 'undetermined' } });
    expect(registryAnswerOf(stored(), pointer(NEWER, 1), PDF_SHA)).toMatchObject({ standing: { kind: 'undetermined' } });
  });
  it('αλλοιωμένο/ανύπαρκτο ⇒ unknown', () => {
    expect(registryAnswerOf(null, null, PDF_SHA)).toEqual({ kind: 'unknown' });
  });
  it('🔒 η απάντηση δεν κουβαλά ΚΑΝΕΝΑ στοιχείο ενοικιαστή ή αγοραστή', () => {
    const json = JSON.stringify(registryAnswerOf(stored(), pointer(ID, 2), PDF_SHA));
    for (const secret of ['comp_1', 'prop_1', 'phov_1', 'u1', PDF_SHA, 'f1', 'f2']) expect(json).not.toContain(`"${secret}"`);
  });
});

describe('Γ42 — ο αποκωδικοποιητής του πελάτη', () => {
  const answer = registryAnswerOf(stored(), pointer(ID, 2), PDF_SHA);
  it('στρογγυλό ταξίδι μέσω JSON', () => {
    expect(registryAnswerFromResponse(JSON.parse(JSON.stringify({ ok: true, registry: answer })))).toEqual(answer);
    expect(registryAnswerFromResponse({ ok: true, registry: { kind: 'unknown' } })).toEqual({ kind: 'unknown' });
  });
  it.each([
    ['ok:false', { ok: false, reason: 'unavailable' }],
    ['άγνωστο file', { ok: true, registry: { ...answer, file: 'probably' } }],
    ['άγνωστη κατάσταση', { ok: true, registry: { ...answer, standing: { kind: 'fine' } } }],
    ['superseded χωρίς αριθμό', { ok: true, registry: { ...answer, standing: { kind: 'superseded' } } }],
    ['σκουπίδι', 'verified'],
  ])('🔴 %s ⇒ null (ποτέ «επαληθευμένο» από σκουπίδι)', (_label, raw) => {
    expect(registryAnswerFromResponse(raw)).toBeNull();
  });
});

describe('Γ42 — Η ΜΙΑ ετυμηγορία', () => {
  const registry = (file: 'match' | 'mismatch', standing: Parameters<typeof registryAnswerOf>[1]): HandoverProtocolRegistryAnswer =>
    registryAnswerOf(stored(), standing, file === 'match' ? PDF_SHA : 'e'.repeat(64));

  it('«Επαληθευμένο» ΜΟΝΟ: καταχωρισμένο + ίδια bytes + τρέχον', async () => {
    const proof = { manifest: await manifest(), pdfSha256: PDF_SHA };
    expect(handoverProtocolVerdictOf(proof, registry('match', pointer(ID, 2)), null).kind).toBe('verified');
    expect(handoverProtocolVerdictOf(proof, registry('match', pointer(NEWER, 3)), null)).toMatchObject({ kind: 'superseded', latestRevision: 3 });
    expect(handoverProtocolVerdictOf(proof, registry('match', null), null).kind).toBe('genuine-standing-undetermined');
    expect(handoverProtocolVerdictOf(proof, registry('mismatch', pointer(ID, 2)), null).kind).toBe('altered');
    expect(handoverProtocolVerdictOf(proof, { kind: 'unknown' }, null).kind).toBe('not-registered');
  });

  it('🔴 «not-provided» από τον διακομιστή ενώ στάλθηκε αρχείο ⇒ altered (fail-closed)', async () => {
    const proof = { manifest: await manifest(), pdfSha256: PDF_SHA };
    expect(handoverProtocolVerdictOf(proof, registryAnswerOf(stored(), pointer(ID, 2), null), null).kind).toBe('altered');
  });

  it('🔴 αρχείο ΑΛΛΟΥ πρωτοκόλλου από αυτό του QR ⇒ other-protocol, πριν από κάθε άλλη κρίση', async () => {
    const proof = { manifest: await manifest(), pdfSha256: PDF_SHA };
    expect(handoverProtocolVerdictOf(proof, registry('match', pointer(ID, 2)), NEWER)).toEqual({ kind: 'other-protocol', expectedProtocolId: NEWER, foundProtocolId: ID });
    expect(handoverProtocolVerdictOf(proof, registry('match', pointer(ID, 2)), ID).kind).toBe('verified');
  });
});
