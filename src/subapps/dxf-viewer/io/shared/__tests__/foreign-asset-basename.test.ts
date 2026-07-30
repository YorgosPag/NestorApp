/**
 * ADR-735 — SSoT basename ξένου asset.
 *
 * Οι τρεις πρώτες περιπτώσεις κάθε describe είναι **μεταφερμένες αυτούσιες** από το
 * `collada-to-glb.test.ts` (ADR-690), ώστε η κεντρικοποίηση να αποδεικνύεται ισοδύναμη και
 * όχι απλώς «πράσινη». Οι υπόλοιπες κλειδώνουν ό,τι **κέρδισε** το .dae μονοπάτι από την
 * ενοποίηση (percent-decode, `file://`) και ό,τι χρειάζεται το DXF (drive letter, UNC).
 */

import {
  foreignAssetBasename,
  foreignAssetBasenameKey,
  indexFilesByBasename,
} from '../foreign-asset-basename';

describe('foreignAssetBasenameKey — συμπεριφορά μεταφερμένη από το textureBasename (ADR-690)', () => {
  it('κρατά μόνο το basename, πεζά, από path με / ή \\', () => {
    expect(foreignAssetBasenameKey('F:\\Shared\\Υλικά\\HMI_3D01.JPG')).toBe('hmi_3d01.jpg');
    expect(foreignAssetBasenameKey('textures/3D01_OPC.jpg')).toBe('3d01_opc.jpg');
    expect(foreignAssetBasenameKey('plain.PNG')).toBe('plain.png');
  });
});

describe('indexFilesByBasename — συμπεριφορά μεταφερμένη από το indexImagesByBasename', () => {
  it('χαρτογραφεί basename(πεζά) → File', () => {
    const a = new File(['x'], 'HMI_3D01.jpg');
    const b = new File(['y'], 'sub/3D01_OPC.jpg');
    const map = indexFilesByBasename([a, b]);
    expect(map.get('hmi_3d01.jpg')).toBe(a);
    expect(map.get('3d01_opc.jpg')).toBe(b);
    expect(map.size).toBe(2);
  });

  it('σε διπλό basename κερδίζει το ΤΕΛΕΥΤΑΙΟ (τεκμηριωμένη επιλογή, όχι τυχαία)', () => {
    const first = new File(['1'], 'a/dianomi_1.JPG');
    const second = new File(['2'], 'b/dianomi_1.jpg');
    const map = indexFilesByBasename([first, second]);
    expect(map.get('dianomi_1.jpg')).toBe(second);
    expect(map.size).toBe(1);
  });
});

describe('foreignAssetBasename — ό,τι ΚΕΡΔΙΣΕ το .dae μονοπάτι από την ενοποίηση', () => {
  it('αποκωδικοποιεί percent-encoding (ο ColladaLoader δίνει encoded URL)', () => {
    // Ακριβώς η κλάση που ΔΕΝ ταίριαζε πριν: το OS δίνει `File.name = 'Ξερό bark 21.jpg'`.
    expect(foreignAssetBasename('textures/%CE%9E%CE%B5%CF%81%CF%8C%20bark%2021.jpg'))
      .toBe('Ξερό bark 21.jpg');
    expect(foreignAssetBasename('my%20wood.png')).toBe('my wood.png');
  });

  it('αφαιρεί το `file://` prefix που γράφει ο C4D', () => {
    expect(foreignAssetBasename('file:///F:/Shared/Υλικά/HMI_3D01.JPG')).toBe('HMI_3D01.JPG');
  });

  it('malformed percent → κρατά το raw, ΠΟΤΕ δεν πετά', () => {
    expect(() => foreignAssetBasename('50%_scale.jpg')).not.toThrow();
    expect(foreignAssetBasename('50%_scale.jpg')).toBe('50%_scale.jpg');
  });

  it('κρατά την πεζότητα (είναι για ΕΜΦΑΝΙΣΗ· το κλειδί ταύτισης πεζοποιεί)', () => {
    expect(foreignAssetBasename('Z:\\Jobs\\dianomi_1.JPG')).toBe('dianomi_1.JPG');
    expect(foreignAssetBasenameKey('Z:\\Jobs\\dianomi_1.JPG')).toBe('dianomi_1.jpg');
  });
});

describe('foreignAssetBasename — οι μορφές διαδρομής που δηλώνει ένα DXF (ADR-735)', () => {
  it('απόλυτη Windows διαδρομή με γράμμα δίσκου και ελληνικά (το πραγματικό δείγμα)', () => {
    expect(foreignAssetBasename('Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\EYOSMO_1\\047\\2026 ΠΑΓΩΝΗΣ\\dianomi_1.JPG'))
      .toBe('dianomi_1.JPG');
    expect(foreignAssetBasename('Z:\\Jobs\\arxeio\\ΣΦΡΑΓΙΔΑ ΜΑΥΡΟΜΙΧΑΛΗΣ.jpg'))
      .toBe('ΣΦΡΑΓΙΔΑ ΜΑΥΡΟΜΙΧΑΛΗΣ.jpg');
  });

  it('UNC διαδρομή δικτύου', () => {
    expect(foreignAssetBasename('\\\\NAS40CA48\\Public\\ypomnima\\google_47.JPG'))
      .toBe('google_47.JPG');
  });

  it('σχετική διαδρομή (`.\\` / `..\\`) — το AutoCAD γράφει και τέτοιες', () => {
    expect(foreignAssetBasename('.\\images\\gps_47.JPG')).toBe('gps_47.JPG');
    expect(foreignAssetBasename('..\\..\\shared\\diatagma_1993.JPG')).toBe('diatagma_1993.JPG');
  });

  it('σκέτο όνομα χωρίς φάκελο', () => {
    expect(foreignAssetBasename('1.jpg')).toBe('1.jpg');
  });

  it('διαδρομή που τελειώνει σε διαχωριστικό → επιστρέφει την είσοδο (πάντα κάτι να δείξεις)', () => {
    expect(foreignAssetBasename('Z:\\Jobs\\')).toBe('Z:\\Jobs\\');
    expect(foreignAssetBasename('')).toBe('');
  });
});
