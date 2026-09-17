/**
 * @fileoverview **ΤΟ ΠΑΓΩΜΕΝΟ ΑΠΟΔΕΙΚΤΙΚΟ ΤΗΣ ΒΕΒΑΙΩΣΗΣ** — αντίγραφο · αποτύπωμα · hold (ADR-864 §19 · Α31-Α32).
 * @related services/mandate/attestation-document.ts · lib/mandate/mandate-evidence.ts ·
 *   services/mandate/mandate-evidence-access.ts · storage.rules (`mandate-evidence/`)
 * @module services/mandate/attestation-evidence
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΝΤΙΓΡΑΦΟ ΚΑΙ ΟΧΙ ΔΕΙΚΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-09-17: το `proof.documentPath` έδειχνε στο **ζωντανό** αρχείο του γραφείου, και το
 * `storage.rules` επιτρέπει `delete` σε κάθε μέλος της εταιρείας· το `FileRecord.hold` δεν το γράφει κανείς
 * και δεν το επιβάλλει κανένας κανόνας. Δηλαδή το γραφείο μπορούσε να σβήσει την απόδειξη που ο ιδιοκτήτης
 * θα χρειαζόταν για να την αμφισβητήσει. 🌐 Το DocuSign κρατά το ολοκληρωμένο έγγραφο **το ίδιο** — όχι ο αποστολέας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΒΗΜΑΤΑ, ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΑΠΟΚΛΕΙΕΙ ΟΡΦΑΝΑ ΚΛΕΙΔΩΜΕΝΑ ΑΡΧΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Πάγωμα** ({@link freezeAttestationEvidence}) **πριν** τη συναλλαγή: ροή bytes → sha256 → ρίζα `server-only`.
 * 2. **Σφράγιση** (temporary hold) **μόνο μετά** την επιτυχή εγγραφή. Hold πριν την εγγραφή θα άφηνε, σε κάθε
 *    άρνηση, αρχείο που **ούτε ο διακομιστής** μπορεί να σβήσει.
 * 3. **Απόρριψη** του αντιγράφου σε κάθε άλλη έκβαση — η άρνηση δεν αφήνει ίχνος στο bucket.
 * ⚠️ Κατάρρευση ανάμεσα σε 1 και 2 ⇒ αντίγραφο χωρίς hold, αλλά σε ρίζα που **κανένας client** δεν αγγίζει.
 *
 * **Layering**: server-only. Το bucket περνά ως παράμετρος (στενή διεπαφή) για να εκτελείται στα tests.
 */

import 'server-only';

import { pipeline } from 'stream/promises';
import type { Readable, Writable } from 'stream';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { UPLOAD_LIMITS } from '@/config/file-upload-config';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import { attestationEvidencePath, ownerPropertyIdOfEvidencePath } from '@/lib/mandate/mandate-evidence';
import { sha256PassThrough } from '@/lib/storage/sha256-pass-through';
import { createModuleLogger } from '@/lib/telemetry';
import { generateMandateEvidenceId } from '@/services/enterprise-id.service';
import { registerSealedEvidence } from '@/services/mandate/evidence-registry';
import type { AttestationEvidence } from '@/types/owner-property-mandate';

const logger = createModuleLogger('attestation-evidence');

/** Ό,τι χρησιμοποιούμε από ένα αντικείμενο GCS — τίποτε άλλο. */
export interface EvidenceObject {
  createReadStream(): Readable;
  createWriteStream(options: { readonly contentType: string; readonly resumable: false; readonly metadata: { readonly metadata: Record<string, string> } }): Writable;
  setMetadata(metadata: EvidenceMetadataPatch): Promise<unknown>;
  delete(options: { readonly ignoreNotFound: true }): Promise<unknown>;
}

/**
 * 🔑 **Δύο κλειδαριές, διαφορετικής φύσης** (ADR-864 §20): το `temporaryHold` είναι διακόπτης (όσο ζει η σχέση ·
 * δικαστική δέσμευση)· το `retention` σε **Locked** είναι ημερομηνία που η πλατφόρμα **μόνο αυξάνει**.
 * Το GCS επιτρέπει και τα δύο μαζί στο ίδιο αντικείμενο.
 */
export interface EvidenceMetadataPatch {
  readonly temporaryHold?: boolean;
  readonly retention?: { readonly mode: 'Locked'; readonly retainUntilTime: string };
}

export interface EvidenceBucket {
  file(path: string): EvidenceObject;
  /** Σάρωση προθέματος — το δίχτυ της υιοθεσίας (αντικείμενο χωρίς εγγραφή μητρώου). */
  getFiles(query: { readonly prefix: string }): Promise<readonly [readonly { readonly name: string }[], ...unknown[]]>;
}

const adminEvidenceBucket = (): EvidenceBucket => getAdminBucket();

/** Η πηγή — **από το `FileRecord`** μέσω του κριτή, ποτέ από το σύρμα. */
export interface EvidenceSource {
  readonly storagePath: string;
  readonly contentType: string;
  readonly fileName: string;
}

export type FreezeOutcome =
  | { readonly kind: 'frozen'; readonly evidence: AttestationEvidence }
  /** Πάνω από το όριο ανεβάσματος — πρόβλημα του **αρχείου**. */
  | { readonly kind: 'too-large' }
  /** Αποτυχία υποδομής — **δική μας**, ποτέ «φταίει το αρχείο σου». */
  | { readonly kind: 'failed' };

/** Βήμα 1 — αντίγραφο με αποτύπωμα, **χωρίς** hold. */
export async function freezeAttestationEvidence(
  source: EvidenceSource,
  ownerPropertyId: string,
  bucket: EvidenceBucket = adminEvidenceBucket(),
): Promise<FreezeOutcome> {
  const id = generateMandateEvidenceId();
  const path = attestationEvidencePath(ownerPropertyId, id);
  const hash = sha256PassThrough(UPLOAD_LIMITS.MAX_FILE_SIZE);
  const target = bucket.file(path);
  try {
    await pipeline(
      bucket.file(source.storagePath).createReadStream(),
      hash.stream,
      target.createWriteStream({ contentType: source.contentType, resumable: false, metadata: { metadata: { evidenceOf: ownerPropertyId } } }),
    );
  } catch (error) {
    await target.delete({ ignoreNotFound: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    if (hash.bytes() > UPLOAD_LIMITS.MAX_FILE_SIZE) return { kind: 'too-large' };
    logger.error('Το αποδεικτικό δεν παγώθηκε', { data: { ownerPropertyId }, error: message });
    return { kind: 'failed' };
  }
  const evidence: AttestationEvidence = {
    id,
    path,
    digest: `sha256:${hash.digestHex()}`,
    sizeBytes: hash.bytes(),
    contentType: source.contentType,
    fileName: source.fileName,
  };
  return { kind: 'frozen', evidence };
}

/** Τι έγινε με την εγγραφή — και, αν έγινε, **σε ποια σχέση** ανήκει το αποδεικτικό (μητρώο, §20). */
export type EvidenceSettlement =
  | { readonly committed: false }
  | {
      readonly committed: true;
      readonly adminDb: AdminFirestore;
      /** `null` μόνο σε αδύνατο κλάδο· τότε η σάρωση το **αναφέρει** ως αδέσποτο, ποτέ δεν το σβήνει. */
      readonly agencyCompanyId: string | null;
      readonly sealedAt: string;
    };

/**
 * Βήματα 2-3 — **σφράγιση** αν η εγγραφή έγινε, **απόρριψη** αλλιώς. Ποτέ δεν ρίχνει: η εγγραφή έχει ήδη
 * κριθεί, και αποτυχία hold δεν ακυρώνει νόμιμη βεβαίωση (το αντίγραφο μένει σε ρίζα `server-only`).
 *
 * 🔑 Σφράγιση **πρώτα**, μητρώο **μετά**: η αμεταβλητότητα είναι η κύρια υπόσχεση· εγγραφή μητρώου που
 * αποτυγχάνει την υιοθετεί η σάρωση (`evidence-retention.service.ts`), ενώ hold που λείπει δεν το αναπληρώνει κανείς.
 */
export async function settleAttestationEvidence(
  evidence: AttestationEvidence | null,
  settlement: EvidenceSettlement,
  bucket: EvidenceBucket = adminEvidenceBucket(),
): Promise<void> {
  if (evidence === null) return;
  const object = bucket.file(evidence.path);
  try {
    if (settlement.committed) await object.setMetadata({ temporaryHold: true });
    else await object.delete({ ignoreNotFound: true });
  } catch (error) {
    logger.error(settlement.committed ? 'Το αποδεικτικό γράφτηκε αλλά ΔΕΝ σφραγίστηκε (hold)' : 'Το απορριφθέν αποδεικτικό δεν σβήστηκε', {
      data: { evidenceId: evidence.id },
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!settlement.committed || settlement.agencyCompanyId === null) return;
  await registerSealedEvidence(settlement.adminDb, evidence, {
    ownerPropertyId: ownerPropertyIdOfEvidencePath(evidence.path),
    agencyCompanyId: settlement.agencyCompanyId,
    sealedAt: settlement.sealedAt,
  });
}
