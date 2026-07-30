/**
 * ADR-736 — `IMAGE` → `ImageEntity`.
 *
 * Το επίμαχο σημείο: **ένα DXF `IMAGE` δεν έχει πλάτος ούτε γωνία**. Έχει δύο διανύσματα pixel
 * (11/21 και 12/22) και ένα μέγεθος σε pixels (13/23)· πλάτος, ύψος και περιστροφή **παράγονται**.
 * Όποιος ψάξει για «group 50» δεν θα βρει τίποτα και θα συμπεράνει ότι οι εικόνες δεν
 * περιστρέφονται — γι' αυτό η περιστροφή είναι κλειδωμένη εδώ με ρητό test.
 */

import { convertImage } from '../dxf-image-converter';
import type { ImageEntity } from '../../types/image';

/** IMAGE 400×300 px, ένα pixel = 0,5 μονάδες, χωρίς περιστροφή. */
function axisAlignedImage(): Record<string, string> {
  return {
    '10': '1000', '20': '2000',   // κάτω-αριστερή γωνία
    '11': '0.5', '21': '0',       // u-vector: ένα pixel κατά U
    '12': '0', '22': '0.5',       // v-vector: ένα pixel κατά V
    '13': '400', '23': '300',     // μέγεθος σε pixels
    '340': '94E9',                // → IMAGEDEF handle
  };
}

const asImage = (e: unknown): ImageEntity => e as ImageEntity;

describe('convertImage — γεωμετρία από τα διανύσματα pixel', () => {
  it('πλάτος/ύψος = |διάνυσμα| × pixels (ΟΧΙ τα pixels σκέτα)', () => {
    const img = asImage(convertImage(axisAlignedImage(), 'ΥΠΟΜΝΗΜΑ', 3));
    expect(img.width).toBeCloseTo(200);   // 0,5 × 400
    expect(img.height).toBeCloseTo(150);  // 0,5 × 300
  });

  it('η θέση είναι η ΚΑΤΩ-ΑΡΙΣΤΕΡΗ γωνία (σύμβαση DXF INSERT, y-up)', () => {
    const img = asImage(convertImage(axisAlignedImage(), '0', 0));
    expect(img.position).toEqual({ x: 1000, y: 2000 });
  });

  it('χωρίς περιστροφή → το πεδίο ΔΕΝ μπαίνει καθόλου (καθαρό entity)', () => {
    const img = asImage(convertImage(axisAlignedImage(), '0', 0));
    expect(img.rotation).toBeUndefined();
  });

  it('🔴 η περιστροφή είναι η ΚΑΤΕΥΘΥΝΣΗ του u-διανύσματος — δεν υπάρχει group γωνίας', () => {
    // u στραμμένο 30°, ίδιο μήκος (0,5): width/height αμετάβλητα, rotation = 30.
    const rad = (30 * Math.PI) / 180;
    const img = asImage(convertImage({
      ...axisAlignedImage(),
      '11': String(0.5 * Math.cos(rad)), '21': String(0.5 * Math.sin(rad)),
      '12': String(-0.5 * Math.sin(rad)), '22': String(0.5 * Math.cos(rad)),
    }, '0', 0));
    expect(img.rotation).toBeCloseTo(30, 6);
    expect(img.width).toBeCloseTo(200);
    expect(img.height).toBeCloseTo(150);
  });

  it('ανομοιόμορφη κλίμακα: κάθε άξονας κρατά το ΔΙΚΟ του μήκος pixel', () => {
    const img = asImage(convertImage({
      ...axisAlignedImage(), '11': '2', '21': '0', '12': '0', '22': '0.25',
    }, '0', 0));
    expect(img.width).toBeCloseTo(800);   // 2 × 400
    expect(img.height).toBeCloseTo(75);   // 0,25 × 300
  });
});

describe('convertImage — σύνδεση με το συνημμένο', () => {
  it('🔴 το `url` γεννιέται ΚΕΝΟ — το DXF κρατά διαδρομή, όχι bytes', () => {
    expect(asImage(convertImage(axisAlignedImage(), '0', 0)).url).toBe('');
  });

  it('το group 340 γίνεται `externalRefId` (δείχνει στο IMAGEDEF handle)', () => {
    expect(asImage(convertImage(axisAlignedImage(), '0', 0)).externalRefId).toBe('94E9');
  });

  it('χωρίς 340 (σπασμένος σύνδεσμος) η εικόνα ΕΞΑΚΟΛΟΥΘΕΙ να μετατρέπεται', () => {
    const data = axisAlignedImage();
    delete data['340'];
    const img = asImage(convertImage(data, '0', 0));
    expect(img).not.toBeNull();
    expect(img.externalRefId).toBeUndefined();
  });

  it('κρατά το layer και το εγγενές μέγεθος (για το «Επαναφορά Διαστάσεων», ADR-654)', () => {
    const img = asImage(convertImage(axisAlignedImage(), 'ΑΠΟΤ_ΚΤΙΡΙΟ', 7));
    expect(img.layerId).toBe('ΑΠΟΤ_ΚΤΙΡΙΟ');
    expect(img.id).toBe('image_7');
    expect(img.intrinsicWidth).toBeCloseTo(200);
    expect(img.intrinsicHeight).toBeCloseTo(150);
  });
});

describe('convertImage — απορρίπτει ΜΟΝΟ αδιάβαστη γεωμετρία', () => {
  it('θέση NaN → null', () => {
    expect(convertImage({ ...axisAlignedImage(), '10': 'zz' }, '0', 0)).toBeNull();
  });

  it('μηδενικό μέγεθος σε pixels → null', () => {
    expect(convertImage({ ...axisAlignedImage(), '13': '0' }, '0', 0)).toBeNull();
  });

  it('εκφυλισμένο διάνυσμα pixel (μηδενικό μήκος) → null', () => {
    expect(convertImage({ ...axisAlignedImage(), '11': '0', '21': '0' }, '0', 0)).toBeNull();
  });

  it('🔴 απόντα διανύσματα → fallback 1 μονάδα/pixel, ΟΧΙ απόρριψη', () => {
    // Ορατή εικόνα σε λάθος κλίμακα είναι πάντα προτιμότερη από σιωπηλά χαμένη εικόνα.
    const data = axisAlignedImage();
    delete data['11']; delete data['21']; delete data['12']; delete data['22'];
    const img = asImage(convertImage(data, '0', 0));
    expect(img).not.toBeNull();
    expect(img.width).toBe(400);
    expect(img.height).toBe(300);
    expect(img.rotation).toBeUndefined();
  });
});
