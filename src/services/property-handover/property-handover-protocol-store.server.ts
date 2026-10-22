import 'server-only';

/**
 * @fileoverview **ΤΑ BYTES ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — αντίτυπο εταιρείας (γράφεται **μία** φορά) → αντίτυπο αγοραστή (rewrite με
 *               απόδειξη) (ADR-916 Φ-Γ2 Σ4).
 * @related property-handover-protocol-write.service.ts (η ορχήστρα + η συναλλαγή) · server/storage (οι μηχανισμοί)
 * @module services/property-handover/property-handover-protocol-store.server
 *
 * 🔴 **Η σειρά είναι το συμβόλαιο** (ίδια με την αντιγραφή αρχείων, Φ-Γ1): **ποτέ εγγραφή χωρίς bytes**. Τα bytes γράφονται
 *    **πριν** από τη συναλλαγή· η συναλλαγή γεννά εγγραφές μόνο για bytes που υπάρχουν και αποδείχτηκαν.
 * 🔑 **«Μόνο δημιουργία» + υιοθέτηση** (το πρότυπο του Stripe `Idempotency-Key`, χωρίς πίνακα κλειδιών): το κλειδί είναι
 *    ντετερμινιστικό από το πρωτόκολλο. Αν υπάρχει ήδη (προηγούμενη εκτέλεση έπεσε μετά το ανέβασμα, πριν το commit), το
 *    **υιοθετούμε** — **μόνο** αν είναι γνήσια σφραγισμένο **και** το manifest του λέει **αυτό** το πρωτόκολλο (ίδιο
 *    αποτύπωμα · αναθεώρηση · αντικατάσταση). Οτιδήποτε άλλο ⇒ άρνηση· **ποτέ** επανεγγραφή.
 */

import type { File } from '@google-cloud/storage';
import { createHash } from 'node:crypto';

import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import type { FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { placementForNewFile } from '@/lib/files/new-file-placement';
import { handoverProtocolFileIdOf } from '@/lib/property-handover/property-handover-id';
import { verifyPdfSeal } from '@/server/pdf-seal/verify-pdf-seal';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { createObjectOnce, readObjectBytes } from '@/server/storage/create-object-once.server';
import { copyProvenPairs } from '@/server/storage/placement-copy';
import { buildPendingFileRecordData } from '@/services/file-record';
import { readHandoverProtocolManifest } from '@/services/pdf/renderers/handover-protocol/handover-protocol-manifest';
import type { HandoverProtocolView } from '@/services/pdf/renderers/handover-protocol/handover-protocol-view';
import { HANDOVER_PROTOCOL_WORDING } from '@/services/pdf/renderers/handover-protocol/handover-protocol-wording';
import type { PropertyHandover } from '@/types/property-handover';

/** Ο δρών στο ιστορικό — ονομασμένος αυτοματισμός: κανείς άνθρωπος δεν ανέβασε ούτε υπέγραψε το Πρωτόκολλο. */
export const HANDOVER_PROTOCOL_ACTOR = 'system:property-handover-protocol';

const PDF = 'application/pdf';

/** Το σφραγισμένο PDF και η όψη **που περιγράφει** — μετά από υιοθέτηση, η όψη έχει τον χρόνο έκδοσης του υιοθετημένου. */
export interface SealedHandoverProtocol {
  readonly pdf: Uint8Array;
  readonly sha256: string;
  readonly view: HandoverProtocolView;
}

/** Ένα αντίτυπο, με τα bytes του **αποδεδειγμένα** στη θέση του. */
export interface StoredProtocolCopy {
  readonly built: ReturnType<typeof buildPendingFileRecordData>;
  readonly placement: FileStoragePlacement;
  readonly sizeBytes: number;
}

export interface StoredHandoverProtocol {
  readonly sealed: SealedHandoverProtocol;
  readonly company: StoredProtocolCopy;
  readonly recipient: StoredProtocolCopy;
}

export type HandoverProtocolStoreOutcome =
  | { readonly kind: 'stored'; readonly stored: StoredHandoverProtocol }
  | { readonly kind: 'failed'; readonly reason: 'foreign-object' | 'copy-unproven'; readonly detail: string };

/** Ό,τι **ταυτίζει** ένα αντίτυπο με το πρωτόκολλο — το ίδιο και στα δύο (τίτλος του παγωμένου κειμένου + αναθεώρηση). */
function describedAs(view: HandoverProtocolView, handoverId: string) {
  return {
    domain: FILE_DOMAINS.LEGAL,
    // 🔑 `contracts` για την **πολιτική διατήρησης** (αρχειοθέτηση 15 έτη) — ένα αποδεικτικό πρέπει να ζει πέρα από την
    //    πενταετία του ΑΚ 554· **όχι** ισχυρισμός ότι είναι σύμβαση (η ρήτρα `noWaiver` λέει ρητά ότι κανείς δεν υπογράφει).
    category: FILE_CATEGORIES.CONTRACTS,
    customTitle: view.legalText.text.title,
    descriptors: [HANDOVER_PROTOCOL_WORDING.el.revision(view.revision)],
    entityLabel: view.propertyLabel ?? undefined,
    originalFilename: `${view.protocolId}.pdf`,
    contentType: PDF,
    ext: 'pdf',
    createdBy: HANDOVER_PROTOCOL_ACTOR,
    uploaderName: view.issuerName,
    handoverProtocolOf: { protocolId: view.protocolId, handoverId, revision: view.revision },
  };
}

function companyRecordOf(handover: PropertyHandover, view: HandoverProtocolView) {
  return buildPendingFileRecordData({
    ...describedAs(view, handover.id),
    companyId: handover.companyId, entityType: ENTITY_TYPES.PROPERTY, entityId: handover.propertyId,
    storagePlacement: placementForNewFile({ kind: 'handover-protocol' }),
    fileId: handoverProtocolFileIdOf(view.protocolId, 'company'),
  });
}

const sha256Of = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

interface AdoptableManifest {
  readonly protocol?: { readonly id?: unknown; readonly revision?: unknown; readonly issuedAt?: unknown; readonly supersedes?: { readonly id?: unknown } | null };
  readonly delivery?: { readonly digest?: unknown };
}

/** Περιγράφει το manifest **αυτό** το πρωτόκολλο; — ταυτότητα · αναθεώρηση · αντικατάσταση · αποτύπωμα. */
function describesProtocol(manifest: AdoptableManifest, view: HandoverProtocolView): manifest is AdoptableManifest & { readonly protocol: { readonly issuedAt: string } } {
  const { protocol, delivery } = manifest;
  return protocol?.id === view.protocolId && protocol.revision === view.revision && typeof protocol.issuedAt === 'string'
    && (protocol.supersedes?.id ?? null) === (view.supersedes?.protocolId ?? null) && delivery?.digest === view.ledgerDigest;
}

/** **Υιοθέτηση** υπάρχοντος αντικειμένου — μόνο γνήσια σφραγισμένο, που περιγράφει **αυτό** το πρωτόκολλο. */
async function adopt(file: File, view: HandoverProtocolView): Promise<SealedHandoverProtocol | null> {
  const pdf = await readObjectBytes(file);
  if ((await verifyPdfSeal(pdf)).kind !== 'valid') return null;
  const text = await readHandoverProtocolManifest(pdf);
  const manifest: unknown = text === null ? null : JSON.parse(text);
  if (typeof manifest !== 'object' || manifest === null || !describesProtocol(manifest, view)) return null;
  return { pdf, sha256: sha256Of(pdf), view: { ...view, issuedAt: manifest.protocol.issuedAt } };
}

/** Το αντίτυπο του αγοραστή — rewrite του αντιτύπου της εταιρείας στο κλειδί του, με απόδειξη crc32c + μέγεθος. */
async function storeRecipientCopy(
  handover: PropertyHandover & { readonly recipient: NonNullable<PropertyHandover['recipient']> },
  company: StoredProtocolCopy & { readonly file: File },
  sealed: SealedHandoverProtocol,
): Promise<StoredProtocolCopy | null> {
  const placement = placementForNewFile({ kind: 'handover-copy', sourcePlacement: company.placement });
  const built = buildPendingFileRecordData({
    ...describedAs(sealed.view, handover.id),
    userId: handover.recipient.userId, entityType: ENTITY_TYPES.PROPERTY_DOSSIER, entityId: handover.recipient.dossierId,
    storagePlacement: placement,
    fileId: handoverProtocolFileIdOf(sealed.view.protocolId, 'recipient'),
    handoverOrigin: {
      handoverId: handover.id, sourceFileId: company.built.fileId, issuerCompanyId: handover.companyId,
      crc32c: String(company.file.metadata.crc32c), size: company.sizeBytes, revisionOfFileId: handover.protocol?.recipientFileId ?? null,
    },
  });
  const proven = await copyProvenPairs([{ source: company.file, destinationName: built.storagePath }], fileStorageBucket(placement));
  return proven.has(built.storagePath) ? { built, placement, sizeBytes: company.sizeBytes } : null;
}

/**
 * **Αποθηκεύει τα δύο αντίτυπα** — εταιρεία (μία φορά, ή υιοθέτηση) → αγοραστής (rewrite + απόδειξη). Καμία εγγραφή Firestore
 * εδώ: αυτές τις γεννά η συναλλαγή της ορχήστρας, **μόνο** για όσα επιστρέφονται.
 */
export async function storeHandoverProtocol(
  handover: PropertyHandover & { readonly recipient: NonNullable<PropertyHandover['recipient']> },
  produced: SealedHandoverProtocol,
): Promise<HandoverProtocolStoreOutcome> {
  const built = companyRecordOf(handover, produced.view);
  const placement = placementForNewFile({ kind: 'handover-protocol' });
  const written = await createObjectOnce(fileStorageBucket(placement), built.storagePath, produced.pdf, PDF);
  const sealed = written.kind === 'created' ? produced : await adopt(written.file, produced.view);
  if (sealed === null) return { kind: 'failed', reason: 'foreign-object', detail: built.storagePath };
  const company = { built, placement, sizeBytes: Number(written.file.metadata.size), file: written.file };
  const recipient = await storeRecipientCopy(handover, company, sealed);
  if (recipient === null) return { kind: 'failed', reason: 'copy-unproven', detail: built.fileId };
  return { kind: 'stored', stored: { sealed, company, recipient } };
}
