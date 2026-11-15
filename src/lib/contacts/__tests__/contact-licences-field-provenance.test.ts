/**
 * ADR-915 §40.5 — η προέλευση της άδειας της επαφής **ανά πεδίο** (εγγραφή · τάξεις), πρακτική HubSpot property history.
 *
 * Το εύρημα (ζωντανή δοκιμή 2026-11-15): ο αριθμός «Δηλωμένο από τον ίδιο» γινόταν «Καταχωρίστηκε από το γραφείο» μόλις
 * το γραφείο άλλαζε **μόνο** την τάξη — μία προέλευση για όλη την άδεια έσβηνε την αλήθεια ενός πεδίου που δεν άγγιξε κανείς.
 */

import { formShowcaseLicences } from '@/lib/agency/showcase-licence';
import { adoptionPatchOf } from '@/lib/contacts/declared-credential-adoption-patch';
import {
  contactLicencesFromDrafts,
  readContactLicences,
  storedLicenceProvenanceShownBy,
} from '@/lib/contacts/contact-licences';
import { NO_LICENCE_DRAFTS, type LicenceDraft, type LicenceDrafts } from '@/lib/professional/licence-drafts';
import type { LicenceGrades } from '@/config/professional-licences';
import type { ContactLicence, ContactLicenceProvenance } from '@/types/contacts/contact-licences';

const NOW = '2026-11-15T10:00:00.000Z';
const EARLIER = '2026-11-14T08:00:00.000Z';
const SELF: ContactLicenceProvenance = { source: 'self-declared', recordedAt: EARLIER, engagementId: 'eng_1' };
const OFFICE_EARLIER: ContactLicenceProvenance = { source: 'office', recordedAt: EARLIER, engagementId: null };
const OFFICE_NOW: ContactLicenceProvenance = { source: 'office', recordedAt: NOW, engagementId: null };

/** Η απόδειξη από τον ΠΡΑΓΜΑΤΙΚΟ σχηματιστή — καμία χειρόγραφη αναπαράσταση του σχήματος. */
const FORMED = formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: '2600' }]);
if ('reason' in FORMED || FORMED.licences[0] === undefined) throw new Error('fixture rejected');
const ATTESTATION = FORMED.licences[0].attestation;

/** Αποθηκευμένη γραμμή όπως στον δίσκο. */
function storedRow(grades: LicenceGrades | null, gradesProvenance?: ContactLicenceProvenance): Record<string, unknown> {
  return {
    licence: 'energy-inspector',
    attestation: ATTESTATION,
    ...(grades === null ? {} : { grades }),
    provenance: SELF,
    ...(gradesProvenance === undefined ? {} : { gradesProvenance }),
  };
}

function stored(grades: LicenceGrades | null, gradesProvenance?: ContactLicenceProvenance): readonly ContactLicence[] {
  return readContactLicences([storedRow(grades, gradesProvenance)]);
}

function inspector(draft: LicenceDraft): LicenceDrafts {
  return { ...NO_LICENCE_DRAFTS, 'energy-inspector': draft };
}

function saved(existing: readonly ContactLicence[], draft: LicenceDraft): ContactLicence {
  const result = contactLicencesFromDrafts(existing, inspector(draft), NOW);
  if ('reason' in result || result.licences[0] === undefined) throw new Error('fixture rejected');
  return result.licences[0];
}

describe('ανάγνωση — η γραμμή πριν από τη διάσπαση', () => {
  it('τάξεις χωρίς δική τους προέλευση ⇒ της εγγραφής (μία πράξη τις είχε γράψει)', () => {
    const [held] = stored({ buildings: 'A' });
    expect(held?.provenance).toEqual(SELF);
    expect(held?.gradesProvenance).toEqual(SELF);
  });

  it('καμία τάξη ⇒ κανένα gradesProvenance (ούτε undefined-κλειδί στον δίσκο)', () => {
    const [held] = stored(null, OFFICE_EARLIER);
    expect(held !== undefined && 'gradesProvenance' in held).toBe(false);
  });

  it('έγκυρη δική τους προέλευση ⇒ κρατιέται', () => {
    const [held] = stored({ buildings: 'A' }, OFFICE_EARLIER);
    expect(held?.gradesProvenance).toEqual(OFFICE_EARLIER);
  });
});

describe('αποθήκευση — κάθε πεδίο κρατά ή ανανεώνει τη ΔΙΚΗ του προέλευση', () => {
  it('ΤΟ ΕΥΡΗΜΑ: αλλαγμένη μόνο η τάξη ⇒ ο αριθμός μένει «δηλωμένο από τον ίδιο», οι τάξεις γίνονται office', () => {
    const next = saved(stored({ buildings: 'A' }, OFFICE_EARLIER), { number: '2600', chapter: '', grades: { buildings: 'B' } });
    expect(next.provenance).toEqual(SELF);
    expect(next.gradesProvenance).toEqual(OFFICE_NOW);
  });

  it('πρώτη συμπλήρωση τάξεων σε δηλωμένο αριθμό ⇒ ο αριθμός μένει self-declared', () => {
    const next = saved(stored(null), { number: '2600', chapter: '', grades: { buildings: 'A' } });
    expect(next.provenance).toEqual(SELF);
    expect(next.gradesProvenance).toEqual(OFFICE_NOW);
  });

  it('αλλαγμένος μόνο ο αριθμός ⇒ οι τάξεις κρατούν τη δική τους προέλευση', () => {
    const next = saved(stored({ buildings: 'A' }, OFFICE_EARLIER), { number: '2700', chapter: '', grades: { buildings: 'A' } });
    expect(next.provenance).toEqual(OFFICE_NOW);
    expect(next.gradesProvenance).toEqual(OFFICE_EARLIER);
  });

  it('τίποτα δεν άλλαξε ⇒ η ΙΔΙΑ αποθηκευμένη γραμμή (καμία ψευδής αλλαγή στο ίχνος)', () => {
    const existing = stored({ buildings: 'A' }, OFFICE_EARLIER);
    expect(saved(existing, { number: ' 2600 ', chapter: '', grades: { buildings: 'A' } })).toBe(existing[0]);
  });

  it('σβησμένες τάξεις ⇒ φεύγει και η προέλευσή τους, ο αριθμός μένει', () => {
    const next = saved(stored({ buildings: 'A' }, OFFICE_EARLIER), { number: '2600', chapter: '', grades: {} });
    expect(next.provenance).toEqual(SELF);
    expect('grades' in next || 'gradesProvenance' in next).toBe(false);
  });
});

describe('φόρμα — η προέλευση ανά πεδίο που δείχνει αυτή τη στιγμή', () => {
  const existing = stored({ buildings: 'A' }, OFFICE_EARLIER);

  it('ίδια εγγραφή, ίδιες τάξεις ⇒ και τα δύο πεδία', () => {
    expect(storedLicenceProvenanceShownBy(existing, 'energy-inspector', { number: '2600', chapter: '', grades: { buildings: 'A' } }))
      .toEqual({ registration: SELF, grades: OFFICE_EARLIER });
  });

  it('αλλαγμένη (αναποθήκευτη) τάξη ⇒ ο αριθμός κρατά την προέλευσή του, οι τάξεις όχι ακόμη', () => {
    expect(storedLicenceProvenanceShownBy(existing, 'energy-inspector', { number: '2600', chapter: '', grades: { buildings: 'B' } }))
      .toEqual({ registration: SELF, grades: null });
  });

  it('ξετσεκαρισμένη ή άγνωστη άδεια ⇒ καμία', () => {
    expect(storedLicenceProvenanceShownBy(existing, 'energy-inspector', null)).toEqual({ registration: null, grades: null });
    expect(storedLicenceProvenanceShownBy(undefined, 'energy-inspector', { number: '2600', chapter: '' }))
      .toEqual({ registration: null, grades: null });
  });
});

describe('υιοθέτηση της δήλωσης — γράφει ΜΟΝΟ την εγγραφή', () => {
  it('οι τάξεις του γραφείου μένουν, με τη δική τους προέλευση', () => {
    const contact = { licences: [{ ...storedRow({ buildings: 'B' }, OFFICE_EARLIER), provenance: OFFICE_EARLIER }] };
    const patch = adoptionPatchOf(
      { kind: 'licence', licence: 'energy-inspector' },
      contact,
      { value: { number: '2601', chapter: null }, engagementId: 'eng_9', nowIso: NOW },
    );
    if (patch.field !== 'licences') throw new Error('expected licences patch');
    expect(patch.licences[0]).toMatchObject({
      grades: { buildings: 'B' },
      gradesProvenance: OFFICE_EARLIER,
      provenance: { source: 'self-declared', recordedAt: NOW, engagementId: 'eng_9' },
    });
  });
});
