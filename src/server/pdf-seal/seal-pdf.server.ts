/**
 * @module server/pdf-seal/seal-pdf.server
 * @description **Η σφράγιση PDF — PAdES B-T** (ADR-918). Η μόνη πόρτα προς τα έξω: `openSealSession` / `sealPdf`.
 *
 * ```
 * αλυσίδα (θύρα) ─► κενό υπογραφής ─► signedAttrs ─► σύνοψη ─► θύρα.signDigest ─► TSA(υπογραφή) ─► CMS ─► /Contents
 *                                                                                                       │
 *                                         ADR-902 verifyPdfSeal ◄── 🔴 ΥΠΟΧΡΕΩΤΙΚΟ, πριν επιστραφεί ──────┘
 * ```
 *
 * 🔴 **Κανένα σφραγισμένο PDF δεν φεύγει χωρίς να περάσει από τον ΙΔΙΟ ελεγκτή που θα το κρίνει αύριο.**
 *    `valid` **και** `timestamped` **και** υπογράφων = το φύλλο που δήλωσε η θύρα — αλλιώς `self-check-failed`.
 *    Η θύρα μπορεί να επιστρέψει λάθος υπογραφή (άλλο κλειδί, άλλη σύνοψη, χαλασμένο ECDSA): ο αυτοέλεγχος το
 *    πιάνει **εδώ**, όχι ο δικαστής σε δύο χρόνια. Ίδιο συμβόλαιο με το «round-trip» του DocuSign/Adobe validator.
 *
 * 🔴 **Χωρίς ρύθμιση, κανένα PDF** — ούτε «ασφράγιστο προσωρινά». Η συνεδρία απαντά `awaiting-seal-configuration`
 *    χωρίς δίκτυο, μετρά, και λέει **ένα** σήμα ανά εκτέλεση (`finish()`), όχι ένα ανά έγγραφο (πρότυπο ADR-916 Β27).
 *
 * ⚠️ Το `assemblePadesSeal` (χωρίς αυτοέλεγχο) εξάγεται **μόνο** για το συνθετικό fixture του ελεγκτή, που χρειάζεται
 *    και **άκυρες** σφραγίδες για να δοκιμάσει την άρνηση. Η άγκυρα Α7 μπλοκάρει κάθε άλλο εισαγωγέα.
 */

import 'server-only';

import type * as pkijs from 'pkijs';

import { createModuleLogger } from '@/lib/telemetry';
import type { EnvironmentSource } from '@/lib/environment/environment-audit';

import { cmsSignatureValue, buildSignedAttributes, encodeSignedData, signatureAlgorithmOf, signedAttributesDigest } from './cades-signed-data';
import { certificateDer, parseCertificate, sha256Hex } from './cms-primitives';
import { cscSealSigner } from './csc-seal-signer.server';
import { embedCms, prepareSealPdf } from './pdf-seal-placeholder';
import type { PdfSealVerifier } from './pdf-seal.types';
import { rfc3161TimestampAuthority } from './rfc3161-timestamp.server';
import { sealConfigurationOf } from './seal-config.server';
import type { SealOutcome, SealPresentation, SealSignatureAlgorithm, SealSigner, TimestampAuthority } from './seal-signer.types';
import { LIVE_SEAL_TRANSPORT, type SealTransport } from './seal-transport.server';
import { verifyPdfSeal } from './verify-pdf-seal';

const logger = createModuleLogger('pdf-seal');

export interface SealDependencies {
  readonly signer: SealSigner;
  readonly timestampAuthority: TimestampAuthority;
  readonly now: () => Date;
  /** Εγχέεται μόνο για να αποδειχθεί ότι ο αυτοέλεγχος **τρέχει** (άγκυρα)· στην παραγωγή πάντα ο ADR-902. */
  readonly verify?: PdfSealVerifier;
}

type Failed = Extract<SealOutcome, { kind: 'failed' }>;
export type AssembleOutcome = { readonly kind: 'assembled'; readonly pdf: Uint8Array; readonly leafSha256: string } | Failed;

const failed = (reason: Failed['reason'], detail: string): Failed => ({ kind: 'failed', reason, detail });

interface SignerMaterial {
  readonly kind: 'material';
  readonly leaf: pkijs.Certificate;
  readonly chain: readonly pkijs.Certificate[];
  readonly algorithm: SealSignatureAlgorithm;
}

async function signerMaterial(signer: SealSigner): Promise<SignerMaterial | Failed> {
  const chainResult = await signer.certificateChain();
  if (chainResult.kind === 'failed') return failed(chainResult.reason, chainResult.detail);
  const parsed = chainResult.value.map(parseCertificate);
  const chain = parsed.filter((certificate): certificate is pkijs.Certificate => certificate !== null);
  const leaf = chain[0];
  if (leaf === undefined || chain.length !== parsed.length) return failed('certificate-unreadable', 'αλυσίδα που δεν διαβάζεται');
  const algorithm = signatureAlgorithmOf(leaf);
  if (algorithm === null) return failed('unsupported-key-algorithm', leaf.subjectPublicKeyInfo.algorithm.algorithmId);
  return { kind: 'material', leaf, chain, algorithm };
}

/** Σύνθεση της σφραγίδας **χωρίς** αυτοέλεγχο. ⚠️ Μόνο για το `sealPdf` και το συνθετικό fixture (Α7). */
export async function assemblePadesSeal(pdf: Uint8Array, presentation: SealPresentation, deps: SealDependencies): Promise<AssembleOutcome> {
  const material = await signerMaterial(deps.signer);
  if (material.kind === 'failed') return material;
  const prepared = await prepareSealPdf(pdf, deps.now(), presentation);
  if (prepared.kind === 'failed') return failed(prepared.reason, prepared.detail);

  const attrs = buildSignedAttributes(prepared.prepared.signedBytes, material.leaf);
  const raw = await deps.signer.signDigest(signedAttributesDigest(attrs), material.algorithm);
  if (raw.kind === 'failed') return failed(raw.reason, raw.detail);
  const signature = cmsSignatureValue(raw.value, material.algorithm, material.leaf);
  if (signature === null) return failed('signer-rejected', 'υπογραφή σε μορφή που δεν αναγνωρίζεται');

  const stamp = await deps.timestampAuthority(signature);
  if (stamp.kind === 'failed') return failed(stamp.reason, stamp.detail);
  const cms = encodeSignedData({ attrs, signature, algorithm: material.algorithm, chain: material.chain, timestampToken: stamp.token });
  const sealed = embedCms(prepared.prepared, cms);
  if (sealed === null) return failed('contents-overflow', `CMS ${cms.length} bytes`);
  return { kind: 'assembled', pdf: sealed, leafSha256: sha256Hex(certificateDer(material.leaf)) };
}

/** Σφράγιση PAdES B-T **με υποχρεωτικό αυτοέλεγχο**. Η μόνη συνάρτηση που επιστρέφει σφραγισμένο PDF. */
export async function sealPdf(pdf: Uint8Array, presentation: SealPresentation, deps: SealDependencies): Promise<SealOutcome> {
  const assembled = await assemblePadesSeal(pdf, presentation, deps);
  if (assembled.kind === 'failed') return assembled;
  const verdict = await (deps.verify ?? verifyPdfSeal)(assembled.pdf);
  if (verdict.kind === 'invalid') return { ...failed('self-check-failed', 'ο ελεγκτής απέρριψε τη σφραγίδα'), verdictReason: verdict.reason };
  if (!verdict.timestamped) return failed('self-check-failed', 'η σφραγίδα δεν βγήκε χρονοσημασμένη (B-T)');
  if (verdict.signer.certificateSha256 !== assembled.leafSha256) return failed('self-check-failed', 'υπογράφων ≠ φύλλο της θύρας');
  return { kind: 'sealed', pdf: assembled.pdf, verdict };
}

export interface SealSession {
  /** `false` ⇒ κάθε `seal` απαντά `awaiting-seal-configuration`, χωρίς δίκτυο. */
  readonly configured: boolean;
  seal(pdf: Uint8Array, presentation: SealPresentation): Promise<SealOutcome>;
  /**
   * ADR-916 Σ4 — **πριν** παραχθεί το έγγραφο: χωρίς ρύθμιση, μετρά ένα έγγραφο που περιμένει (στο **ίδιο** σήμα του
   * `finish`) και επιστρέφει την έκβαση· με ρύθμιση, `null`. Ο καλών **δεν** αποδίδει ένα PDF που δεν θα σφραγιστεί.
   */
  awaitingConfiguration(): Extract<SealOutcome, { readonly kind: 'awaiting-seal-configuration' }> | null;
  /** Τέλος εκτέλεσης: **ένα** σήμα αν κάτι περίμενε ρύθμιση. Επιστρέφει πόσα περίμεναν. */
  finish(): number;
}

/** Μία συνεδρία ανά εκτέλεση (εκτελεστής / δίχτυ): η ρύθμιση ρωτιέται **μία** φορά, το token CSC κρατιέται. */
export function openSealSession(env: EnvironmentSource = LIVE_SEAL_TRANSPORT.env, transport: SealTransport = LIVE_SEAL_TRANSPORT): SealSession {
  const configuration = sealConfigurationOf(env);
  let awaiting = 0;
  const deps: SealDependencies | null =
    configuration.kind === 'configured'
      ? { signer: cscSealSigner(configuration.csc, transport), timestampAuthority: rfc3161TimestampAuthority(configuration.tsa, transport), now: transport.now }
      : null;
  return {
    configured: deps !== null,
    async seal(pdf, presentation) {
      if (deps !== null) return sealPdf(pdf, presentation, deps);
      awaiting += 1;
      return { kind: 'awaiting-seal-configuration', missing: configuration.kind === 'configured' ? [] : configuration.missing };
    },
    awaitingConfiguration() {
      if (configuration.kind === 'configured') return null;
      awaiting += 1;
      return { kind: 'awaiting-seal-configuration', missing: configuration.missing };
    },
    finish() {
      if (awaiting > 0 && configuration.kind !== 'configured') {
        logger.warn('Σφράγιση PDF: λείπει η ρύθμιση παρόχου — κανένα έγγραφο δεν εκδόθηκε', { data: { awaiting, missing: configuration.missing } });
      }
      return awaiting;
    },
  };
}
