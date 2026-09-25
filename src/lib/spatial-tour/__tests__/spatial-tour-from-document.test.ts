/**
 * @jest-environment node
 */

/**
 * ⚓ ADR-884 Φ0.2 — το σύνορο ανάγνωσης της περιήγησης. Φέρουσα ιδιότητα: **καμία προεπιλογή ορατότητας**
 * και **κανένας κόμβος πεταμένος σιωπηλά** — ό,τι δεν διαβάζεται ολόκληρο είναι `null`.
 */

import { Timestamp } from 'firebase-admin/firestore';

import { spatialTourFromDocument, tourCaptureFromDocument } from '../spatial-tour-from-document';
import { CAPTURE_DOC, TOUR_DOC } from './spatial-tour-fixtures';

describe('spatialTourFromDocument', () => {
  it('✅ διαβάζει έγκυρο έγγραφο — η ταυτότητα έρχεται από έξω, ο κάτοχος από το έγγραφο', () => {
    const tour = spatialTourFromDocument({ ...TOUR_DOC, id: 'άλλο' }, 'stour_1');

    expect(tour).toMatchObject({ id: 'stour_1', custody: { companyId: 'comp_1' }, visibility: 'public', revision: 3 });
    expect(tour?.nodes).toHaveLength(2);
  });

  it('✅ διαβάζει Firestore Timestamp στους χρόνους', () => {
    const tour = spatialTourFromDocument({ ...TOUR_DOC, createdAt: Timestamp.fromMillis(0) }, 'stour_1');
    expect(tour?.createdAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it.each([undefined, 'everyone', 'PUBLIC'])('🔴 ΔΕΝ μαντεύει ορατότητα (%s) — αλλιώς on-request θα γινόταν δημόσιο', (visibility) => {
    expect(spatialTourFromDocument({ ...TOUR_DOC, visibility }, 'stour_1')).toBeNull();
  });

  it('🔴 κόμβος που δεν διαβάζεται ⇒ ολόκληρη η περιήγηση null (όχι σιωπηλό πέταγμα, όχι ορφανοί σύνδεσμοι)', () => {
    const nodes = [TOUR_DOC.nodes[0], { ...TOUR_DOC.nodes[1], links: [{ toNodeId: 'tnod_a', via: 'teleport' }] }];
    expect(spatialTourFromDocument({ ...TOUR_DOC, nodes }, 'stour_1')).toBeNull();
  });

  it('🔴 θέση που υπάρχει αλλά δεν διαβάζεται ⇒ null· δηλωμένη απουσία θέσης ⇒ δεκτή', () => {
    const broken = [{ ...TOUR_DOC.nodes[0], position: { x: 1, y: 'δύο', z: 0 } }];
    const absent = [{ ...TOUR_DOC.nodes[0], links: [], position: null }];
    expect(spatialTourFromDocument({ ...TOUR_DOC, nodes: broken }, 'stour_1')).toBeNull();
    expect(spatialTourFromDocument({ ...TOUR_DOC, nodes: absent }, 'stour_1')?.nodes[0].position).toBeNull();
  });

  it.each([
    ['χωρίς κάτοχο', { companyId: undefined }],
    ['δύο κάτοχοι', { userId: 'usr_1' }],
    ['άγνωστη ρίζα', { subject: { kind: 'property', id: 'p' } }],
    ['αρνητική αναθεώρηση', { revision: -1 }],
    ['άγνωστος κύκλος ζωής', { lifecycle: 'live' }],
  ])('🔴 αρνείται έγγραφο με %s', (_label, patch) => {
    expect(spatialTourFromDocument({ ...TOUR_DOC, ...patch }, 'stour_1')).toBeNull();
  });
});

describe('tourCaptureFromDocument', () => {
  it('✅ διαβάζει έγκυρη λήψη', () => {
    expect(tourCaptureFromDocument(CAPTURE_DOC, 'tcap_1')).toMatchObject({ id: 'tcap_1', audience: 'public-listing' });
  });

  it('🔴 λήψη χωρίς αναγνώσιμα δικαιώματα ⇒ null (δεν ξέρουμε αν επιτρέπεται η χρήση)', () => {
    expect(tourCaptureFromDocument({ ...CAPTURE_DOC, rights: { creator: { name: 'Χ' } } }, 'tcap_1')).toBeNull();
  });

  it('✅ διαβάζει υπογράφοντα με απόδειξη ΤΕΕ· 🔴 υπογράφων που δεν διαβάζεται ⇒ null', () => {
    const person = { name: 'Μαρία', discipline: 'αρχιτέκτων', studiedAt: '2026-08-01' };
    const attestation = { state: 'declared', registration: { authority: 'tee', number: '123456' } };
    expect(tourCaptureFromDocument({ ...CAPTURE_DOC, signatory: { person, attestation } }, 'tcap_1')?.signatory)
      .toMatchObject({ attestation: { state: 'declared' } });
    expect(tourCaptureFromDocument({ ...CAPTURE_DOC, signatory: { person } }, 'tcap_1')).not.toBeNull();
    expect(tourCaptureFromDocument({ ...CAPTURE_DOC, signatory: { attestation } }, 'tcap_1')).toBeNull();
  });

  it.each([
    ['άγνωστο κοινό', { audience: 'everyone' }],
    ['άγνωστο ορόσημο', { milestone: 'roof' }],
    ['χωρίς κατεύθυνση', { headingRad: undefined }],
    ['χωρίς ημερομηνία λήψης', { capturedAt: 'χθες' }],
  ])('🔴 αρνείται λήψη με %s', (_label, patch) => {
    expect(tourCaptureFromDocument({ ...CAPTURE_DOC, ...patch }, 'tcap_1')).toBeNull();
  });
});
