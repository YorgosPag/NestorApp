/**
 * ADR-916 §7 Α1–Α5 — η κρίση «παραδίδεται αυτό το αρχείο στον αγοραστή;».
 */

import { getEntryPointsForEntity, findCatalogEntryForFile } from '@/config/upload-entry-points';
import type { EntityType } from '@/config/domain-constants';
import {
  handoverCandidateFromDocument,
  handoverDispositionOf,
  isHandoverEligible,
  selectHandoverFiles,
  type HandoverCandidateFile,
} from '../handover-disposition';

function file(overrides: Partial<HandoverCandidateFile> = {}): HandoverCandidateFile {
  return {
    entityType: 'property',
    purpose: 'document',
    domain: 'sales',
    category: 'documents',
    status: 'ready',
    lifecycleState: 'active',
    isDeleted: false,
    ...overrides,
  };
}

describe('handoverDispositionOf', () => {
  it('Α1 — τομέας του γραφείου ⇒ `internal`, ακόμη κι αν η κατηγορία λέει `deliver`', () => {
    expect(handoverDispositionOf(file({ domain: 'accounting', category: 'photos' }))).toBe('internal');
    expect(handoverDispositionOf(file({ domain: 'brokerage', category: 'contracts' }))).toBe('internal');
  });

  it('Α2 — γενικό έγγραφο χωρίς δήλωση ⇒ `review`, ΠΟΤΕ `deliver`', () => {
    expect(handoverDispositionOf(file())).toBe('review');
  });

  it('Α3 — ΠΕΑ (μελέτη ενέργειας) ⇒ `deliver` · φορολογικά ⇒ `internal`', () => {
    expect(handoverDispositionOf(file({ purpose: 'study-energy-cert', domain: 'construction' }))).toBe('deliver');
    expect(handoverDispositionOf(file({ purpose: 'study-efka', domain: 'admin' }))).toBe('internal');
  });

  it('η δήλωση θέσης νικά την ομάδα: ΦΑΥ ⇒ `deliver` ενώ η ομάδα εργοταξίου είναι `internal`', () => {
    expect(handoverDispositionOf(file({ purpose: 'study-say-fay', domain: 'construction' }))).toBe('deliver');
    expect(handoverDispositionOf(file({ purpose: 'study-waste', domain: 'construction' }))).toBe('internal');
  });

  it('το `entryPointId` νικά το `purpose`', () => {
    expect(handoverDispositionOf(file({ entryPointId: 'unit-yde-declaration', purpose: 'generic' }))).toBe('deliver');
  });

  it('εμπιστευτικό ⇒ `review` ακόμη και για φωτογραφία (DLP)', () => {
    expect(handoverDispositionOf(file({ category: 'photos', classification: 'confidential' }))).toBe('review');
  });

  it('συμβόλαιο ⇒ `review` (στοιχεία συμβαλλομένων — ΓΚΠΔ άρθ. 25)', () => {
    expect(handoverDispositionOf(file({ purpose: 'contract', category: 'contracts' }))).toBe('review');
  });

  it('φωτογραφία / κάτοψη / βίντεο / πανόραμα ⇒ `deliver` από την κατηγορία', () => {
    for (const category of ['photos', 'floorplans', 'videos', 'panoramas', 'models', 'drawings'] as const) {
      expect(handoverDispositionOf(file({ purpose: 'photo', category }))).toBe('deliver');
    }
  });
});

describe('Γ35 (Σ4) — το Πρωτόκολλο παράδοσης ταξιδεύει από τον ΔΙΚΟ του δρόμο (κανένας βρόχος)', () => {
  const marker = { protocolId: 'phpr_1', handoverId: 'phov_1', revision: 1 };

  it('σημάδι πρωτοκόλλου ⇒ `internal`, ακόμη και με κατηγορία/μελέτη που θα έλεγε `deliver`', () => {
    const deliverable = file({ purpose: 'study-energy-cert', domain: 'construction' });
    expect(handoverDispositionOf(deliverable)).toBe('deliver');
    expect(handoverDispositionOf({ ...deliverable, handoverProtocolOf: marker })).toBe('internal');
  });

  it('το σημάδι διαβάζεται από το έγγραφο · αλλοιωμένο σημάδι ⇒ `null` (άρα `review`, ποτέ σιωπηλά `deliver`)', () => {
    const stored = { entityType: 'property', domain: 'legal', category: 'contracts', status: 'ready' };
    expect(handoverCandidateFromDocument({ ...stored, handoverProtocolOf: marker })?.handoverProtocolOf).toEqual(marker);
    expect(handoverCandidateFromDocument({ ...stored, handoverProtocolOf: { protocolId: 'phpr_1' } })).toBeNull();
    expect(handoverCandidateFromDocument(stored)?.handoverProtocolOf).toBeUndefined();
  });
});

describe('isHandoverEligible', () => {
  it('Α4 — αντικατεστημένο · πρόχειρο · κάδος · αποτυχημένο ⇒ ανεπίλεκτο', () => {
    expect(isHandoverEligible(file())).toBe(true);
    expect(isHandoverEligible(file({ supersededByFileId: 'file_new' }))).toBe(false);
    expect(isHandoverEligible(file({ cdeState: 'SUPERSEDED' }))).toBe(false);
    expect(isHandoverEligible(file({ cdeState: 'WIP' }))).toBe(false);
    expect(isHandoverEligible(file({ cdeState: 'SHARED' }))).toBe(true);
    expect(isHandoverEligible(file({ isDeleted: true }))).toBe(false);
    expect(isHandoverEligible(file({ lifecycleState: 'trashed' }))).toBe(false);
    expect(isHandoverEligible(file({ status: 'failed' }))).toBe(false);
  });

  it('το ανεπίλεκτο δεν εμφανίζεται σε ΚΑΝΕΝΑ κάδο της επιλογής', () => {
    const selection = selectHandoverFiles([file({ category: 'photos' }), file({ category: 'photos', isDeleted: true })]);
    expect([selection.deliver.length, selection.review.length, selection.internal.length]).toEqual([1, 0, 0]);
  });
});

describe('Α5 — κάθε θέση καταλόγου ακινήτου/αποθήκης/στάθμευσης έχει απόφαση', () => {
  /** Οι ρητά γενικές θέσεις — «άλλο»: κανείς δεν ξέρει τι είναι χωρίς να το δει. */
  const DECLARED_REVIEW = new Set(['unit-contract', 'unit-deed', 'generic-unit-doc']);

  it.each(['property', 'storage', 'parking_spot'] as const)('%s', (entityType: EntityType) => {
    const undecided = getEntryPointsForEntity(entityType)
      .filter((entry) => {
        const disposition = handoverDispositionOf(file({
          entityType, entryPointId: entry.id, purpose: entry.purpose, domain: entry.domain, category: entry.category,
        }));
        return disposition === 'review' && !DECLARED_REVIEW.has(entry.id);
      })
      .map((entry) => entry.id);
    expect(undecided).toEqual([]);
  });

  it('η αναζήτηση βρίσκει θέση και από `purpose` μόνο (το `entryPointId` λείπει στο 100% — ADR-916 §2.3)', () => {
    expect(findCatalogEntryForFile('property', { purpose: 'yde-declaration' })?.id).toBe('unit-yde-declaration');
    expect(findCatalogEntryForFile('property', { purpose: 'document' })).toBeUndefined();
  });
});
