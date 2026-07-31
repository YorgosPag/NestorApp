/**
 * ADR-736 §5.3 — **CONTRACT TEST** του IMAGE render-field passthrough (anti-drift).
 *
 * Ο σκοπός δεν είναι να ελέγξει «λειτουργεί ο mapper;» — είναι να κάνει **αδύνατο** να
 * ξαναχαθεί σιωπηλά μια ιδιότητα εικόνας στον δρόμο προς τον καμβά.
 *
 * 🔴 **Η μέτρηση που γέννησε αυτό το αρχείο:** το `sourcePath` (ADR-736 §2.Β) γράφτηκε σωστά
 * στο **ένα** σημείο εγγραφής, ο `ImageRenderer` το ζητούσε σωστά, **32/32 tests ήταν πράσινα**
 * — και στην οθόνη το πλαίσιο-κράτημα έδειχνε ακόμη σκέτο `2.jpg`. Χανόταν στα **δύο**
 * ενδιάμεσα περάσματα, που κανένα test δεν διέσχιζε. Ακριβώς το σχήμα των έξι περιστατικών του
 * `hatch-render-fields.test.ts`.
 *
 * Αν κάποιος προσθέσει πεδίο στο {@link IMAGE_RENDER_FIELDS} χωρίς να το μεταφέρουν ΟΛΕΣ οι
 * προβολές, **αυτό το αρχείο κοκκινίζει**.
 *
 * @see bim/image/image-render-fields.ts
 * @see bim/hatch/hatch-render-fields.ts — ο αδελφός SSoT (ADR-507)
 */

import { IMAGE_RENDER_FIELDS, pickImageRenderFields } from '../image-render-fields';
import { TO_DXF_HANDLERS } from '../../../hooks/canvas/dxf-scene-entity-handlers';
import { buildEntityModelFromDxf } from '../../../canvas-v2/dxf-canvas/dxf-renderer-entity-model';
import type { ImageEntity } from '../../../types/image';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

/** Η διαδρομή του πραγματικού δείγματος (`47_ergasia.dxf`) — όχι επινοημένη. */
const REAL_PATH = 'Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\EYOSMO_1\\047\\2026 ΠΑΓΩΝΗΣ\\1.jpg';

/**
 * Μια εικόνα με **ΚΑΘΕ** πεδίο του συμβολαίου γεμάτο με ξεχωριστή, αναγνωρίσιμη τιμή.
 * Αν προστεθεί πεδίο στο `IMAGE_RENDER_FIELDS` και ξεχαστεί εδώ, το πρώτο test το πιάνει.
 */
const FULL_IMAGE = {
  id: 'img_contract', type: 'image', layerId: 'L', visible: true,
  position: { x: 206.109, y: 304.84 },
  width: 35,
  height: 32.757,
  url: 'https://example.invalid/asset.jpg',
  rotation: 17,
  sourceName: '1.jpg',
  sourcePath: REAL_PATH,
} as unknown as ImageEntity;

describe('IMAGE_RENDER_FIELDS — το συμβόλαιο', () => {
  it('το δείγμα ελέγχου γεμίζει ΚΑΘΕ πεδίο της λίστας (αλλιώς ο έλεγχος είναι ψεύτικος)', () => {
    const missing = IMAGE_RENDER_FIELDS.filter(
      (f) => (FULL_IMAGE as unknown as Record<string, unknown>)[f] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('περιλαμβάνει το `sourcePath` — το πεδίο που δεν έφτανε ΠΟΤΕ στον καμβά', () => {
    expect(IMAGE_RENDER_FIELDS).toContain('sourcePath');
  });

  it('pickImageRenderFields ΠΑΡΑΛΕΙΠΕΙ τα απόντα optionals (ποτέ κλειδί με undefined)', () => {
    const picked = pickImageRenderFields({
      position: { x: 0, y: 0 }, width: 1, height: 1, url: '',
    } as Partial<ImageEntity>);
    expect(Object.keys(picked).sort()).toEqual(['height', 'position', 'url', 'width']);
    expect('sourcePath' in picked).toBe(false);
    expect('rotation' in picked).toBe(false);
  });

  it('τα scene-only πεδία μένουν ΕΚΤΟΣ (δεν είναι render state — βλ. κεφαλίδα του module)', () => {
    for (const field of ['intrinsicWidth', 'intrinsicHeight', 'externalRefId', 'dxfImageExport']) {
      expect(IMAGE_RENDER_FIELDS).not.toContain(field);
    }
  });
});

describe('🔴 ΚΑΜΙΑ προβολή δεν ρίχνει πεδίο του συμβολαίου', () => {
  const base = { id: FULL_IMAGE.id, layerId: 'L', visible: true };
  const dxf = TO_DXF_HANDLERS.image!(FULL_IMAGE, base as never) as unknown as Record<string, unknown>;

  it('προβολή 1/2 — scene ImageEntity → DxfImage', () => {
    expect(dxf).not.toBeNull();
    const dropped = IMAGE_RENDER_FIELDS.filter((f) => dxf[f] === undefined);
    expect(dropped).toEqual([]);
  });

  it('προβολή 2/2 — DxfImage → render EntityModel', () => {
    const model = buildEntityModelFromDxf(
      dxf as unknown as DxfEntityUnion, false,
      { colorHex: '#fff', lineWidthPx: 1, alpha: 1 },
    ) as unknown as Record<string, unknown>;
    const dropped = IMAGE_RENDER_FIELDS.filter((f) => model[f] === undefined);
    expect(dropped).toEqual([]);
  });

  it('🔴 end-to-end: η ΠΛΗΡΗΣ ΔΙΑΔΡΟΜΗ φτάνει αυτούσια στο μοντέλο που βλέπει ο ImageRenderer', () => {
    const model = buildEntityModelFromDxf(
      dxf as unknown as DxfEntityUnion, false,
      { colorHex: '#fff', lineWidthPx: 1, alpha: 1 },
    ) as unknown as { sourcePath?: string; sourceName?: string };
    // Αυτό ΑΚΡΙΒΩΣ έσπαγε: ο renderer έβλεπε `sourcePath: undefined` ⇒ το
    // `paintPlaceholderLabel` έπεφτε στη βαθμίδα «μόνο όνομα» σε ΚΑΘΕ κλίμακα, και η
    // εγκεκριμένη μεσαία αποκοπή δεν εμφανίστηκε ποτέ — ενώ 32/32 tests ήταν πράσινα.
    expect(model.sourcePath).toBe(REAL_PATH);
    expect(model.sourceName).toBe('1.jpg');
  });
});
