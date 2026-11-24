/**
 * @fileoverview **ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ ΤΟΥ ΠΙΝΑΚΑ «ΕΓΓΡΑΦΟ ↔ ΕΠΑΦΗ»** που καμία ζωντανή ανάγνωση δεν παράγει κατά παραγγελία
 * (ADR-950 §8.19).
 *
 * Κάθε περίπτωση είναι μια ανάγνωση **με το σχήμα που γράφει ο διακομιστής** (`ingestion.analysis`: πεδία + τεκμήρια) και
 * μια φόρμα επαφής. Ο πίνακας τις περνά από την **πραγματική** `compareEvidenceWithForm` — καμία γραμμή δεν γράφεται με
 * το χέρι, άρα η σελίδα δείχνει ό,τι θα έδειχνε η παραγωγή για την ίδια ανάγνωση.
 *
 * Γιατί σταθερά δεδομένα και όχι «Νέα ανάγνωση»: η ανάγνωση είναι **AI** (μη ντετερμινιστική) και ο χάρτης **εξωτερικός**·
 * το «ΣΑΜΟΓΡΑΦΗΣ» ή το «ο χάρτης δεν απάντησε» δεν ξανασυμβαίνουν όταν τα ζητήσεις. Πρότυπο Storybook / Chromatic.
 */

import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS, FILE_STATUS } from '@/config/domain-constants';
import type { DocumentClassifyAnalysis, DocumentEvidenceField, EvidenceAddressVerification } from '@/schemas/ai-analysis';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';
import type { FileRecord } from '@/types/file-record';

export const CONTACT_EVIDENCE_CASE_ATTRIBUTE = 'data-evidence-case';

export type ContactEvidenceCaseId = 'corrected-street' | 'map-unavailable' | 'phone-fill';

export interface ContactEvidenceCase {
  readonly id: ContactEvidenceCaseId;
  /** Τι αποδεικνύει η περίπτωση — εμφανίζεται πάνω από τον πίνακα. */
  readonly why: string;
  readonly file: FileRecord;
  readonly formData: ContactFormData;
}

const READ_AT = '2026-11-24T09:13:50.000Z';

/** Η σφραγίδα του ζωντανού ελέγχου 2026-11-24 (`-1.png`), όπως τη διάβασε η AI — με το «ΣΑΜΟΓΡΑΦΗΣ». */
const STAMP_FIELDS: readonly DocumentEvidenceField[] = [
  { field: 'fullName', printed: 'ΠΑΓΩΝΗΣ Ν. ΓΕΩΡΓΙΟΣ', confidence: 0.95 },
  { field: 'taxOffice', printed: 'Δ.Ο.Υ. ΙΩΝΙΑΣ', confidence: 0.95 },
  { field: 'addressStreet', printed: 'ΣΑΜΟΓΡΑΦΗΣ', confidence: 0.95 },
  { field: 'addressNumber', printed: '16', confidence: 0.95 },
  { field: 'addressPostalCode', printed: '56334', confidence: 0.95 },
  { field: 'addressCity', printed: 'ΚΟΡΔΕΛΙΟ', confidence: 0.95 },
  { field: 'phone', printed: '2310.55.95.95', confidence: 0.95 },
];

const CORRECTED: EvidenceAddressVerification = {
  verdict: 'corrected',
  correctedStreet: 'Σαμοθράκης',
  places: ['Κορδελιό', 'Περιφερειακή Ενότητα Θεσσαλονίκης'],
  verifiedAt: READ_AT,
};

const UNAVAILABLE: EvidenceAddressVerification = { verdict: 'unavailable', verifiedAt: READ_AT };

function analysisWith(addressVerification: EvidenceAddressVerification): DocumentClassifyAnalysis {
  return {
    kind: 'document_classify',
    aiModel: 'test-harness-fixture',
    analysisTimestamp: READ_AT,
    confidence: 0.95,
    needsTriage: false,
    extractedEntities: {},
    documentType: 'other',
    fields: STAMP_FIELDS,
    evidencePurpose: 'stamp-signature',
    fieldConsensus: [{ field: 'phone', state: 'agreed', alternate: null }],
    addressVerification,
    phoneLineType: 'FIXED_LINE',
  };
}

function fileWith(id: string, analysis: DocumentClassifyAnalysis): FileRecord {
  return {
    id,
    companyId: 'comp_test_harness',
    entityType: ENTITY_TYPES.CONTACT,
    entityId: 'cont_test_harness',
    domain: FILE_DOMAINS.ADMIN,
    category: FILE_CATEGORIES.DOCUMENTS,
    storagePath: `test-harness/${id}.png`,
    displayName: 'Σφραγίδα & Υπογραφή',
    originalFilename: `${id}.png`,
    ext: 'png',
    contentType: 'image/png',
    sizeBytes: 515_750,
    status: FILE_STATUS.READY,
    createdAt: READ_AT,
    createdBy: 'test-harness',
    ingestion: { state: 'classified', stateChangedAt: READ_AT, analysis },
  };
}

/** Επαφή με όνομα και **χωρίς** τηλέφωνο/ΔΟΥ/έδρα — ό,τι λείπει γίνεται «Λείπει από την επαφή». */
const CONTACT_WITHOUT_PHONE: ContactFormData = { ...initialFormData, firstName: 'Γεώργιος', lastName: 'Παγώνης', phones: [] };

export const CONTACT_EVIDENCE_CASES: readonly ContactEvidenceCase[] = [
  {
    id: 'corrected-street',
    why: 'ADR-950 §8.13 — «ΣΑΜΟΓΡΑΦΗΣ» ⇒ «Μήπως: Σαμοθράκης» με το τυπωμένο από κάτω',
    file: fileWith('file_harness_corrected', analysisWith(CORRECTED)),
    formData: CONTACT_WITHOUT_PHONE,
  },
  {
    id: 'map-unavailable',
    why: 'ADR-950 §8.16 — κανένας χάρτης δεν απάντησε ⇒ «Ο χάρτης δεν απάντησε», ποτέ «δεν επιβεβαιώθηκε»',
    file: fileWith('file_harness_unavailable', analysisWith(UNAVAILABLE)),
    formData: CONTACT_WITHOUT_PHONE,
  },
  {
    id: 'phone-fill',
    why: 'ADR-950 §8.14 — το τηλέφωνο στη «Συμπλήρωση κενών» με την ΙΔΙΑ μορφή με τον πίνακα (231 055 9595 + τυπωμένο)',
    file: fileWith('file_harness_phone', analysisWith(CORRECTED)),
    formData: CONTACT_WITHOUT_PHONE,
  },
];
