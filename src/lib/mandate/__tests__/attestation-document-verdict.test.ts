/**
 * @fileoverview **ΑΓΚΥΡΕΣ ΤΟΥ ΚΡΙΤΗ ΒΕΒΑΙΩΣΗΣ** — ADR-864 §18.4 Δ1 · ADR-742 §7terdecies.
 * @related lib/mandate/attestation-document-verdict.ts · services/mandate/attestation-document.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ομάδα | Ερώτημα |
 * |---|---|
 * | **Π** | Ο **παρονομαστής**: το σωστό έντυπο **γίνεται δεκτό** — χωρίς αυτό κάθε άρνηση μπορεί να είναι ψεύτικη |
 * | **Ε** | Κάθε λόγος άρνησης είναι **προσιτός** και αλλάζει **ΕΝΑ** πεδίο του παρονομαστή |
 * | **Ο** | Τα ονόματα που παγώνουν (ADR-864 §19) έρχονται από το `FileRecord`, με ρητές εφεδρείες |
 * | **ADR-742** | Η ιδιοκτησία: ζεύγος κενό/κενό, έντυπο χωρίς μισθωτή, θετικός μάρτυρας |
 *
 * 🔴 **Κρίνει ΝΟΜΙΚΟ έγγραφο και ως τις 2026-09-21 δεν το έτρεχε ΚΑΜΙΑ σουίτα.** Εκείνη τη
 * μέρα ο anchor πληρότητας (`ownership-callsite-coverage-anchor`) το βρήκε ως σημείο κλήσης
 * του `isPayloadOwnedByCompany` χωρίς απόδειξη: σκέτο `===` στη θέση του SSoT θα άφηνε
 * γραφείο με χαλασμένο token (`companyId: ''`) να βεβαιώσει με έντυπο **χωρίς ιδιοκτήτη**.
 */

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import {
  judgeAttestationDocument,
  type AttestationDocumentVerdict,
} from '@/lib/mandate/attestation-document-verdict';
import {
  describeOwnershipCallSites,
  PURE_VERDICT_PROBE,
  withOwner,
  type OwnerFixture,
} from '@/lib/auth/__tests__/_harness/ownership-callsite-contract';

const COMPANY = 'comp_pagonis';
const OWNER_PROPERTY = 'oprop_001';
const STORAGE_PATH = 'companies/comp_pagonis/files/file_001/entypo-anathesis.pdf';

type Facts = NonNullable<Parameters<typeof judgeAttestationDocument>[0]>;

/** Το έντυπο, **σωστό σε όλα** — κάθε άρνηση αλλάζει ΕΝΑ πεδίο αυτού. */
function facts(overrides: Partial<Facts> = {}): Facts {
  return {
    companyId: COMPANY,
    entityType: ENTITY_TYPES.OWNER_PROPERTY,
    entityId: OWNER_PROPERTY,
    status: FILE_STATUS.READY,
    isDeleted: false,
    storagePath: STORAGE_PATH,
    contentType: 'application/pdf',
    displayName: 'Έντυπο ανάθεσης.pdf',
    ...overrides,
  };
}

function judge(input: Facts | null, companyId = COMPANY): AttestationDocumentVerdict {
  return judgeAttestationDocument(input, { companyId, ownerPropertyId: OWNER_PROPERTY });
}

const INVALID: AttestationDocumentVerdict = { kind: 'refused', reason: 'consent-document-invalid' };

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Π — το σωστό έντυπο γίνεται δεκτό', () => {
  it('Π1 — δικό μας, για αυτή την αγγελία, έτοιμο ⇒ `attached` με τα στοιχεία του FileRecord', () => {
    expect(judge(facts())).toEqual({
      kind: 'attached',
      storagePath: STORAGE_PATH,
      contentType: 'application/pdf',
      fileName: 'Έντυπο ανάθεσης.pdf',
    });
  });
});

// =============================================================================
// Ε — ΚΑΘΕ ΛΟΓΟΣ ΑΡΝΗΣΗΣ, ΕΝΑ ΠΕΔΙΟ ΤΗ ΦΟΡΑ
// =============================================================================

describe('Ε — κάθε λόγος άρνησης είναι προσιτός', () => {
  it('🔒 Ε1 — ανύπαρκτο έγγραφο ⇒ `invalid`, ίδιο με ξένο (όχι μαντείο ύπαρξης)', () => {
    expect(judge(null)).toEqual(INVALID);
  });

  it('🔒 Ε2 — έντυπο ΑΛΛΗΣ εταιρείας ⇒ `invalid`, ίδιο με ανύπαρκτο', () => {
    expect(judge(facts({ companyId: 'comp_allo' }))).toEqual(judge(null));
  });

  it.each([
    ['άλλος τύπος οντότητας', { entityType: 'project' }],
    ['άλλη αγγελία ιδιοκτήτη', { entityId: 'oprop_allo' }],
    ['αρχείο που δεν έχει ολοκληρωθεί', { status: 'pending' }],
    ['διαγραμμένο αρχείο', { isDeleted: true }],
    ['χωρίς διαδρομή αποθήκευσης', { storagePath: undefined }],
    ['κενή διαδρομή αποθήκευσης', { storagePath: '   ' }],
  ])('Ε3 — %s ⇒ `invalid`', (_label, overrides) => {
    expect(judge(facts(overrides))).toEqual(INVALID);
  });
});

// =============================================================================
// Ο — ΤΑ ΟΝΟΜΑΤΑ ΠΟΥ ΠΑΓΩΝΟΥΝ (ADR-864 §19)
// =============================================================================

describe('Ο — τύπος και όνομα από το FileRecord, ποτέ από το σύρμα', () => {
  it('Ο1 — χωρίς `contentType` ⇒ `application/octet-stream`', () => {
    expect(judge(facts({ contentType: '' }))).toMatchObject({ contentType: 'application/octet-stream' });
  });

  it('Ο2 — χωρίς `displayName` ⇒ το τελευταίο τμήμα της διαδρομής', () => {
    expect(judge(facts({ displayName: '  ' }))).toMatchObject({ fileName: 'entypo-anathesis.pdf' });
  });

  it('Ο3 — το `displayName` περνά περικομμένο', () => {
    expect(judge(facts({ displayName: '  Έντυπο.pdf  ' }))).toMatchObject({ fileName: 'Έντυπο.pdf' });
  });
});

// =============================================================================
// 🔴 ADR-742 §7terdecies — «ανήκει το έντυπο στο γραφείο;» με ζεύγος κενό/κενό
// =============================================================================
// Το Ε2 δίνει **υπαρκτή** ξένη εταιρεία: μένει πράσινο και με σκέτο `===` στη θέση του SSoT.
// Η μόνη είσοδος που τους διακρίνει είναι γραφείο **και** έντυπο χωρίς `companyId`.

/** Ο ιδιοκτήτης του εντύπου, όπως τον στήνει το `arrange` του harness. */
let documentOwner: OwnerFixture = { kind: 'named', companyId: COMPANY };

describeOwnershipCallSites('judgeAttestationDocument — ιδιοκτησία εντύπου (ADR-742)', [
  {
    file: 'lib/mandate/attestation-document-verdict.ts',
    name: 'judgeAttestationDocument',
    arrange: owner => {
      documentOwner = owner;
      return PURE_VERDICT_PROBE;
    },
    act: async callerCompanyId => judge(withOwner(facts(), documentOwner) as Facts, callerCompanyId),
    refused: result => (result as AttestationDocumentVerdict).kind === 'refused',
  },
]);
