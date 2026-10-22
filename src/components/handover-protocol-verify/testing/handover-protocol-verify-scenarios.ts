/**
 * @fileoverview **Τα σενάρια της γκαλερί επαλήθευσης** — πραγματικά PDF με συνημμένο manifest + ωμές απαντήσεις μητρώου
 *               (ADR-916 Φ-Γ2 Σ6 · `/test-harness/handover-protocol-verify`).
 * @module components/handover-protocol-verify/testing/handover-protocol-verify-scenarios
 *
 * 🔴 **Το αρχείο είναι ΑΛΗΘΙΝΟ PDF**: φτιάχνεται με pdf-lib και το manifest επισυνάπτεται με τον **ίδιο** γραφέα της Σ4
 *    (`attachHandoverProtocolManifest`). Η σελίδα το διαβάζει με τον **πραγματικό** αναγνώστη, κατακερματίζει με το
 *    πραγματικό Web Crypto και η απάντηση του μητρώου περνά από τον πραγματικό αποκωδικοποιητή. Μόνο το δίκτυο είναι σενάριο.
 * ⚠️ Το manifest γράφεται εδώ **με το χέρι**, όχι από το `handoverProtocolManifestOf`: ο αναγνώστης δοκιμάζεται απέναντι σε
 *    σχήμα γραμμένο ανεξάρτητα (το «γραφέας → αναγνώστης» το φυλά η άγκυρα της Σ6).
 * **Layering**: dev-only.
 */

import type { ScriptedReply } from '@/components/testing/harness/scripted-transport';
import { HANDOVER_DELIVERY_DIGEST_SCHEME, handoverDeliveryDigest } from '@/lib/property-handover/handover-delivery-plan';
import { HANDOVER_PROTOCOL_MANIFEST_SCHEME, type HandoverProtocolManifestFile } from '@/lib/property-handover/handover-protocol-manifest-parse';
import type { HandoverPackageFileEvidence } from '@/lib/property-handover/handover-protocol-package-check';
import type { HandoverProtocolRegistryAnswer } from '@/lib/property-handover/handover-protocol-verification';

const ISSUED_AT = '2026-10-21T21:30:00.000Z';

/** Έγκυρη ταυτότητα `phpr_<uuid v4>` ανά σενάριο — ο δρομολογητής απαντά κατά ταυτότητα. */
const protocolIdOf = (n: number): string => `phpr_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const HARNESS_FILES: readonly HandoverProtocolManifestFile[] = [
  { sourceFileId: 'file_src_1', copyFileId: 'file_cpy_1', sha256: 'a'.repeat(64), size: 182_340, name: 'Οικοδομική άδεια.pdf' },
  { sourceFileId: 'file_src_2', copyFileId: 'file_cpy_2', sha256: 'b'.repeat(64), size: 2_480_112, name: 'Κάτοψη ορόφου.dwg' },
  { sourceFileId: 'file_src_3', copyFileId: 'file_cpy_3', sha256: 'c'.repeat(64), size: 96_004, name: 'Πιστοποιητικό ενεργειακής απόδοσης.pdf' },
];

type ManifestShape = 'valid' | 'inconsistent' | 'foreign-schema';
export type ProtocolFileShape = ManifestShape | 'no-manifest' | 'not-pdf';

/** Ό,τι «απαντά» το μητρώο για αυτό το σενάριο — `null` ⇒ δεν ρωτιέται ποτέ (απορρίπτεται τοπικά). */
type RegistryScript = HandoverProtocolRegistryAnswer | { readonly status: 429 | 503 } | null;

export interface ProtocolCheckScenario {
  readonly id: string;
  readonly protocolId: string;
  readonly file: ProtocolFileShape;
  readonly registry: RegistryScript;
  /** Η σελίδα άνοιξε από QR **αυτού** του κωδικού (`other-protocol`). */
  readonly expectedProtocolId: string | null;
}

const registered = (file: 'match' | 'mismatch' | 'not-provided', standing: Extract<HandoverProtocolRegistryAnswer, { kind: 'registered' }>['standing']): HandoverProtocolRegistryAnswer => ({
  kind: 'registered', revision: 2, issuedAt: ISSUED_AT, rows: HARNESS_FILES.length,
  bytes: HARNESS_FILES.reduce((sum, row) => sum + row.size, 0), digest: 'd'.repeat(64), legalTextVersion: 1, file, standing,
});

const scenario = (n: number, id: string, file: ProtocolFileShape, registry: RegistryScript, expected = false): ProtocolCheckScenario => ({
  id, protocolId: protocolIdOf(n), file, registry, expectedProtocolId: expected ? protocolIdOf(900 + n) : null,
});

/** Κάθε ετυμηγορία + κάθε τοπική άρνηση + κάθε «μη διαθέσιμο». */
export const PROTOCOL_CHECK_SCENARIOS: readonly ProtocolCheckScenario[] = [
  scenario(1, 'verified', 'valid', registered('match', { kind: 'current' })),
  scenario(2, 'superseded', 'valid', registered('match', { kind: 'superseded', latestRevision: 3 })),
  scenario(3, 'standing-undetermined', 'valid', registered('match', { kind: 'undetermined' })),
  scenario(4, 'altered', 'valid', registered('mismatch', { kind: 'current' })),
  scenario(5, 'not-registered', 'valid', { kind: 'unknown' }),
  scenario(6, 'other-protocol', 'valid', registered('match', { kind: 'current' }), true),
  scenario(7, 'table-inconsistent', 'inconsistent', null),
  scenario(8, 'no-manifest', 'no-manifest', null),
  scenario(9, 'manifest-foreign-schema', 'foreign-schema', null),
  scenario(10, 'not-pdf', 'not-pdf', null),
  scenario(11, 'rate-limited', 'valid', { status: 429 }),
  scenario(12, 'registry-unreachable', 'valid', { status: 503 }),
];

/** Η καταχώριση από χαρτί (QR) — χωρίς αρχείο. */
export const PROTOCOL_RECORD_SCENARIOS: readonly { readonly id: string; readonly protocolId: string; readonly registry: RegistryScript }[] = [
  { id: 'record-current', protocolId: protocolIdOf(101), registry: registered('not-provided', { kind: 'current' }) },
  { id: 'record-superseded', protocolId: protocolIdOf(102), registry: registered('not-provided', { kind: 'superseded', latestRevision: 3 }) },
  { id: 'record-undetermined', protocolId: protocolIdOf(103), registry: registered('not-provided', { kind: 'undetermined' }) },
  { id: 'record-unknown', protocolId: protocolIdOf(104), registry: { kind: 'unknown' } },
  { id: 'record-rate-limited', protocolId: protocolIdOf(105), registry: { status: 429 } },
];

const ANSWERS = new Map<string, RegistryScript>(
  [...PROTOCOL_CHECK_SCENARIOS, ...PROTOCOL_RECORD_SCENARIOS].map((item) => [item.protocolId, item.registry]),
);

/** **Η ωμή απάντηση της πόρτας** για ένα `protocolId` — `undefined` ⇒ όχι δικό μας (στον αληθινό μεταφορέα). */
export function scriptedVerificationFor(protocolId: string): ScriptedReply | undefined {
  const script = ANSWERS.get(protocolId);
  if (script === undefined || script === null) return undefined;
  if ('status' in script) return { status: script.status, body: { ok: false, reason: 'unavailable' } };
  return { status: 200, body: { ok: true, registry: script } };
}

async function manifestTextOf(protocolId: string, shape: ManifestShape): Promise<string> {
  const digest = (await handoverDeliveryDigest(HARNESS_FILES)) ?? '';
  const totalBytes = HARNESS_FILES.reduce((sum, row) => sum + row.size, 0);
  return `${JSON.stringify({
    schema: shape === 'foreign-schema' ? 'acme.transmittal.v9' : HANDOVER_PROTOCOL_MANIFEST_SCHEME,
    protocol: { id: protocolId, revision: 2, supersedes: { id: protocolIdOf(0), revision: 1 }, issuedAt: ISSUED_AT },
    issuer: { name: 'Κατασκευαστική Παράδειγμα Α.Ε.' },
    property: { label: 'Διαμέρισμα Α2 · 2ος όροφος', appurtenances: [] },
    recipient: { name: 'Μαρία Παπαδοπούλου' },
    events: { saleCompletedAt: ISSUED_AT, invitationAcceptedAt: ISSUED_AT, deliveryStartedAt: ISSUED_AT, deliveryCompletedAt: ISSUED_AT },
    legalText: { document: 'handover-protocol', version: 1, digest: 'sha256:'.padEnd(71, 'e'), path: '/handover-protocol/versions/1' },
    delivery: {
      scheme: HANDOVER_DELIVERY_DIGEST_SCHEME,
      line: 'sourceFileId|copyFileId|sha256|size',
      digest: shape === 'inconsistent' ? 'f'.repeat(64) : digest,
      totalBytes,
      files: HARNESS_FILES,
    },
  }, null, 2)}\n`;
}

/** **Το αρχείο του σεναρίου** — αληθινό PDF (με ή χωρίς manifest), ή κείμενο για το `not-pdf`. */
export async function scenarioFileOf(item: ProtocolCheckScenario): Promise<File> {
  const name = `protocol-${item.id}.pdf`;
  if (item.file === 'not-pdf') return new File(['not a pdf'], name, { type: 'text/plain' });
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const blank = await doc.save({ useObjectStreams: false });
  if (item.file === 'no-manifest') return new File([Uint8Array.from(blank)], name, { type: 'application/pdf' });
  const { attachHandoverProtocolManifest } = await import('@/services/pdf/renderers/handover-protocol/handover-protocol-manifest');
  const pdf = await attachHandoverProtocolManifest(blank, await manifestTextOf(item.protocolId, item.file), new Date(ISSUED_AT));
  return new File([Uint8Array.from(pdf)], name, { type: 'application/pdf' });
}

/** Ο έλεγχος πακέτου — κάθε κατάσταση γραμμής και κάθε «εκτός πίνακα». */
export const PACKAGE_SCENARIOS: readonly { readonly id: string; readonly provided: readonly HandoverPackageFileEvidence[] }[] = [
  { id: 'package-complete', provided: HARNESS_FILES.map((row) => ({ name: row.name ?? '', size: row.size, sha256: row.sha256 })) },
  {
    id: 'package-renamed-and-extra',
    provided: [
      { name: 'adeia-scan.pdf', size: HARNESS_FILES[0].size, sha256: HARNESS_FILES[0].sha256 },
      { name: HARNESS_FILES[1].name ?? '', size: HARNESS_FILES[1].size, sha256: HARNESS_FILES[1].sha256 },
      { name: HARNESS_FILES[2].name ?? '', size: HARNESS_FILES[2].size, sha256: HARNESS_FILES[2].sha256 },
      { name: 'Φωτογραφίες.zip', size: 4_200_000, sha256: '9'.repeat(64) },
    ],
  },
  {
    id: 'package-differs-missing-unchecked',
    provided: [
      { name: HARNESS_FILES[0].name ?? '', size: HARNESS_FILES[0].size, sha256: '1'.repeat(64) },
      { name: HARNESS_FILES[1].name ?? '', size: 900_000_000, sha256: null },
      { name: 'Βίντεο ξενάγησης.mp4', size: 1_400_000_000, sha256: null },
    ],
  },
];
