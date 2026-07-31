/**
 * ADR-736 — `applyExternalReferencesToEntities`: η **μία** γέφυρα αναφορά → `ImageEntity`.
 *
 * Ελέγχεται ό,τι θα σπάσει σιωπηλά αν κάποιος τη γράψει δεύτερη φορά αλλού: ταύτιση handle
 * (και η ανοχή στην πεζότητα), ιδιοτροπία (idempotency), σταθερότητα αναφοράς πίνακα, και ο
 * κανόνας «η επίλυση προσθέτει, δεν αφαιρεί».
 */

import type { AnySceneEntity } from '../../types/scene';
import type { ImageEntity } from '../../types/image';
import type { DxfExternalReference } from '../../types/dxf-external-reference';
import { applyExternalReferencesToEntities } from '../dxf-external-reference-apply';

function ref(overrides: Partial<DxfExternalReference> = {}): DxfExternalReference {
  return {
    id: '2F1',
    kind: 'raster',
    status: 'missing',
    rawPath: 'Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\dianomi_1.JPG',
    basename: 'dianomi_1.JPG',
    sourceHandle: '2F1',
    ...overrides,
  };
}

function image(overrides: Partial<ImageEntity> = {}): ImageEntity {
  return {
    id: 'image_0',
    type: 'image',
    layerId: '0',
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    url: '',
    externalRefId: '2F1',
    ...overrides,
  };
}

/** Οι εικόνες του αποτελέσματος, με τα δύο πεδία που μας αφορούν. */
function images(entities: readonly AnySceneEntity[]): Array<Pick<ImageEntity, 'sourceName' | 'url'>> {
  return entities
    .filter((e): e is ImageEntity => e.type === 'image')
    .map(({ sourceName, url }) => ({ sourceName, url }));
}

describe('applyExternalReferencesToEntities — όνομα', () => {
  it('περνά το basename της αναφοράς στην εικόνα που τη δείχνει', () => {
    const out = applyExternalReferencesToEntities([image()], [ref()]);
    expect(images(out)).toEqual([{ sourceName: 'dianomi_1.JPG', url: '' }]);
  });

  it('ταυτίζει handle ΑΝΕΞΑΡΤΗΤΑ πεζότητας — τα handles είναι δεκαεξαδικά', () => {
    // Το AutoCAD γράφει κεφαλαία· μετατροπείς DWG→DXF τρίτων δεν το εγγυώνται. Ευαίσθητη
    // ταύτιση θα απέτυχε σε ΕΓΚΥΡΟ αρχείο και η αποτυχία θα φαινόταν ως «λείπει».
    const out = applyExternalReferencesToEntities(
      [image({ externalRefId: '2f1' })],
      [ref({ sourceHandle: '2F1' })],
    );
    expect(images(out)[0].sourceName).toBe('dianomi_1.JPG');
  });

  it('γεμίζει ΟΛΕΣ τις εικόνες που δείχνουν στην ίδια αναφορά (σχέση N:1)', () => {
    // Ένα IMAGEDEF εξυπηρετεί πολλά IMAGE: το ίδιο υπόβαθρο τοποθετημένο δύο φορές.
    const out = applyExternalReferencesToEntities(
      [image({ id: 'image_0' }), image({ id: 'image_1' })],
      [ref()],
    );
    expect(images(out).map((i) => i.sourceName)).toEqual(['dianomi_1.JPG', 'dianomi_1.JPG']);
  });

  it('αφήνει ΑΘΙΚΤΕΣ τις εικόνες χωρίς αναφορά (τοποθετημένες από τον χρήστη)', () => {
    const userImage = image({ externalRefId: undefined, url: 'https://cdn/tree.png' });
    const out = applyExternalReferencesToEntities([userImage], [ref()]);
    expect(out[0]).toBe(userImage);
  });

  it('αγνοεί αναφορά που δεν αντιστοιχεί σε καμία εικόνα, και εικόνα με άγνωστο id', () => {
    const orphan = image({ externalRefId: 'DEAD' });
    const out = applyExternalReferencesToEntities([orphan], [ref()]);
    expect(out[0]).toBe(orphan);
  });

  it('αναφορά ΧΩΡΙΣ handle δεν μπορεί να συνδεθεί (δεν υπάρχει κλειδί)', () => {
    const img = image();
    const out = applyExternalReferencesToEntities([img], [ref({ sourceHandle: undefined })]);
    expect(out[0]).toBe(img);
  });
});

/**
 * ADR-736 §5.3 — η **πλήρης διαδρομή** ταξιδεύει μαζί με το όνομα, από ΤΟ ΙΔΙΟ σημείο. Ο
 * renderer είναι pure leaf (ADR-040): δεν βλέπει τη σκηνή, άρα δεν μπορεί να ακολουθήσει το
 * `externalRefId` για να βρει το `rawPath` μόνος του.
 */
describe('applyExternalReferencesToEntities — πλήρης διαδρομή (§5.3)', () => {
  const paths = (entities: readonly AnySceneEntity[]): Array<string | undefined> =>
    entities.filter((e): e is ImageEntity => e.type === 'image').map((e) => e.sourcePath);

  it('περνά το rawPath της αναφοράς στην εικόνα', () => {
    const out = applyExternalReferencesToEntities([image()], [ref()]);
    expect(paths(out)).toEqual(['Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\dianomi_1.JPG']);
  });

  it('γεμίζει ΟΛΕΣ τις εικόνες που δείχνουν στην ίδια αναφορά (σχέση N:1)', () => {
    const out = applyExternalReferencesToEntities(
      [image({ id: 'a' }), image({ id: 'b' })],
      [ref()],
    );
    expect(paths(out)).toEqual([
      'Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\dianomi_1.JPG',
      'Z:\\Jobs\\OT\\ΕΥΟΣΜΟΣ\\dianomi_1.JPG',
    ]);
  });

  it('αναφορά ΧΩΡΙΣ rawPath αφήνει το πεδίο κενό — ποτέ κενή συμβολοσειρά', () => {
    const out = applyExternalReferencesToEntities([image()], [ref({ rawPath: '' })]);
    expect(paths(out)).toEqual([undefined]);
  });

  it('είναι idempotent ως προς τη διαδρομή — δεύτερη κλήση δίνει τον ΙΔΙΟ πίνακα', () => {
    const refs = [ref()];
    const first = applyExternalReferencesToEntities([image()], refs);
    expect(applyExternalReferencesToEntities(first, refs)).toBe(first);
  });
});

describe('applyExternalReferencesToEntities — url μετά την επίλυση', () => {
  it('γράφει το url ΜΟΝΟ από αναφορά σε κατάσταση resolved', () => {
    const resolved = ref({ status: 'resolved', url: 'https://storage/dianomi_1.JPG' });
    expect(images(applyExternalReferencesToEntities([image()], [resolved]))).toEqual([
      { sourceName: 'dianomi_1.JPG', url: 'https://storage/dianomi_1.JPG' },
    ]);
  });

  it('δεν γράφει url από αναφορά που δηλώνει resolved αλλά δεν φέρει url', () => {
    const out = applyExternalReferencesToEntities([image()], [ref({ status: 'resolved' })]);
    expect(images(out)[0].url).toBe('');
  });

  it('ΔΕΝ σβήνει υπάρχον url όταν η αναφορά ξαναγίνει missing — η επίλυση προσθέτει', () => {
    const filled = image({ url: 'https://storage/dianomi_1.JPG', sourceName: 'dianomi_1.JPG' });
    const out = applyExternalReferencesToEntities([filled], [ref({ status: 'missing' })]);
    expect(images(out)[0].url).toBe('https://storage/dianomi_1.JPG');
  });
});

describe('applyExternalReferencesToEntities — καθαρότητα & σταθερότητα', () => {
  it('είναι idempotent: δεύτερη κλήση δεν αλλάζει τίποτα ΚΑΙ δίνει τον ίδιο πίνακα', () => {
    const refs = [ref({ status: 'resolved', url: 'https://storage/x.JPG' })];
    const first = applyExternalReferencesToEntities([image()], refs);
    const second = applyExternalReferencesToEntities(first, refs);
    expect(second).toBe(first);
  });

  it('επιστρέφει τον ΙΔΙΟ πίνακα όταν δεν υπάρχουν αναφορές (μηδέν νέος πίνακας ⇒ μηδέν βρόχος)', () => {
    // Νέος πίνακας σε κάθε κλήση είναι η κλασική αιτία ατέρμονου βρόχου σε React selector.
    const entities = [image()];
    expect(applyExternalReferencesToEntities(entities, [])).toBe(entities);
  });

  it('ΔΕΝ μεταλλάσσει την είσοδο — η αρχική οντότητα μένει ανέγγιχτη', () => {
    const original = image();
    applyExternalReferencesToEntities([original], [ref()]);
    expect(original.sourceName).toBeUndefined();
  });

  it('αφήνει τις μη-εικόνες αυτούσιες (ίδιες αναφορές αντικειμένων)', () => {
    const line = { id: 'l1', type: 'line', layerId: '0' } as unknown as AnySceneEntity;
    const out = applyExternalReferencesToEntities([line, image()], [ref()]);
    expect(out[0]).toBe(line);
  });
});
