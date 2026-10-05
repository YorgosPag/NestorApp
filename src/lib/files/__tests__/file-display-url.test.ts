/**
 * 🖼️ Η ΑΓΚΥΡΑ ΤΟΥ ΑΝΑΓΝΩΣΤΗ «ΠΟΙΟ URL ΔΕΙΧΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ;» (2026-10-01).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Υ2: ο αναγνώστης ξαναγίνεται `downloadUrl`-only ⇒ οι εγγραφές seed χωρίς `downloadUrl` κρύβονται πάλι.
 * - Υ3: η θέση bytes αγνοείται ⇒ φωτογραφία ΕΕ ζητείται από τον κανονικό κάδο (σιωπηλό 404).
 * - Υ4: άγνωστη θέση «μαντεύεται» ως legacy αντί να ονομαστεί.
 * - Π1: η προεπισκόπηση δένεται στο `downloadUrl` αντί για το όνομα αντικειμένου (ADR-899).
 * - Π2: τύπος που δεν προεπισκοπείται (svg/pdf) παίρνει `srcset` ⇒ 415 σε κάθε πλάτος.
 * - Π3: η θέση bytes χάνεται από το `srcset`.
 * - Π4 (ADR-899 §3.7): οι μετρημένες διαστάσεις δεν κόβουν την κλίμακα / δεν εκτίθενται · άκυρη τιμή γίνεται «διάσταση».
 */

import { buildProxyPreview, buildProxyUrl } from '@/lib/storage/storage-object-url';

import { fileDisplayUrl, fileDisplayUrlOf } from '../file-display-url';

const PATH = 'companies/c1/entities/property/p1/domains/sales/categories/photos/files/file_1.jpg';

describe('fileDisplayUrlOf', () => {
  test('Υ1 αποθηκευμένο downloadUrl ⇒ αυτούσιο, origin=stored', () => {
    expect(fileDisplayUrlOf({ downloadUrl: 'https://x.test/a.jpg', storagePath: PATH }))
      .toEqual({ kind: 'url', url: 'https://x.test/a.jpg', origin: 'stored', preview: null, dimensions: null });
  });

  // ADR-899 §9 θέμα 9 — μετρημένο στην παραγωγή: 13/14 εγγραφές CAD έχουν `downloadUrl → .scene.json`, `storagePath → .dxf`.
  describe('🔴 Υ6 το αποθηκευμένο URL ονομάζει ΑΛΛΟ αντικείμενο από το storagePath', () => {
    const DXF = 'companies/c1/entities/property/p1/domains/construction/categories/floorplans/files/file_9.dxf';
    const SCENE = DXF.replace(/\.dxf$/, '.scene.json');
    const tokenUrl = (objectPath: string) =>
      `https://firebasestorage.googleapis.com/v0/b/bucket.test/o/${encodeURIComponent(objectPath)}?alt=media&token=t`;

    test('συνοδευτικό (σκηνή) ⇒ το proxy του storagePath, origin=realigned — ποτέ το JSON της σκηνής', () => {
      expect(fileDisplayUrlOf({ downloadUrl: tokenUrl(SCENE), storagePath: DXF, contentType: 'application/dxf' }))
        .toEqual({ kind: 'url', url: buildProxyUrl(DXF), origin: 'realigned', preview: null, dimensions: null });
      expect(fileDisplayUrlOf({ downloadUrl: buildProxyUrl(SCENE), storagePath: DXF }))
        .toMatchObject({ url: buildProxyUrl(DXF), origin: 'realigned' });
    });

    test('ίδιο αντικείμενο ⇒ το αποθηκευμένο URL μένει ΑΥΤΟΥΣΙΟ (το token δεν πετιέται)', () => {
      expect(fileDisplayUrlOf({ downloadUrl: tokenUrl(DXF), storagePath: DXF }))
        .toMatchObject({ url: tokenUrl(DXF), origin: 'stored' });
    });

    test('URL που ο αντίστροφος αναγνώστης δεν καταλαβαίνει ⇒ δεν κρίνεται, μένει stored', () => {
      expect(fileDisplayUrlOf({ downloadUrl: 'https://x.test/other.scene.json', storagePath: DXF }))
        .toMatchObject({ url: 'https://x.test/other.scene.json', origin: 'stored' });
    });

    test('διαφωνία + άγνωστη θέση bytes ⇒ ονομασμένη απουσία — ούτε το συνοδευτικό, ούτε μαντεψιά κάδου', () => {
      expect(fileDisplayUrlOf({ downloadUrl: tokenUrl(SCENE), storagePath: DXF, storagePlacement: 'mars-bucket' }))
        .toEqual({ kind: 'unavailable', why: 'unknown-placement' });
    });

    test('χωρίς storagePath δεν υπάρχει με τι να διαφωνήσει ⇒ stored', () => {
      expect(fileDisplayUrlOf({ downloadUrl: tokenUrl(SCENE) })).toMatchObject({ url: tokenUrl(SCENE), origin: 'stored' });
    });
  });

  test('🔴 Υ2 χωρίς downloadUrl, με storagePath ⇒ το proxy URL του ΕΝΟΣ γραφέα, origin=derived', () => {
    expect(fileDisplayUrlOf({ storagePath: PATH }))
      .toEqual({ kind: 'url', url: buildProxyUrl(PATH), origin: 'derived', preview: null, dimensions: null });
    expect(fileDisplayUrlOf({ downloadUrl: '  ', storagePath: PATH }).kind).toBe('url');
  });

  test('🔴 Υ3 η θέση bytes ταξιδεύει στο παράγωγο URL', () => {
    expect(fileDisplayUrlOf({ storagePath: PATH, storagePlacement: 'eu-originals' }))
      .toEqual({ kind: 'url', url: buildProxyUrl(PATH, 'eu-originals'), origin: 'derived', preview: null, dimensions: null });
  });

  test('🔴 Υ4 άγνωστη θέση ⇒ ονομασμένη απουσία, ποτέ μαντεψιά κάδου', () => {
    expect(fileDisplayUrlOf({ storagePath: PATH, storagePlacement: 'mars-bucket' }))
      .toEqual({ kind: 'unavailable', why: 'unknown-placement' });
  });

  test('Υ5 ούτε downloadUrl ούτε storagePath ⇒ no-storage-path', () => {
    expect(fileDisplayUrlOf({ storagePath: '' })).toEqual({ kind: 'unavailable', why: 'no-storage-path' });
    expect(fileDisplayUrl({ storagePath: null })).toBeNull();
  });

  test('🔴 Π1 προεπισκόπηση από το ΟΝΟΜΑ αντικειμένου — και όταν υπάρχει downloadUrl', () => {
    const stored = fileDisplayUrlOf({ downloadUrl: 'https://x.test/a.jpg', storagePath: PATH, contentType: 'image/jpeg' });
    expect(stored).toEqual({ kind: 'url', url: 'https://x.test/a.jpg', origin: 'stored', preview: buildProxyPreview(PATH), dimensions: null });
  });

  test('🔴 Π2 μόνο τύποι που αποκωδικοποιεί ο κωδικοποιητής', () => {
    for (const contentType of ['image/svg+xml', 'application/pdf', 'image/gif', null, undefined]) {
      const resolved = fileDisplayUrlOf({ storagePath: PATH, contentType });
      expect(resolved.kind === 'url' && resolved.preview).toBeNull();
    }
    const upper = fileDisplayUrlOf({ storagePath: PATH, contentType: 'IMAGE/JPEG; q=1' });
    expect(upper.kind === 'url' && upper.preview).toEqual(buildProxyPreview(PATH));
  });

  test('🔴 Π3 η θέση bytes ταξιδεύει και στο srcset', () => {
    const resolved = fileDisplayUrlOf({ storagePath: PATH, storagePlacement: 'eu-originals', contentType: 'image/png' });
    expect(resolved.kind === 'url' && resolved.preview).toEqual(buildProxyPreview(PATH, 'eu-originals'));
  });

  test('🔴 Π4 μετρημένο πλάτος ⇒ κλίμακα ως την πρώτη επαρκή βαθμίδα · εφεδρεία μέσα της · διαστάσεις εκτίθενται', () => {
    const resolved = fileDisplayUrlOf({ storagePath: PATH, contentType: 'image/jpeg', imageDimensions: { width: 1013, height: 1800 } });
    if (resolved.kind !== 'url' || resolved.preview === null) throw new Error('expected preview');
    expect(resolved.dimensions).toEqual({ width: 1013, height: 1800 });
    expect(resolved.preview.ladder.map((rung) => rung.width)).toEqual([320, 640, 1280]);
    // Οι διαστάσεις ταξιδεύουν **με** την προεπισκόπηση (§9 Ε2β): ο zoom υπολογίζει από αυτές τι ζωγραφίζεται.
    expect(resolved.preview.dimensions).toEqual({ width: 1013, height: 1800 });
    expect(resolved.preview.srcSet).not.toContain('w=2560');
    const small = fileDisplayUrlOf({ storagePath: PATH, contentType: 'image/png', imageDimensions: { width: 600, height: 400 } });
    expect(small.kind === 'url' && small.preview?.src.endsWith('w=640')).toBe(true);
    for (const imageDimensions of [{ width: 0, height: 10 }, { width: '1013', height: '1800' }, null]) {
      const unknown = fileDisplayUrlOf({ storagePath: PATH, contentType: 'image/jpeg', imageDimensions });
      expect(unknown.kind === 'url' && unknown.dimensions).toBeNull();
      expect(unknown.kind === 'url' && unknown.preview).toEqual(buildProxyPreview(PATH));
    }
  });
});
