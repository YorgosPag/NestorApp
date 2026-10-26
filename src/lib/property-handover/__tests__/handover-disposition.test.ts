/**
 * ADR-916 §7 Α1–Α5 — η κρίση «παραδίδεται αυτό το αρχείο στον αγοραστή;».
 */

import { getEntryPointsForEntity, findCatalogEntryForFile } from '@/config/upload-entry-points';
import { STUDY_ENTRIES } from '@/config/upload-entry-points/entries-studies';
import type { EntityType } from '@/config/domain-constants';
import {
  handoverCandidateFromDocument,
  handoverDispositionBasisOf,
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

/**
 * Γ41 — ADR-916 Φ-Γ3 (Ο2): **κοινά** αρχεία κτιρίου/έργου φεύγουν ΜΟΝΟ με ρητή δήλωση `sharedHandover`. Ο χρυσός πίνακας
 * είναι **η πολιτική** (εγκεκριμένη από τον Giorgio 2026-10-25, ΗΤΚ · ΦΑΥ · O&M): κάθε αλλαγή του ζητά ανθρώπινη απόφαση.
 */
describe('Γ41 — κοινά αρχεία κτιρίου/έργου: φεύγουν μόνο ρητά δηλωμένα', () => {
  const SHARED_DELIVER = [
    'building-common-areas-photo', 'building-permit', 'exterior-photo',
    'study-admin-ownership-shares', 'study-admin-regulation',
    'study-arch-3d', 'study-arch-coverage', 'study-arch-detail', 'study-arch-elevation', 'study-arch-floorplan', 'study-arch-section',
    'study-energy-certificate', 'study-energy-insulation', 'study-energy-mea',
    'study-mep-drainage', 'study-mep-electrical', 'study-mep-general', 'study-mep-heating', 'study-mep-hvac', 'study-mep-overview',
    'study-mep-telecom', 'study-mep-water',
    'study-site-fire-safety', 'study-site-say-fay',
    'study-struct-analysis', 'study-struct-bearing', 'study-struct-formwork', 'study-struct-foundation', 'study-struct-reinforcement',
  ];
  const SHARED_REVIEW = ['study-arch-other', 'study-energy-other', 'study-mep-other', 'study-struct-other'];

  /** Κάθε θέση που ένα αρχείο κτιρίου/έργου μπορεί να έχει — με `entryPointId` **και** μόνο με `purpose` (ADR-916 §2.3). */
  function sharedVerdicts(byId: boolean): Map<string, string> {
    const verdicts = new Map<string, string>();
    for (const entityType of ['building', 'project'] as const) {
      for (const entry of [...getEntryPointsForEntity(entityType), ...STUDY_ENTRIES]) {
        const candidate = file({ entityType, purpose: entry.purpose, domain: entry.domain, category: entry.category, ...(byId ? { entryPointId: entry.id } : {}) });
        const { disposition, basis } = handoverDispositionBasisOf(candidate);
        verdicts.set(`${entityType}:${entry.id}`, `${disposition}/${basis}`);
      }
    }
    return verdicts;
  }

  it.each([true, false])('ο χρυσός πίνακας — με entryPointId: %s', (byId) => {
    const verdicts = [...sharedVerdicts(byId).entries()];
    const ids = (wanted: string) => [...new Set(verdicts.filter(([, v]) => v.startsWith(wanted)).map(([key]) => key.split(':')[1]))].sort();
    expect(ids('deliver/')).toEqual(SHARED_DELIVER);
    expect(ids('review/')).toEqual(SHARED_REVIEW);
    // ό,τι δεν δηλώθηκε μένει στο γραφείο, ΜΕ τον λόγο του (ορατό στην καρτέλα) — ή είναι τομέας του γραφείου
    expect(verdicts.filter(([, v]) => v.startsWith('internal/')).every(([, v]) => v === 'internal/shared-undeclared' || v === 'internal/office-domain')).toBe(true);
  });

  it('🔴 ο τίτλος ιδιοκτησίας: της ΜΟΝΑΔΑΣ παραδίδεται, του ΕΡΓΟΥ (οικόπεδο · οικοπεδούχοι) ΜΕΝΕΙ στο γραφείο', () => {
    const deed = { purpose: 'study-title-deed', domain: 'admin' as const, category: 'documents' as const };
    expect(handoverDispositionOf(file({ ...deed, entityType: 'property' }))).toBe('deliver');
    expect(handoverDispositionBasisOf(file({ ...deed, entityType: 'project' }))).toEqual({ disposition: 'internal', basis: 'shared-undeclared' });
  });

  it('η κατηγορία ΔΕΝ αποφασίζει για τα κοινά: φωτογραφία προόδου εργοταξίου ⇒ στο γραφείο', () => {
    expect(handoverDispositionBasisOf(file({ entityType: 'project', purpose: 'construction', domain: 'construction', category: 'photos' })))
      .toEqual({ disposition: 'internal', basis: 'shared-undeclared' });
  });

  it('η απόφαση γραφείου και το εμπιστευτικό ισχύουν ΚΑΙ στα κοινά (ίδια σειρά κανόνων)', () => {
    const decided = { disposition: 'deliver' as const, reason: 'Το ζήτησε ο διαχειριστής', decidedBy: 'u', decidedAt: '2026-10-25T09:00:00.000Z' };
    const progress = { entityType: 'project' as const, purpose: 'construction', domain: 'construction' as const, category: 'photos' as const };
    expect(handoverDispositionBasisOf(file({ ...progress, handoverDecision: decided }))).toEqual({ disposition: 'deliver', basis: 'office-decision' });
    expect(handoverDispositionBasisOf(file({ entityType: 'building', purpose: 'study-say-fay', domain: 'construction', classification: 'confidential' })))
      .toEqual({ disposition: 'review', basis: 'confidential' });
  });
});
