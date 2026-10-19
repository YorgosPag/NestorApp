import 'server-only';

/**
 * @fileoverview **«Τι θα παραδοθεί;»** — οι παραδόσεις ενός ακινήτου και τα αρχεία του, κριμένα (ADR-916 §5.1).
 * @related lib/property-handover/handover-disposition.ts (η ΜΙΑ κρίση) · conveyance-evidence.server (το ΕΝΑ ερώτημα)
 * @module services/property-handover/property-handover-preview.server
 *
 * 🔑 **Τίποτα καινούργιο στο «ποια αρχεία»**: το «θέμα» της πώλησης (ακίνητο + παρακολουθήματα που πωλούνται
 * μαζί, ADR-199 `includedInSale`) το παράγει το `loadConveyanceSubject`, και τα αρχεία τα φέρνει το
 * `queryOwnedTargetFileDocs` — τα **ίδια** που διαβάζει η υπόθεση μεταβίβασης. Εδώ γίνεται μόνο η κρίση.
 *
 * ⚠️ **Μόνο τα αρχεία που ΚΑΤΕΧΕΙ το ακίνητο ή ένα παρακολούθημά του** — όχι τα συνδεδεμένα (`linkedTo`):
 * ένα έγγραφο **επαφής** (π.χ. ταυτότητα αγοραστή) μπορεί να είναι συνδεδεμένο με το ακίνητο. Κτίριο, έργο
 * και συνδεδεμένα έρχονται με δικό τους κανόνα (ADR-916 Ο2).
 */

import type { Firestore as AdminFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  handoverCandidateFromDocument,
  selectHandoverFiles,
} from '@/lib/property-handover/handover-disposition';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { queryOwnedTargetFileDocs, type EvidenceTarget } from '@/services/conveyance/conveyance-evidence.server';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type { ConveyanceCaseSubject } from '@/types/conveyance-case';
import type { PropertyHandoverPreview, PropertyHandoverPreviewFile } from '@/types/property-handover';

import { propertyHandoversQuery } from './property-handover-write.service';

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
function judgeFiles(docs: readonly QueryDocumentSnapshot[]): PropertyHandoverPreview['files'] {
  const unrecognised: PropertyHandoverPreviewFile[] = [];
  const candidates = docs.flatMap((doc) => {
    const candidate = handoverCandidateFromDocument(doc.data());
    if (candidate === null) {
      unrecognised.push(previewFileOf(doc));
      return [];
    }
    return [{ ...candidate, preview: previewFileOf(doc) }];
  });
  const selection = selectHandoverFiles(candidates);
  return {
    deliver: selection.deliver.map((file) => file.preview),
    review: [...selection.review.map((file) => file.preview), ...unrecognised],
    internal: selection.internal.map((file) => file.preview),
  };
}

/** `null` ⇒ το ακίνητο δεν υπάρχει ή δεν ανήκει στον μισθωτή (ο καλών απαντά 404). */
export async function previewPropertyHandover(
  adminDb: AdminFirestore,
  companyId: string,
  propertyId: string,
): Promise<PropertyHandoverPreview | null> {
  const context = await loadConveyanceSubject(adminDb, companyId, propertyId);
  if (!context) return null;

  const [handoverSnap, fileDocs] = await Promise.all([
    propertyHandoversQuery(adminDb, companyId, propertyId).get(),
    queryOwnedTargetFileDocs(adminDb, companyId, handoverTargetsOf(context.subject)),
  ]);
  return {
    handovers: handoverSnap.docs.flatMap((doc) => {
      const handover = propertyHandoverFromDocument(doc.data(), doc.id);
      return handover ? [handover] : [];
    }),
    files: judgeFiles(fileDocs),
  };
}
