/**
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α3γ (καθαρή)** — οι δηλώσεις του ακινήτου ακολουθούν την έκδοση (ADR-845 §7.17).
 * @module lib/listings/__tests__/declaration-succession
 *
 *   Μ1-Μ3  λίστες ταυτοτήτων: η **θέση** κρατιέται · ο ήδη δηλωμένος διάδοχος νικά · άσχετη λίστα ⇒ καμία αλλαγή
 *   Μ4-Μ5  χάρτες ανά αρχείο: το **κλειδί** μεταφέρεται, η τιμή αυτούσια · ρητή τιμή του διαδόχου νικά
 *   Μ6     σημείο λήψης που δείχνει στην **κάτοψη** που αντικαταστάθηκε ⇒ ακολουθεί
 *   Μ7     ό,τι δεν καταλαβαίνει **δεν το αγγίζει** (ωμό πεδίο, καμία «διόρθωση»)
 *   Μ8     τίποτα δεν αναφέρει το παλιό αρχείο ⇒ `null` (το ακίνητο δεν γράφεται)
 *   Μ9     η κλειστή λίστα **είναι** τα πεδία που διαβάζει η δήλωση — κανένα έκτο πεδίο δεν μένει πίσω
 */

import {
  AGENCY_DECLARATION_FIELDS,
  repointDeclarations,
  type AgencyDeclarationField,
} from '../declaration-succession';
import { agencyMediaDeclaration } from '@/services/listings/agency-media-publication';

const OLD = 'file_old';
const NEW = 'file_new';
const SPOT = { floorplanFileId: 'file_plan', x: 0.4, y: 0.6, headingRad: 1, fovRad: 1.2 };

describe('Α3γ — λίστες ταυτοτήτων', () => {
  it('✅ Μ1 — η νέα έκδοση παίρνει την ΙΔΙΑ θέση στη σειρά (το εξώφυλλο μένει εξώφυλλο)', () => {
    expect(repointDeclarations({ publishedMediaOrder: [OLD, 'b', 'c'] }, OLD, NEW)).toEqual({
      publishedMediaOrder: [NEW, 'b', 'c'],
    });
    expect(repointDeclarations({ publishedMediaOrder: ['a', OLD, 'c'] }, OLD, NEW)).toEqual({
      publishedMediaOrder: ['a', NEW, 'c'],
    });
  });

  it('🔑 Μ2 — διάδοχος ΗΔΗ δηλωμένος ⇒ κρατά τη δική του θέση· το παλιό απλώς φεύγει (καμία διπλοεγγραφή)', () => {
    expect(repointDeclarations({ publishedMediaOrder: [OLD, 'b', NEW] }, OLD, NEW)).toEqual({
      publishedMediaOrder: ['b', NEW],
    });
  });

  it('✅ Μ3 — η δηλωμένη κάτοψη ΜΕΝΕΙ δηλωμένη', () => {
    expect(repointDeclarations({ publishedFloorplans: ['p1', OLD] }, OLD, NEW)).toEqual({
      publishedFloorplans: ['p1', NEW],
    });
  });
});

describe('Α3γ — χάρτες ανά αρχείο', () => {
  it('✅ Μ4 — σημείο εστίασης και βορράς αλλάζουν ΚΛΕΙΔΙ, η τιμή μένει αυτούσια', () => {
    const patch = repointDeclarations(
      {
        publishedMediaFocalPoints: { [OLD]: { x: 0.2, y: 0.8 }, other: { x: 0.5, y: 0.5 } },
        publishedFloorplanNorth: { [OLD]: 1.57 },
      },
      OLD,
      NEW,
    );

    expect(patch).toEqual({
      publishedMediaFocalPoints: { other: { x: 0.5, y: 0.5 }, [NEW]: { x: 0.2, y: 0.8 } },
      publishedFloorplanNorth: { [NEW]: 1.57 },
    });
  });

  it('🔑 Μ5 — ό,τι δήλωσε ΗΔΗ ο άνθρωπος για τη νέα έκδοση νικά· η μεταφορά δεν το πατά', () => {
    const patch = repointDeclarations(
      { publishedMediaFocalPoints: { [OLD]: { x: 0.2, y: 0.8 }, [NEW]: { x: 0.9, y: 0.1 } } },
      OLD,
      NEW,
    );

    expect(patch).toEqual({ publishedMediaFocalPoints: { [NEW]: { x: 0.9, y: 0.1 } } });
  });

  it('🔴 Μ6 — αντικατάσταση ΚΑΤΟΨΗΣ: κάθε σημείο λήψης που έδειχνε σε αυτήν ακολουθεί', () => {
    const patch = repointDeclarations(
      {
        publishedPhotoCaptureSpots: {
          photo_a: { ...SPOT, floorplanFileId: OLD },
          photo_b: SPOT,
        },
      },
      OLD,
      NEW,
    );

    expect(patch).toEqual({
      publishedPhotoCaptureSpots: {
        photo_a: { ...SPOT, floorplanFileId: NEW },
        photo_b: SPOT,
      },
    });
  });

  it('✅ Μ6β — αντικατάσταση ΦΩΤΟΓΡΑΦΙΑΣ: το σημείο λήψης της περνά στη νέα, με την ίδια κάτοψη', () => {
    expect(repointDeclarations({ publishedPhotoCaptureSpots: { [OLD]: SPOT } }, OLD, NEW)).toEqual({
      publishedPhotoCaptureSpots: { [NEW]: SPOT },
    });
  });
});

describe('Α3γ — τα όρια της μεταφοράς', () => {
  it('🔴 Μ7 — ωμό πεδίο: γραμμές που ΔΕΝ καταλαβαίνει μένουν όπως ήταν (ποτέ «καθαρισμός» ως παρενέργεια)', () => {
    const patch = repointDeclarations(
      {
        publishedMediaOrder: [OLD, 42, '', null],
        publishedMediaFocalPoints: { [OLD]: 'σκουπίδι', broken: null },
      },
      OLD,
      NEW,
    );

    expect(patch).toEqual({
      publishedMediaOrder: [NEW, 42, '', null],
      publishedMediaFocalPoints: { broken: null, [NEW]: 'σκουπίδι' },
    });
  });

  it('✅ Μ8 — κανείς δεν αναφέρει το παλιό αρχείο ⇒ null (το ακίνητο ΔΕΝ γράφεται)', () => {
    expect(repointDeclarations({ publishedMediaOrder: ['a'], publishedFloorplans: 'όχι-πίνακας' }, OLD, NEW)).toBeNull();
    expect(repointDeclarations({}, OLD, NEW)).toBeNull();
    expect(repointDeclarations({ publishedMediaOrder: [OLD] }, OLD, OLD)).toBeNull();
    expect(repointDeclarations({ publishedMediaOrder: [OLD] }, OLD, '')).toBeNull();
  });

  it('🔒 Μ9 — η κλειστή λίστα ΕΙΝΑΙ ό,τι διαβάζει η δήλωση: κάθε πεδίο της μεταφέρεται ΚΑΙ διαβάζεται', () => {
    const fields = Object.keys(AGENCY_DECLARATION_FIELDS) as AgencyDeclarationField[];
    const property: Record<string, unknown> = {
      publishedMediaOrder: [OLD],
      publishedFloorplans: [OLD],
      publishedMediaFocalPoints: { [OLD]: { x: 0.2, y: 0.8 } },
      publishedPhotoCaptureSpots: { [OLD]: SPOT },
      publishedFloorplanNorth: { [OLD]: 1.57 },
    };
    // Κάθε γραμμή της λίστας έχει δείγμα εδώ — νέο πεδίο χωρίς δείγμα κοκκινίζει ΑΥΤΗ τη γραμμή.
    expect(Object.keys(property).sort()).toEqual([...fields].sort());

    const patch = repointDeclarations(property, OLD, NEW);
    expect(Object.keys(patch ?? {}).sort()).toEqual([...fields].sort());

    // Και ο ΠΡΑΓΜΑΤΙΚΟΣ αναγνώστης βρίσκει τη νέα έκδοση σε κάθε δήλωση — καμία δεν έμεινε στην παλιά.
    const declared = agencyMediaDeclaration({ ...property, ...patch });
    expect(declared.order).toEqual([NEW]);
    expect(declared.floorplans).toEqual([NEW]);
    expect(declared.focalPoints?.has(NEW)).toBe(true);
    expect(declared.captureSpots?.has(NEW)).toBe(true);
    expect(declared.floorplanNorth?.has(NEW)).toBe(true);
    expect(JSON.stringify([...(declared.focalPoints ?? [])]) + JSON.stringify(declared.order)).not.toContain(OLD);
  });
});
