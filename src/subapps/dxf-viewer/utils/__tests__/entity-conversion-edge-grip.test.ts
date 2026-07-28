/**
 * ADR-718 §Β (N.18) — η **ενοποιημένη** αναζήτηση «σε ποια ακμή θα έμπαινε νέα κορυφή».
 *
 * ── Γιατί γράφτηκε ──────────────────────────────────────────────────────────────────────────
 * Το `entity-conversion.ts` είχε **δύο ταυτόσημα σώματα** (`findPolylineEdgeForGrip` /
 * `findOverlayEdgeForGrip`, 133 tokens clone κατά jscpd) και **μηδέν tests**. Η ενοποίησή τους
 * σε μία συνάρτηση με παράμετρο `isClosed` έγινε επομένως **χωρίς δίχτυ** — αυτό το αρχείο
 * είναι το δίχτυ, γραμμένο ώστε να πιάνει ακριβώς τις τρεις αποφάσεις που θα μπορούσαν να
 * χαθούν στην ενοποίηση:
 *
 *   1. **Η ακμή κλεισίματος** μετριέται στο overlay (κλειστό πολύγωνο) και **δεν** μετριέται
 *      στην οντότητα-πολυγραμμή. Αυτή είναι η ΜΟΝΗ πραγματική διαφορά των δύο — αν χανόταν,
 *      το overlay θα σταματούσε να δέχεται κορυφή στην τελευταία του πλευρά (σιωπηλά).
 *   2. **Ο φύλακας εγγύτητας κορυφής** (`tolerance × 2`): δεν προσφέρεται νέα κορυφή δίπλα σε
 *      υπάρχουσα — αλλιώς κάθε κλικ κοντά σε γωνία θα γεννούσε εκφυλισμένο τμήμα.
 *   3. **Φιλτράρισμα ΠΡΙΝ την ελαχιστοποίηση**: η πλησιέστερη ακμή που κόβεται από τον φύλακα
 *      **δεν** κερδίζει· κερδίζει η πλησιέστερη από όσες **πέρασαν**. Ένα «βρες την πλησιέστερη
 *      και μετά έλεγξε» θα ήταν εύλογο και **λάθος** — και δεν θα φαινόταν σχεδόν ποτέ.
 *
 * @see ../entity-conversion
 */

import { findOverlayEdgeForGrip, findPolylineEdgeForGrip } from '../entity-conversion';
import type { PolylineEntity } from '../../types/scene';

const TOL = 10; // ⇒ φύλακας κορυφής = 20

const SQUARE: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];

function polyline(vertices: Array<[number, number]>): PolylineEntity {
  return {
    id: 'p1',
    type: 'polyline',
    layerId: 'lyr',
    vertices: vertices.map(([x, y]) => ({ x, y })),
    closed: false,
  } as unknown as PolylineEntity;
}

describe('η ακμή κλεισίματος — η ΜΙΑ διαφορά των δύο καλούντων', () => {
  it('overlay (κλειστό πολύγωνο): η τελευταία→πρώτη ακμή ΜΕΤΡΑΕΙ', () => {
    // Το (5,50) είναι δίπλα στην πλευρά (0,100)→(0,0), δηλαδή στην ακμή κλεισίματος (index 3).
    const hit = findOverlayEdgeForGrip({ x: 5, y: 50 }, SQUARE, TOL);

    expect(hit).not.toBeNull();
    expect(hit!.edgeIndex).toBe(3);
    expect(hit!.insertPoint).toEqual({ x: 0, y: 50 });
    expect(hit!.insertIndex).toBe(4);
  });

  it('πολυγραμμή-οντότητα: η ίδια θέση ΔΕΝ δίνει ακμή — δεν υπάρχει κλείσιμο', () => {
    expect(findPolylineEdgeForGrip({ x: 5, y: 50 }, polyline(SQUARE), TOL)).toBeNull();
  });

  it('…ενώ μια κανονική ακμή βρίσκεται κανονικά και στους δύο', () => {
    const asPolyline = findPolylineEdgeForGrip({ x: 50, y: 5 }, polyline(SQUARE), TOL);
    const asOverlay = findOverlayEdgeForGrip({ x: 50, y: 5 }, SQUARE, TOL);

    expect(asPolyline).toEqual({ edgeIndex: 0, insertPoint: { x: 50, y: 0 }, insertIndex: 1 });
    expect(asOverlay).toEqual(asPolyline);
  });
});

describe('ο φύλακας εγγύτητας κορυφής', () => {
  it('κλικ κοντά σε υπάρχουσα κορυφή ⇒ καμία πρόταση (όχι εκφυλισμένο τμήμα)', () => {
    // (5,2): πάνω στην ακμή 0, αλλά μόλις 5 από την κορυφή (0,0) — κάτω από τον φύλακα (20).
    expect(findOverlayEdgeForGrip({ x: 5, y: 2 }, SQUARE, TOL)).toBeNull();
  });

  it('λίγο πιο μακριά από την κορυφή ⇒ προτείνεται κανονικά', () => {
    expect(findOverlayEdgeForGrip({ x: 25, y: 2 }, SQUARE, TOL)?.edgeIndex).toBe(0);
  });
});

describe('φιλτράρισμα ΠΡΙΝ την ελαχιστοποίηση', () => {
  it('η ΠΛΗΣΙΕΣΤΕΡΗ ακμή που κόβεται από τον φύλακα δεν κερδίζει — κερδίζει η επόμενη έγκυρη', () => {
    // Λωρίδα: ακμή 0 κατά μήκος y=0 (0,0)→(100,0)· ακμή 2 κατά μήκος y=2 (200,2)→(0,2).
    const strip: Array<[number, number]> = [[0, 0], [100, 0], [200, 2], [0, 2]];
    // Το σημείο απέχει 0.5 από την ακμή 0 και 1.5 από την ακμή 2 — αλλά στην ακμή 0 είναι μόλις
    // 5 από την κορυφή (100,0), οπότε ο φύλακας την αποκλείει.
    const hit = findPolylineEdgeForGrip({ x: 95, y: 0.5 }, polyline(strip), TOL);

    expect(hit).not.toBeNull();
    expect(hit!.edgeIndex).toBe(2);
  });
});

describe('εκφυλισμένες είσοδοι', () => {
  it.each([
    ['μία κορυφή', [[0, 0]] as Array<[number, number]>],
    ['καμία κορυφή', [] as Array<[number, number]>],
  ])('%s ⇒ null και στους δύο', (_label, verts) => {
    expect(findOverlayEdgeForGrip({ x: 0, y: 0 }, verts, TOL)).toBeNull();
    expect(findPolylineEdgeForGrip({ x: 0, y: 0 }, polyline(verts), TOL)).toBeNull();
  });
});
