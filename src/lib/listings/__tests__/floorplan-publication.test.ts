/**
 * @fileoverview **Η ΠΑΡΑΓΟΜΕΝΗ ΚΑΤΟΨΗ, ΑΠΟ ΤΟΝ ΓΡΑΦΕΑ ΩΣ ΤΟ ΔΗΜΟΣΙΟ ΕΓΓΡΑΦΟ** — ADR-909 Β1.
 * @related lib/listings/floorplan-{file-record,publication-identity,render-recipe,level-binding}
 *
 * 🔴 **Η ΡΑΦΗ ΕΙΝΑΙ Η ΕΡΩΤΗΣΗ** *(το μάθημα του Ο-13)*: το έγγραφο εδώ το **γεννά ο κατασκευαστής της
 * πόρτας**, ποτέ fixture γραμμένο με το χέρι — και περνά από τον **πραγματικό** επιλογέα και τον
 * **πραγματικό** γραφέα της προβολής. Fixture που έγραφε `publicationIdentity` μόνο του θα έμενε πράσινο
 * τη μέρα που ο κατασκευαστής θα έπαυε να το γράφει.
 */

import { FILE_STATUS } from '@/config/domain-constants';
import { agencyMediaMaterial, type AgencyMediaCandidate } from '@/services/listings/agency-media-publication';
import { supersededByPublication } from '@/services/listings/agency-media-selection';
import { withPublishedGallery } from '@/services/listings/public-listing-projection';
import type { ProjectedShelfImage } from '@/services/listings/public-listing-projection';
import type { PublicListing } from '@/types/public-listing';
import { LISTING_FILE_PUBLICATION_FIELDS } from '../listing-file-publication-fields';
import { buildPublishedFloorplanFileRecord } from '../floorplan-file-record';
import { levelServesProperty } from '../floorplan-level-binding';
import {
  floorplanPublicationIdentityKey,
  isMeasuredFloorplanIdentityKey,
} from '../floorplan-publication-identity';
import {
  PNG_HEADER_BYTES,
  PUBLIC_FLOORPLAN_PROFILE,
  decodeFloorplanRenderRecipe,
  pngDimensionsOf,
  readFloorplanRenderRecipe,
  recipeMatchesBytes,
  type FloorplanRenderRecipe,
} from '../floorplan-render-recipe';
import { isModelIdentityKey, modelPublicationIdentityKey } from '../model-publication-identity';

const AT = '2026-10-08T12:00:00.000Z';
const LEVEL = 'lvl_2a7ff5cc-4901-4dda-84f4-a2a243886dc2';
const SCENE = 'file_227cec18-a868-440f-8aa8-a32a7d7133c3';

function recipe(over: Partial<FloorplanRenderRecipe> = {}): FloorplanRenderRecipe {
  return {
    profileId: PUBLIC_FLOORPLAN_PROFILE.id,
    profileVersion: PUBLIC_FLOORPLAN_PROFILE.version,
    frame: { minX: 0, minY: 0, maxX: 12000, maxY: 9000 },
    widthPx: 2560,
    heightPx: 1920,
    plotStyle: 'colour',
    groups: ['furniture', 'texts'],
    ...over,
  };
}

/** Κεφαλίδα PNG με τις ζητούμενες διαστάσεις — ακριβώς τα bytes που διαβάζει ο κριτής. */
function pngHeader(widthPx: number, heightPx: number): Uint8Array {
  const bytes = new Uint8Array(PNG_HEADER_BYTES);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, widthPx);
  new DataView(bytes.buffer).setUint32(20, heightPx);
  return bytes;
}

/** Το έγγραφο όπως θα καθόταν στη βάση **αφού** η πόρτα το οριστικοποιήσει. */
function bornFloorplan(levelId = LEVEL): AgencyMediaCandidate {
  const { recordBase } = buildPublishedFloorplanFileRecord({
    companyId: 'comp_alfa',
    propertyId: 'prop_1',
    createdBy: 'user_1',
    levelId,
    sourceRevisions: [{ fileId: SCENE, revision: 5 }],
    renderRecipe: recipe(),
  });
  return { ...recordBase, status: FILE_STATUS.READY, createdAt: AT } as AgencyMediaCandidate;
}

function shelfImage(over: Partial<ProjectedShelfImage>): ProjectedShelfImage {
  return {
    url: 'https://shelf/plan.webp', width: 1280, height: 960, sources: [], material: { kind: 'photo' },
    declaredFocalPoint: null, detectedFocalPoint: null, sourceFileId: null, declaredCaptureSpot: null,
    declaredNorthRad: null, ...over,
  };
}

const LISTING = {
  id: 'prop_1', authorship: 'agency', coverImage: null, gallery: [], floorplans: [],
} as unknown as PublicListing;

describe('ADR-909 Β1 — η ταυτότητα της παραγόμενης κάτοψης', () => {
  it('Τ1 — ίδιο επίπεδο ⇒ ίδιο κλειδί· άλλο επίπεδο ⇒ άλλο', () => {
    expect(floorplanPublicationIdentityKey(LEVEL)).toBe(`floorplan/measured/${LEVEL}`);
    expect(floorplanPublicationIdentityKey('lvl_b')).not.toBe(floorplanPublicationIdentityKey(LEVEL));
  });

  it('Τ2 — δεν συγκρούεται ΠΟΤΕ με ταυτότητα μοντέλου', () => {
    const model = modelPublicationIdentityKey({ provenance: 'measured', scope: 'active-floor', state: 'as-built' });

    expect(isMeasuredFloorplanIdentityKey(model)).toBe(false);
    expect(isModelIdentityKey(floorplanPublicationIdentityKey(LEVEL))).toBe(false);
  });

  it('Τ3 — κλειδί που θα συγχώνευε επίπεδα ΔΕΝ γεννιέται', () => {
    expect(() => floorplanPublicationIdentityKey('')).toThrow();
    expect(() => floorplanPublicationIdentityKey('lvl_a/lvl_b')).toThrow();
  });

  it('Τ4 — «δεν ξέρω» δεν είναι «μετρημένη»: απόν, κενό, σκέτο πρόθεμα', () => {
    for (const value of [undefined, null, '', 'floorplan/measured/', 'floorplan/declared/x', 7]) {
      expect(isMeasuredFloorplanIdentityKey(value)).toBe(false);
    }
  });
});

describe('ADR-909 Β1 — η συνταγή απόδοσης', () => {
  it('Σ1 — η τρέχουσα συνταγή διαβάζεται, και ό,τι ΕΠΙΠΛΕΟΝ έστειλε ο πελάτης πετιέται', () => {
    const reading = readFloorplanRenderRecipe({ ...recipe(), classification: 'public', extra: 1 });

    expect(reading).toEqual({ ok: true, recipe: recipe() });
  });

  it('Σ2 — άλλο προφίλ και άλλη ΕΚΔΟΣΗ προφίλ αρνούνται με ΔΙΑΦΟΡΕΤΙΚΟ όνομα', () => {
    expect(readFloorplanRenderRecipe(recipe({ profileId: 'engineer-view' }))).toEqual({ ok: false, why: 'unknown-profile' });
    expect(readFloorplanRenderRecipe(recipe({ profileVersion: PUBLIC_FLOORPLAN_PROFILE.version + 1 })))
      .toEqual({ ok: false, why: 'stale-profile' });
  });

  it.each([
    ['ανάποδο κάδρο', { frame: { minX: 10, minY: 0, maxX: 0, maxY: 5 } }],
    ['μηδενικό εμβαδόν', { frame: { minX: 0, minY: 0, maxX: 0, maxY: 5 } }],
    ['μη πεπερασμένο κάδρο', { frame: { minX: 0, minY: 0, maxX: Number.NaN, maxY: 5 } }],
    ['μηδενικό πλάτος', { widthPx: 0 }],
    ['κλασματικό ύψος', { heightPx: 10.5 }],
    ['υπερβολικό πλάτος', { widthPx: 100000 }],
    ['ύφος με κενά', { plotStyle: 'my style' }],
    ['άγνωστη ομάδα', { groups: ['holograms'] }],
    ['ομάδες εκτός κανονικής σειράς', { groups: ['texts', 'furniture'] }],
    ['διπλή ομάδα', { groups: ['texts', 'texts'] }],
    ['ομάδες που δεν είναι λίστα', { groups: 'furniture' }],
    ['παλιά συνταγή με `furniture` αντί για ομάδες', { groups: undefined, furniture: true }],
  ])('Σ3 — %s ⇒ δεν είναι συνταγή', (_name, over) => {
    expect(readFloorplanRenderRecipe(recipe(over as Partial<FloorplanRenderRecipe>))).toEqual({ ok: false, why: 'malformed' });
  });

  it('Σ4 — από το σύρμα: μη JSON, κενό, ή μη κείμενο ⇒ άρνηση, ποτέ ρίψη', () => {
    expect(decodeFloorplanRenderRecipe('{not json')).toEqual({ ok: false, why: 'malformed' });
    expect(decodeFloorplanRenderRecipe('')).toEqual({ ok: false, why: 'malformed' });
    expect(decodeFloorplanRenderRecipe(null)).toEqual({ ok: false, why: 'malformed' });
    expect(decodeFloorplanRenderRecipe(JSON.stringify(recipe()))).toEqual({ ok: true, recipe: recipe() });
  });

  it('Σ5 — τα BYTES μαρτυρούν τις διαστάσεις: συμφωνία, ασυμφωνία, και «δεν είναι PNG»', () => {
    expect(pngDimensionsOf(pngHeader(2560, 1920))).toEqual({ widthPx: 2560, heightPx: 1920 });
    expect(recipeMatchesBytes(recipe(), pngHeader(2560, 1920))).toBe(true);
    expect(recipeMatchesBytes(recipe(), pngHeader(2560, 1921))).toBe(false);

    const jpeg = new Uint8Array(PNG_HEADER_BYTES).fill(0xff);
    expect(pngDimensionsOf(jpeg)).toBeNull();
    expect(recipeMatchesBytes(recipe(), jpeg)).toBe(false);
    expect(pngDimensionsOf(pngHeader(1, 1).slice(0, 10))).toBeNull();
  });

  it('Σ6 — η κεφαλίδα διαβάζεται σωστά και μέσα σε ΜΕΓΑΛΥΤΕΡΟ buffer με μετατόπιση', () => {
    const padded = new Uint8Array(PNG_HEADER_BYTES + 8);
    padded.set(pngHeader(640, 480), 8);

    expect(pngDimensionsOf(padded.subarray(8))).toEqual({ widthPx: 640, heightPx: 480 });
  });
});

describe('ADR-909 Β1 — ο δεσμός επιπέδου ↔ ακινήτου', () => {
  const level = { buildingId: 'bldg_1', floorId: 'flr_1' };

  it('Δ1 — ίδιο κτίριο, ίδιος όροφος ⇒ εξυπηρετεί', () => {
    expect(levelServesProperty(level, { buildingId: 'bldg_1', floorId: 'flr_1' })).toEqual({ ok: true });
  });

  it('Δ2 — άλλο κτίριο ⇒ άρνηση· ακίνητο ΧΩΡΙΣ κτίριο δεν «ταιριάζει» με τίποτα', () => {
    expect(levelServesProperty(level, { buildingId: 'bldg_2', floorId: 'flr_1' })).toEqual({ ok: false, why: 'other-building' });
    expect(levelServesProperty(level, { floorId: 'flr_1' })).toEqual({ ok: false, why: 'other-building' });
  });

  it('Δ3 — ίδιο κτίριο, όροφος που το ακίνητο ΔΕΝ καταλαμβάνει ⇒ άρνηση', () => {
    expect(levelServesProperty(level, { buildingId: 'bldg_1', floorId: 'flr_3' })).toEqual({ ok: false, why: 'other-floor' });
  });

  it('Δ4 — μεζονέτα: ΚΑΘΕ όροφός της εξυπηρετείται, όχι μόνο ο κύριος', () => {
    const maisonette = {
      buildingId: 'bldg_1', floorId: 'flr_0',
      levels: [{ floorId: 'flr_0', isPrimary: true }, { floorId: 'flr_1', isPrimary: false }],
    };

    expect(levelServesProperty(level, maisonette)).toEqual({ ok: true });
  });

  it('Δ5 — επίπεδο χωρίς κτίριο δεν αποδεικνύει τίποτα ⇒ άρνηση με ΔΙΚΟ ΤΟΥ όνομα', () => {
    expect(levelServesProperty({ floorId: 'flr_1' }, { buildingId: 'bldg_1' })).toEqual({ ok: false, why: 'level-unplaced' });
    expect(levelServesProperty({ buildingId: '' }, { buildingId: '' })).toEqual({ ok: false, why: 'level-unplaced' });
  });

  it('Δ6 — «δεν ξέρω όροφο» δεν σημαίνει «άλλος όροφος»', () => {
    expect(levelServesProperty({ buildingId: 'bldg_1' }, { buildingId: 'bldg_1', floorId: 'flr_1' })).toEqual({ ok: true });
    expect(levelServesProperty(level, { buildingId: 'bldg_1' })).toEqual({ ok: true });
  });
});

describe('ADR-909 Β1 — 🏆 η ραφή: κατασκευαστής → επιλογέας → δημόσιο έγγραφο', () => {
  it('Ρ1 — το έγγραφο που ΓΕΝΝΑ ο κατασκευαστής φέρει προέλευση, έκδοση σχεδίου ΚΑΙ συνταγή', () => {
    const born = bornFloorplan() as unknown as Record<string, unknown>;

    expect(born.publicationIdentity).toBe(`floorplan/measured/${LEVEL}`);
    expect(born.classification).toBe('public');
    expect(born.category).toBe('floorplans');
    expect(born.contentType).toBe('image/png');
    expect(born.sourceRevisions).toEqual([{ fileId: SCENE, revision: 5 }]);
    expect(born.renderRecipe).toEqual(recipe());
  });

  it('Ρ2 — η συνταγή ΔΕΝ είναι πεδίο του κατηγορήματος δημοσίευσης: τα 13 μένουν 13', () => {
    expect(LISTING_FILE_PUBLICATION_FIELDS).toHaveLength(13);
    expect(LISTING_FILE_PUBLICATION_FIELDS).not.toContain('renderRecipe');
  });

  it('Ρ3 — δηλωμένη ⇒ φεύγει ως ΜΕΤΡΗΜΕΝΗ κάτοψη, με τη στιγμή της εγγραφής', () => {
    const born = bornFloorplan();

    expect(agencyMediaMaterial(born, new Set([born.id]))).toEqual({ kind: 'floorplan', at: AT, provenance: 'measured' });
  });

  it('Ρ4 — ⛔ ΧΩΡΙΣ ονομαστική δήλωση ΔΕΝ φεύγει — η παραγόμενη δεν εξαιρείται από τον φρουρό', () => {
    expect(agencyMediaMaterial(bornFloorplan(), new Set())).toBeNull();
  });

  it('Ρ5 — η χειροκίνητη κάτοψη μένει ΔΗΛΩΜΕΝΗ, ακριβώς όπως πριν', () => {
    const manual = { ...bornFloorplan(), id: 'file_manual', publicationIdentity: undefined } as AgencyMediaCandidate;

    expect(agencyMediaMaterial(manual, new Set(['file_manual']))).toEqual({ kind: 'floorplan', at: AT, provenance: 'declared' });
  });

  it('Ρ6 — το δημόσιο έγγραφο γράφει την προέλευση ΤΟΥ ΥΛΙΚΟΥ, δεν την καρφώνει', () => {
    const born = bornFloorplan();
    const measured = agencyMediaMaterial(born, new Set([born.id]));
    const declared = agencyMediaMaterial(
      { ...born, id: 'file_manual', publicationIdentity: undefined } as AgencyMediaCandidate, new Set(['file_manual']),
    );
    if (measured === null || declared === null) throw new Error('fixture: και οι δύο κατόψεις οφείλουν να φεύγουν');

    const { floorplans } = withPublishedGallery(LISTING, [
      shelfImage({ url: 'https://shelf/measured.webp', material: measured }),
      shelfImage({ url: 'https://shelf/declared.webp', material: declared }),
    ]);

    expect(floorplans.map((plan) => plan.provenance)).toEqual(['measured', 'declared']);
    expect(floorplans.every((plan) => plan.at === AT)).toBe(true);
  });

  it('Ρ7 — νέα δημοσίευση του ΙΔΙΟΥ επιπέδου διαδέχεται· άλλου επιπέδου ή χειροκίνητη, ΠΟΤΕ', () => {
    const previous = { ...bornFloorplan(), id: 'file_prev' } as AgencyMediaCandidate;
    const otherLevel = { ...bornFloorplan('lvl_other'), id: 'file_other' } as AgencyMediaCandidate;
    const manual = { ...bornFloorplan(), id: 'file_manual', publicationIdentity: undefined } as AgencyMediaCandidate;

    expect(supersededByPublication([previous, otherLevel, manual], bornFloorplan())).toEqual(['file_prev']);
  });
});
