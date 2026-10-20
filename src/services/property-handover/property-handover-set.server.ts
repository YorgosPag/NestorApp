import 'server-only';

/**
 * @fileoverview **ΤΟ ΣΥΝΟΛΟ ΠΑΡΑΔΟΣΗΣ** — τα αρχεία ενός ακινήτου και των παρακολουθημάτων του, κριμένα (ADR-916 §5.1 · Φ-Γ1).
 * @related lib/property-handover/handover-disposition.ts (η ΜΙΑ κρίση) · conveyance-evidence.server (το ΕΝΑ ερώτημα) ·
 *          property-handover-preview.server.ts (η όψη του γραφείου) · server/property-handover-delivery (η αντιγραφή)
 * @module services/property-handover/property-handover-set.server
 *
 * 🔴 **Μία σύνθεση, δύο καταναλωτές**: η προεπισκόπηση («τι θα παραδοθεί») και ο εκτελεστής («τι παραδίδω») διαβάζουν
 *    **αυτό** — άρα δεν μπορούν ποτέ να διαφωνήσουν. Δύο γραφές της ίδιας σύνθεσης θα ήταν το σχήμα του ADR-749: το
 *    γραφείο βλέπει «φεύγουν 14», ο αγοραστής παίρνει 12.
 *
 * 🔑 **Τίποτα καινούργιο στο «ποια αρχεία»**: το «θέμα» της πώλησης (ακίνητο + παρακολουθήματα που πωλούνται μαζί,
 * ADR-199 `includedInSale`) το παράγει το `loadConveyanceSubject`, και τα αρχεία τα φέρνει το `queryOwnedTargetFileDocs`
 * — τα **ίδια** που διαβάζει η υπόθεση μεταβίβασης. Εδώ γίνεται μόνο η κρίση.
 *
 * ⚠️ **Μόνο τα αρχεία που ΚΑΤΕΧΕΙ το ακίνητο ή ένα παρακολούθημά του** — όχι τα συνδεδεμένα (`linkedTo`): ένα έγγραφο
 * **επαφής** (π.χ. ταυτότητα αγοραστή) μπορεί να είναι συνδεδεμένο με το ακίνητο. Κτίριο, έργο και συνδεδεμένα έρχονται
 * με δικό τους κανόνα (ADR-916 Ο2).
 */

import type { Firestore as AdminFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  handoverCandidateFromDocument,
  selectHandoverFiles,
  type HandoverCandidateFile,
} from '@/lib/property-handover/handover-disposition';
import { queryOwnedTargetFileDocs, type EvidenceTarget } from '@/services/conveyance/conveyance-evidence.server';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type { ConveyanceCaseSubject } from '@/types/conveyance-case';
import type { PropertyHandoverPreview, PropertyHandoverPreviewFile } from '@/types/property-handover';

/** Ένα αρχείο του συνόλου — το **ίδιο** έγγραφο που διάβασε η κρίση, και η μορφή του για την όψη του γραφείου. */
export interface HandoverSetFile {
  readonly doc: QueryDocumentSnapshot;
  readonly preview: PropertyHandoverPreviewFile;
  /** Τα κλειστά πεδία, όπως τα διάβασε η κρίση — `null` ⇒ αδιάβαστο (πάει πάντα στα `review`). */
  readonly candidate: HandoverCandidateFile | null;
}

/** Παραδοτέο = αναγνωρίστηκε **και** κρίθηκε `deliver` — άρα ο υποψήφιος υπάρχει πάντα. */
export interface DeliverableHandoverFile extends HandoverSetFile {
  readonly candidate: HandoverCandidateFile;
}

export interface HandoverSet {
  /** Το θέμα της πώλησης — ακίνητο + παρακολουθήματα (ο εκτελεστής χρειάζεται τα δεύτερα για τους φακέλους τους, Δ4). */
  readonly subject: ConveyanceCaseSubject;
  readonly deliver: readonly DeliverableHandoverFile[];
  /** Χρειάζεται απόφαση γραφείου — **ούτε** φεύγει αυτόματα **ούτε** χάνεται σιωπηλά (Δ3). */
  readonly review: readonly HandoverSetFile[];
  readonly internal: readonly HandoverSetFile[];
}

/** Οι οντότητες της παράδοσης: το ακίνητο και ό,τι πωλείται μαζί του. */
function handoverTargetsOf(subject: ConveyanceCaseSubject): readonly EvidenceTarget[] {
  return [
    { level: 'property', entityType: ENTITY_TYPES.PROPERTY, entityId: subject.propertyId },
    ...subject.appurtenances.map((a): EvidenceTarget => ({ level: 'appurtenance', entityType: a.entityType, entityId: a.entityId })),
  ];
}

function previewFileOf(doc: QueryDocumentSnapshot): PropertyHandoverPreviewFile {
  const displayName: unknown = doc.get('displayName');
  const entityType: unknown = doc.get('entityType');
  const entityId: unknown = doc.get('entityId');
  return {
    fileId: doc.id,
    displayName: typeof displayName === 'string' && displayName !== '' ? displayName : doc.id,
    entityType: typeof entityType === 'string' ? entityType : '',
    entityId: typeof entityId === 'string' ? entityId : '',
  };
}

/** Τα αρχεία, μοιρασμένα κατά απόφαση. Ό,τι **δεν** αναγνωρίζεται πάει στα `review` — ποτέ σιωπηλά πουθενά. */
function judgeFiles(docs: readonly QueryDocumentSnapshot[]): Omit<HandoverSet, 'subject'> {
  const unrecognised: HandoverSetFile[] = [];
  const candidates = docs.flatMap((doc) => {
    const candidate = handoverCandidateFromDocument(doc.data());
    if (candidate === null) {
      unrecognised.push({ doc, preview: previewFileOf(doc), candidate: null });
      return [];
    }
    const file: DeliverableHandoverFile = { doc, preview: previewFileOf(doc), candidate };
    return [{ ...candidate, file }];
  });
  const selection = selectHandoverFiles(candidates);
  return {
    deliver: selection.deliver.map(({ file }) => file),
    review: [...selection.review.map(({ file }) => file), ...unrecognised],
    internal: selection.internal.map(({ file }) => file),
  };
}

/** **Το σύνολο παράδοσης** ενός ακινήτου. `null` ⇒ το ακίνητο δεν υπάρχει ή δεν ανήκει στον μισθωτή. */
export async function loadHandoverSet(adminDb: AdminFirestore, companyId: string, propertyId: string): Promise<HandoverSet | null> {
  const context = await loadConveyanceSubject(adminDb, companyId, propertyId);
  if (!context) return null;
  const fileDocs = await queryOwnedTargetFileDocs(adminDb, companyId, handoverTargetsOf(context.subject));
  return { subject: context.subject, ...judgeFiles(fileDocs) };
}

/** Η όψη του γραφείου πάνω στο **ίδιο** σύνολο. */
export function handoverSetPreviewFiles(set: HandoverSet): PropertyHandoverPreview['files'] {
  const previews = (files: readonly HandoverSetFile[]) => files.map(({ preview }) => preview);
  return { deliver: previews(set.deliver), review: previews(set.review), internal: previews(set.internal) };
}
