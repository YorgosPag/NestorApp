/**
 * @module services/ownership/ownership-verification.service
 * @description **Η ΥΠΟΒΟΛΗ ΕΠΑΛΗΘΕΥΣΗΣ ΚΑΤΟΧΗΣ** (ADR-900 §3.8) — ο ΕΝΑΣ γραφέας του `ownership_verifications`.
 *
 * Ροή (σχήμα Zillow «Claim ownership», με απόδειξη Κτηματολογίου αντί για ερωτηματολόγιο):
 *
 *   κατοχή αγγελίας (ιδιωτική, ΔΙΚΗ του) → ταυτότητα λογαριασμού (όνομα + ΑΦΜ, `readOwnerIdentity`)
 *   → κριτής αρχείου (`judgePkaFile`) → bytes → σφραγίδα (PAdES) + κείμενο (ΚΑΕΚ, δικαιούχοι)
 *   → **ΜΙΑ συναλλαγή**: κλειδαριές ΚΑΕΚ/ΑΦΜ + κρίση (`judgeOwnershipVerification`) + εγγραφή
 *
 * 🔑 **Η κρίση τρέχει ΜΕΣΑ στη συναλλαγή**, πάνω στις κλειδαριές που διάβασε η ίδια: δύο λογαριασμοί που
 * υποβάλλουν τον ίδιο ΚΑΕΚ ταυτόχρονα δεν μπορούν να βγουν και οι δύο `verified` (ο δεύτερος ξαναπαίζει
 * και βλέπει `kaek-claimed-elsewhere`). Μηδέν αγώνας δρόμου (N.7.2 #2).
 *
 * 🔑 **Ταυτότητα = η ΠΗΓΗ** (`users/{uid}`, ADR-834 §6.2), ποτέ πεδίο της φόρμας: ο ΑΦΜ του λογαριασμού
 * έχει **έναν** γραφέα με mod-11 (`tax-identity.service`). Ένα δεύτερο πεδίο ΑΦΜ εδώ θα ήταν δεύτερη αλήθεια.
 *
 * ⚠️ Ιδεμποτία: ίδια υποβολή ⇒ ίδια κρίση (καθαρός κριτής)· η διαδρομή φέρει `Idempotency-Key` (CHECK 3.92),
 * άρα επανάληψη του πελάτη δεν γεννά δεύτερο `ovr_*`.
 */

import 'server-only';

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { custodyOf, mayAdminister } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { judgePkaFile, type PkaFileRefusal } from '@/lib/ownership/pka-file-verdict';
import { readPkaText } from '@/lib/ownership/pka-text';
import { judgeOwnershipVerification, type OwnershipVerdict } from '@/lib/ownership/verification-verdict';
import { createModuleLogger } from '@/lib/telemetry';
import { composedDisplayName } from '@/auth/utils/profile-names';
import { generateOwnershipVerificationId } from '@/services/enterprise-id.service';
import { readOwnerIdentity } from '@/services/mandate/mandate-owner-identity';
import { protectTaxId, taxIdHmac } from '@/server/ownership/tax-id-protection';
import { downloadPka, sealSummaryOf, type PkaBytesReader } from './ownership-verification-inputs';
import { readClaimLocks, writeClaimLocks } from './ownership-claim-locks';
import { recordVerificationAudit, viewOfVerification } from './ownership-verification-record';
import type { PdfSealVerifier } from '@/server/pdf-seal/pdf-seal.types';
import type { OwnershipVerification, OwnershipVerificationView } from '@/types/ownership-verification';

const logger = createModuleLogger('ownership-verification');

export type SubmitRefusal = 'not-your-property' | 'identity-incomplete' | 'certificate-too-large' | PkaFileRefusal;

export type SubmitOutcome =
  | { readonly kind: 'judged'; readonly view: OwnershipVerificationView }
  | { readonly kind: 'refused'; readonly reason: SubmitRefusal }
  | { readonly kind: 'unavailable' };

export interface SubmitInput {
  readonly uid: string;
  readonly ownerPropertyId: string;
  readonly fileId: string;
}

export interface SubmitDeps {
  readonly verifySeal: PdfSealVerifier;
  readonly readPdfText: (pdf: Buffer) => Promise<string[]>;
  readonly readBytes?: PkaBytesReader;
  readonly nowIso: string;
}

/** Η αγγελία, **μόνο** αν είναι ιδιωτική και δική του — αλλιώς `null`. Το γραφείο δεν επαληθεύει κατοχή. */
async function ownDossierOf(db: AdminFirestore, ownerPropertyId: string, uid: string): Promise<string | null | false> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId).get();
  const property = ownerPropertyFromDocument(snap.data(), ownerPropertyId);
  if (property === null) return false;
  const custody = custodyOf(property);
  if (custody.kind !== 'personal' || !mayAdminister(custody, { uid, companyId: null })) return false;
  return property.dossierId ?? null;
}

interface Evidence {
  readonly fileId: string;
  readonly digest: string;
  readonly kaekCodes: ReadonlyArray<string>;
  readonly beneficiaries: ReadonlyArray<{ readonly name: string; readonly taxIdHmac: string | null }>;
  readonly seal: OwnershipVerification['seal'];
}

function recordOf(
  id: string,
  input: SubmitInput,
  claimant: OwnershipVerification['claimant'],
  evidence: Evidence,
  verdict: OwnershipVerdict,
  nowIso: string,
): OwnershipVerification {
  const verified = verdict.status === 'verified';
  return {
    id,
    uid: input.uid,
    ownerPropertyId: input.ownerPropertyId,
    kaek: verdict.kaek,
    evidence: { fileId: evidence.fileId, digest: evidence.digest },
    seal: evidence.seal,
    claimant,
    status: verdict.status,
    reasons: verdict.reasons,
    createdAt: nowIso,
    decidedAt: verified ? nowIso : null,
    decidedBy: verified ? 'system' : null,
    reviewNote: null,
  };
}

/** Κρίση + κλειδαριές + εγγραφή — ΜΙΑ συναλλαγή. */
async function commitJudgement(
  db: AdminFirestore,
  input: SubmitInput,
  claimant: OwnershipVerification['claimant'],
  evidence: Evidence,
  nowIso: string,
): Promise<OwnershipVerification> {
  const id = generateOwnershipVerificationId();
  const singleKaek = evidence.kaekCodes.length === 1 ? evidence.kaekCodes[0] : null;

  return db.runTransaction(async (tx: Transaction) => {
    const locks = await readClaimLocks(db, tx, singleKaek, claimant.taxId.hmac);
    const verdict = judgeOwnershipVerification({
      seal: evidence.seal,
      kaekCodes: evidence.kaekCodes,
      beneficiaries: evidence.beneficiaries,
      claimant: { legalName: claimant.legalName, taxIdHmac: claimant.taxId.hmac },
      kaekHolderUid: locks.kaekHolderUid,
      taxIdHolderUid: locks.taxIdHolderUid,
      uid: input.uid,
      nowIso,
    });
    const record = recordOf(id, input, claimant, evidence, verdict, nowIso);
    tx.set(db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS).doc(id), record);
    if (record.status === 'verified') writeClaimLocks(db, tx, locks, record, claimant.taxId.last3);
    return record;
  });
}

/** Ταυτότητα λογαριασμού → ό,τι κρατά η επαλήθευση (όνομα + ΑΦΜ προστατευμένος). */
async function claimantOf(db: AdminFirestore, uid: string): Promise<OwnershipVerification['claimant'] | 'incomplete' | 'unavailable'> {
  const reading = await readOwnerIdentity(db, uid);
  if (reading.kind !== 'complete') return reading.kind;
  const { givenName, familyName, vatNumber } = reading.identity;
  return { legalName: composedDisplayName({ givenName, familyName }), taxId: protectTaxId(vatNumber) };
}

/** Η υποβολή. Ποτέ δεν ρίχνει: κάθε αποτυχία γίνεται `unavailable` με log. */
export async function submitOwnershipVerification(
  db: AdminFirestore,
  input: SubmitInput,
  deps: SubmitDeps,
): Promise<SubmitOutcome> {
  try {
    const dossierId = await ownDossierOf(db, input.ownerPropertyId, input.uid);
    if (dossierId === false) return { kind: 'refused', reason: 'not-your-property' };

    const claimant = await claimantOf(db, input.uid);
    if (claimant === 'unavailable') return { kind: 'unavailable' };
    if (claimant === 'incomplete') return { kind: 'refused', reason: 'identity-incomplete' };

    const fileSnap = await db.collection(COLLECTIONS.FILES_PERSONAL).doc(input.fileId).get();
    const fileVerdict = judgePkaFile(input.fileId, fileSnap.exists ? (fileSnap.data() ?? null) : null, { uid: input.uid, dossierId });
    if (fileVerdict.kind === 'refused') return fileVerdict;

    const pka = await downloadPka(fileVerdict.file, deps.readBytes);
    if (pka.kind === 'too-large') return { kind: 'refused', reason: 'certificate-too-large' };

    const [sealVerdict, pages] = await Promise.all([deps.verifySeal(pka.bytes), deps.readPdfText(pka.bytes)]);
    const reading = readPkaText(pages);
    const record = await commitJudgement(db, input, claimant, {
      fileId: input.fileId,
      digest: pka.digest,
      kaekCodes: reading.kaekCodes,
      beneficiaries: reading.beneficiaries.map((b) => ({ name: b.name, taxIdHmac: b.taxId === null ? null : taxIdHmac(b.taxId) })),
      seal: sealSummaryOf(sealVerdict),
    }, deps.nowIso);

    await recordVerificationAudit(record, null);
    return { kind: 'judged', view: viewOfVerification(record) };
  } catch (error) {
    logger.error('Η επαλήθευση κατοχής δεν ολοκληρώθηκε', {
      data: { ownerPropertyId: input.ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }
}
