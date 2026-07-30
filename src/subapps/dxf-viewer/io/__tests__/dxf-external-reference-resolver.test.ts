/**
 * ADR-736 Φ3 — ο resolver: dedup περιεχομένου, ανθεκτικότητα σε αποτυχία, ρητές επιλογές χρήστη.
 *
 * Ό,τι αγγίζει δίκτυο είναι injected, οπότε ελέγχεται **η συμπεριφορά** και όχι το Firebase:
 * πόσες φορές ανέβηκε τι, τι έγινε όταν ένα ανέβασμα απέτυχε, και τι επιβίωσε στις αναφορές.
 */

import type { DxfExternalReference } from '../../types/dxf-external-reference';
import {
  resolveExternalReferences,
  type ResolveExternalReferencesDeps,
} from '../dxf-external-reference-resolver';

const file = (name: string, body = name): File => new File([body], name);

function ref(overrides: Partial<DxfExternalReference> = {}): DxfExternalReference {
  return {
    id: 'H1',
    kind: 'raster',
    status: 'missing',
    rawPath: 'Z:\\Jobs\\dianomi_1.JPG',
    basename: 'dianomi_1.JPG',
    sourceHandle: 'H1',
    ...overrides,
  };
}

/** Το hash είναι το **περιεχόμενο** του αρχείου (τεστ) ⇒ ίδιο κείμενο = ίδια ταυτότητα. */
function makeDeps(overrides: Partial<ResolveExternalReferencesDeps> = {}): {
  deps: ResolveExternalReferencesDeps;
  uploads: string[];
} {
  const uploads: string[] = [];
  const deps: ResolveExternalReferencesDeps = {
    pixelSizeOf: async () => null,
    hashFile: async (blob) => `sha(${await blob.text()})`,
    uploadByContent: async (f, hash) => {
      uploads.push(`${f.name}#${hash}`);
      return `https://storage/${hash}`;
    },
    ...overrides,
  };
  return { deps, uploads };
}

describe('resolveExternalReferences — η επιτυχής διαδρομή', () => {
  it('επιλύει και επιστρέφει ΝΕΟ αντικείμενο — η αρχική δήλωση δεν χάνεται', async () => {
    const original = ref();
    const { deps } = makeDeps();
    const r = await resolveExternalReferences(
      { references: [original], files: [file('dianomi_1.JPG')] },
      deps,
    );
    expect(r.references[0]).toMatchObject({ status: 'resolved', url: 'https://storage/sha(dianomi_1.JPG)' });
    // Αμετάβλητη είσοδος + η διαδρομή του σχεδίου επιβιώνει στην επιλυμένη αναφορά.
    expect(original.status).toBe('missing');
    expect(r.references[0].rawPath).toBe('Z:\\Jobs\\dianomi_1.JPG');
  });

  it('αφήνει ανέγγιχτες τις αναφορές που δεν ταίριαξαν', async () => {
    const { deps } = makeDeps();
    const refs = [ref(), ref({ id: 'H2', sourceHandle: 'H2', basename: 'λειπει.jpg' })];
    const r = await resolveExternalReferences({ references: refs, files: [file('dianomi_1.JPG')] }, deps);
    expect(r.references[1]).toBe(refs[1]);
  });
});

describe('resolveExternalReferences — dedup με ΠΕΡΙΕΧΟΜΕΝΟ', () => {
  it('🔴 ίδια bytes με ΔΙΑΦΟΡΕΤΙΚΟ όνομα ⇒ ΕΝΑ ανέβασμα, δύο επιλυμένες αναφορές', async () => {
    // Ο χρήστης έδωσε το ίδιο απόσπασμα δύο φορές (μια από τον φάκελο, μια από το zip).
    const { deps, uploads } = makeDeps();
    const refs = [
      ref({ id: 'A', sourceHandle: 'A', basename: 'a.jpg' }),
      ref({ id: 'B', sourceHandle: 'B', basename: 'b.jpg' }),
    ];
    const r = await resolveExternalReferences(
      { references: refs, files: [file('a.jpg', 'ΙΔΙΑ BYTES'), file('b.jpg', 'ΙΔΙΑ BYTES')] },
      deps,
    );
    expect(uploads).toHaveLength(1);
    expect(r.uploadedCount).toBe(1);
    expect(r.references.map((x) => x.url)).toEqual([
      'https://storage/sha(ΙΔΙΑ BYTES)',
      'https://storage/sha(ΙΔΙΑ BYTES)',
    ]);
  });

  it('διαφορετικά bytes ⇒ δύο ανεβάσματα', async () => {
    const { deps, uploads } = makeDeps();
    const refs = [
      ref({ id: 'A', sourceHandle: 'A', basename: 'a.jpg' }),
      ref({ id: 'B', sourceHandle: 'B', basename: 'b.jpg' }),
    ];
    await resolveExternalReferences(
      { references: refs, files: [file('a.jpg', 'ΕΝΑ'), file('b.jpg', 'ΔΥΟ')] },
      deps,
    );
    expect(uploads).toHaveLength(2);
  });
});

describe('resolveExternalReferences — η αποτυχία είναι ΑΝΑ ΑΝΑΦΟΡΑ', () => {
  it('🔴 ένα υπερμεγέθες αρχείο ΔΕΝ ρίχνει τα υπόλοιπα', async () => {
    const { deps } = makeDeps({
      uploadByContent: async (f, hash) => {
        if (f.name === 'huge.jpg') throw Object.assign(new Error('too big'), { code: 'size' });
        return `https://storage/${hash}`;
      },
    });
    const refs = [
      ref({ id: 'A', sourceHandle: 'A', basename: 'huge.jpg' }),
      ref({ id: 'B', sourceHandle: 'B', basename: 'ok.jpg' }),
    ];
    const r = await resolveExternalReferences(
      { references: refs, files: [file('huge.jpg'), file('ok.jpg')] },
      deps,
    );
    expect(r.failures).toEqual([
      { refId: 'A', fileName: 'huge.jpg', code: 'too-large', detail: 'too big' },
    ]);
    expect(r.references[0].status).toBe('missing'); // μένει ακριβώς όπως ήταν
    expect(r.references[1].status).toBe('resolved'); // …και η διπλανή επιλύεται κανονικά
  });

  it('μη υποστηριζόμενη μορφή → unsupported-format (όχι γενικό «απέτυχε»)', async () => {
    const { deps } = makeDeps({
      uploadByContent: async () => {
        throw Object.assign(new Error('bad format'), { code: 'format' });
      },
    });
    const r = await resolveExternalReferences(
      { references: [ref({ basename: 'a.tif' })], files: [file('a.tif')] },
      deps,
    );
    expect(r.failures[0].code).toBe('unsupported-format');
  });

  it('άγνωστο σφάλμα δικτύου → upload-failed', async () => {
    const { deps } = makeDeps({
      uploadByContent: async () => {
        throw new Error('network down');
      },
    });
    const r = await resolveExternalReferences(
      { references: [ref()], files: [file('dianomi_1.JPG')] },
      deps,
    );
    expect(r.failures[0]).toMatchObject({ code: 'upload-failed', detail: 'network down' });
  });
});

describe('resolveExternalReferences — ρητή επιλογή χρήστη', () => {
  const ambiguousSetup = () => ({
    refs: [ref({ basename: '1.jpg', rawPath: 'Z:\\1.jpg' })],
    files: [file('1.png'), file('1.webp')],
  });

  it('χωρίς επιλογή, η αναφορά μένει διφορούμενη και ΔΕΝ ανεβαίνει τίποτα', async () => {
    const { deps, uploads } = makeDeps();
    const { refs, files } = ambiguousSetup();
    const r = await resolveExternalReferences({ references: refs, files }, deps);
    expect(r.ambiguous.map((a) => a.refId)).toEqual(['H1']);
    expect(uploads).toEqual([]);
  });

  it('με επιλογή, επιλύεται ΚΑΙ φεύγει από τα διφορούμενα — ο άνθρωπος αποφάσισε', async () => {
    const { deps } = makeDeps();
    const { refs, files } = ambiguousSetup();
    const r = await resolveExternalReferences(
      { references: refs, files, overrides: new Map([['H1', files[1]]]) },
      deps,
    );
    expect(r.ambiguous).toEqual([]);
    expect(r.references[0]).toMatchObject({ status: 'resolved', url: 'https://storage/sha(1.webp)' });
  });

  it('επιλογή για ήδη επιλυμένη αναφορά αγνοείται', async () => {
    const { deps, uploads } = makeDeps();
    const done = ref({ status: 'resolved', url: 'https://storage/παλιο' });
    const r = await resolveExternalReferences(
      { references: [done], files: [file('x.jpg')], overrides: new Map([['H1', file('x.jpg')]]) },
      deps,
    );
    expect(uploads).toEqual([]);
    expect(r.references[0].url).toBe('https://storage/παλιο');
  });
});

describe('resolveExternalReferences — idempotency', () => {
  it('δεύτερη κλήση πάνω στο αποτέλεσμα δεν ξανανεβάζει τίποτα', async () => {
    const { deps, uploads } = makeDeps();
    const files = [file('dianomi_1.JPG')];
    const first = await resolveExternalReferences({ references: [ref()], files }, deps);
    const second = await resolveExternalReferences({ references: first.references, files }, deps);
    expect(uploads).toHaveLength(1);
    expect(second.uploadedCount).toBe(0);
    expect(second.references[0].url).toBe(first.references[0].url);
  });
});
