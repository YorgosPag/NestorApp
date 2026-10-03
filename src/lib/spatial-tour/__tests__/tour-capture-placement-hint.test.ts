/**
 * @fileoverview **Η ΠΡΟΤΑΣΗ ΘΕΣΗΣ** (ADR-904 Κ8) — ο ένας αναγνώστης της δήλωσης **και** του εγγράφου.
 *
 * - **Π1** απούσα / `null` / κενή ⇒ «δεν δηλώθηκε» (`null`)·
 * - **Π2** έγκυρη ⇒ κανονικοποιημένη με τον **ίδιο** κανόνα με τον χώρο του σημείου (trim · μοναδικοί τύποι)·
 * - **Π3** άκυρη ⇒ `undefined` — **ποτέ** σιωπηλό πέταγμα (ο καλών απορρίπτει όλη τη δήλωση / το έγγραφο)·
 * - **Π4** ο αναγνώστης εγγράφου λήψης: πρόταση αδιάβαστη ⇒ όλο το έγγραφο `null`· έγκυρη ⇒ ταξιδεύει.
 */

import { tourCaptureFromDocument } from '../spatial-tour-from-document';
import { readCapturePlacementHint, readTourLevelKey } from '../tour-capture-placement-hint';

describe('Π1 — απουσία', () => {
  it.each([undefined, null, {}])('%p ⇒ null', (raw) => {
    expect(readCapturePlacementHint(raw)).toBeNull();
  });
});

describe('Π2 — έγκυρη', () => {
  it('όροφος BIM + ενιαίος χώρος, κανονικοποιημένος', () => {
    expect(readCapturePlacementHint({
      level: { kind: 'floor', floorId: ' flr_1 ' },
      room: { types: ['kitchen', 'kitchen', 'living-room'], label: '  Ανοιχτή κουζίνα ' },
    })).toEqual({ level: { kind: 'floor', floorId: 'flr_1' }, room: { types: ['kitchen', 'living-room'], label: 'Ανοιχτή κουζίνα' } });
  });

  it('μόνο νέος τοπικός όροφος (υπόγειο) · μόνο χώρος χωρίς όνομα', () => {
    expect(readCapturePlacementHint({ level: { kind: 'local', ordinal: -1 } })).toEqual({ level: { kind: 'local', ordinal: -1 } });
    expect(readCapturePlacementHint({ room: { types: ['wc'] } })).toEqual({ room: { types: ['wc'], label: null } });
  });
});

describe('Π3 — άκυρη ⇒ undefined', () => {
  it.each([
    ['όχι αντικείμενο', 'kitchen'],
    ['άγνωστο είδος ορόφου', { level: { kind: 'storey', ordinal: 1 } }],
    ['μη ακέραιη σειρά', { level: { kind: 'local', ordinal: 0.5 } }],
    ['κενό floorId', { level: { kind: 'floor', floorId: ' ' } }],
    ['άγνωστος τύπος χώρου', { room: { types: ['ballroom'] } }],
    ['κανένας τύπος', { room: { types: [] } }],
    ['τέσσερις τύποι', { room: { types: ['kitchen', 'living-room', 'dining-room', 'hallway'] } }],
    ['όνομα > 60', { room: { types: ['office'], label: 'Α'.repeat(61) } }],
    ['χώρος χωρίς πίνακα', { room: { types: 'kitchen' } }],
  ])('%s', (_, raw) => {
    expect(readCapturePlacementHint(raw)).toBeUndefined();
  });

  it('ο αναγνώστης κλειδιού ορόφου είναι ο ΙΔΙΟΣ με του γράφου', () => {
    expect(readTourLevelKey({ kind: 'local', ordinal: 2 })).toEqual({ kind: 'local', ordinal: 2 });
    expect(readTourLevelKey({ kind: 'floor' })).toBeNull();
  });
});

describe('Π4 — το έγγραφο της λήψης', () => {
  const CAPTURE = {
    tourId: 'tour_1', nodeId: null, capturedAt: '2026-10-03T12:00:00.000Z', createdAt: '2026-10-03T12:05:00.000Z', headingRad: 0,
    source: 'phone', provenance: 'as-built', baseCaptureId: null, signatory: null, audience: 'public-listing', milestone: null,
    originalFileId: 'file_1', uploadedBy: 'uid_1',
    rights: {
      creator: { name: 'Α', userId: 'uid_1', url: null }, licensors: [], copyrightNotice: '© Α', webStatementOfRights: null,
      license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } },
    },
    tileset: { state: 'pending', contentHash: 'h', faceSize: null },
  };

  it('χωρίς πρόταση ⇒ κανένα πεδίο· με πρόταση ⇒ ταξιδεύει αυτούσια', () => {
    expect(tourCaptureFromDocument(CAPTURE, 'tcap_1')).not.toHaveProperty('placementHint');
    const hint = { level: { kind: 'local', ordinal: 1 }, room: { types: ['bedroom'], label: null } };
    expect(tourCaptureFromDocument({ ...CAPTURE, placementHint: hint }, 'tcap_1')?.placementHint).toEqual(hint);
  });

  it('πρόταση που ΔΕΝ διαβάζεται ⇒ όλο το έγγραφο null (ποτέ λήψη που έχασε σιωπηλά τι δηλώθηκε)', () => {
    expect(tourCaptureFromDocument(CAPTURE, 'tcap_1')).not.toBeNull();
    expect(tourCaptureFromDocument({ ...CAPTURE, placementHint: { room: { types: ['ballroom'] } } }, 'tcap_1')).toBeNull();
  });
});
