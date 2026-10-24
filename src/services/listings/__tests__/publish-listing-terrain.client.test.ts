/**
 * ADR-920 Β4.7 — ΑΓΚΥΡΕΣ του **πελάτη** της δημοσίευσης τοπογραφικού.
 *
 *   Δ1  ένας κάτοχος ⇒ μία πόρτα: γραφείο → `PROPERTIES.TERRAIN` · ιδιοκτήτης → `OWNER_PROPERTIES.TERRAIN` (κωδικοποιημένο id)
 *   Α1  🏆 το multipart έχει ΑΚΡΙΒΩΣ δύο πεδία του συμβολαίου — κανένα πεδίο δημοσίευσης
 *   Α2  🏆 τα bytes της πηγής ΕΙΝΑΙ το `encoded` του `prepareSurveyUpload` (ό,τι κρίθηκε στην προεπισκόπηση), με τον τύπο της πόρτας
 *   Α3  η δήλωση φεύγει με τον ΕΝΑ κωδικοποιητή του συμβολαίου
 *   Α4  ένα κλειδί ανά προετοιμασία: δεύτερη αποστολή της ΙΔΙΑΣ ⇒ ίδιο κλειδί · νέα προετοιμασία ⇒ νέο
 *   Α5  επιτυχία: `listing` όπως το είπε η πόρτα· άγνωστη τιμή ⇒ `unknown` · χωρίς `fileId` ⇒ `rejected`, ποτέ «επιτυχία»
 *   Α6  αρχειοθετημένοι προκάτοχοι ⇒ `FILE_SUPERSEDED` για καθέναν — και ΜΟΝΟ για αυτούς, όχι για τους `supersedes`
 *   Ρ1  κωδικός της πόρτας ⇒ ο ίδιος (ως `errorCode` ή ως μήνυμα) · άλλη άρνηση ⇒ `rejected` · καμία απάντηση ⇒ `network`
 */

import { ApiClientError } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import {
  TERRAIN_SOURCE_CONTENT_TYPE,
  TERRAIN_UPLOAD_FIELDS,
} from '@/lib/terrain/publication/terrain-publication-contract';
import {
  encodeTerrainSurveyDeclaration,
  type TerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import { prepareSurveyUpload } from '@/lib/terrain/survey-import/survey-upload-preparation';
import type { TerrainPublishTarget } from '@/lib/terrain/publication/terrain-publish-target';
import type { TopoPoint } from '@/lib/terrain/terrain-types';
import { RealtimeService } from '@/services/realtime';

import {
  prepareTerrainPublication,
  publishListingTerrain,
  terrainEndpointOf,
  type PreparedTerrainPublication,
} from '../publish-listing-terrain.client';

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { post: jest.fn() } }));

const post = apiClient.post as jest.Mock;

const DECLARATION: TerrainSurveyDeclaration = { surveyorName: 'Τοπογράφος Α.Ε.', surveyedOn: '2026-09-01', rightsAffirmed: true };
const OFFICE: TerrainPublishTarget = { kind: 'property', propertyId: 'prop_1' };
const OWNER: TerrainPublishTarget = { kind: 'owner-property', ownerPropertyId: 'ownp_a/b' };

/** Οικόπεδο 30 × 20 m σε mm, πέντε σημεία με υψόμετρο — αρκετή επιφάνεια για τον κριτή. */
const SURVEY: readonly TopoPoint[] = [
  { x: 0, y: 0, z: 100_000 },
  { x: 30_000, y: 0, z: 101_000 },
  { x: 30_000, y: 20_000, z: 102_500 },
  { x: 0, y: 20_000, z: 101_500 },
  { x: 15_000, y: 10_000, z: 101_200 },
];

function encodedSurvey(): string {
  const preparation = prepareSurveyUpload(SURVEY);
  if (!preparation.ok) throw new Error(`το δείγμα δεν περνά τον κριτή: ${preparation.code}`);
  return preparation.encoded;
}

const prepared = (): PreparedTerrainPublication => prepareTerrainPublication(encodedSurvey(), DECLARATION);

function sentBody(): FormData {
  return post.mock.calls[0][1] as FormData;
}

let dispatch: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  dispatch = jest.spyOn(RealtimeService, 'dispatch').mockImplementation(() => undefined);
  post.mockResolvedValue({ fileId: 'file_new', supersedes: [], archived: [], listing: 'published' });
});

afterEach(() => dispatch.mockRestore());

describe('Δ — ένας κάτοχος, μία πόρτα', () => {
  it('Δ1 γραφείο ⇒ `/api/properties/{id}/terrain` · ιδιοκτήτης ⇒ `/api/owner-properties/{id}/terrain` (κωδικοποιημένο)', async () => {
    expect(terrainEndpointOf(OFFICE)).toBe('/api/properties/prop_1/terrain');
    expect(terrainEndpointOf(OWNER)).toBe('/api/owner-properties/ownp_a%2Fb/terrain');

    await publishListingTerrain(OWNER, prepared());
    expect(post.mock.calls[0][0]).toBe('/api/owner-properties/ownp_a%2Fb/terrain');
  });
});

describe('Α — τι φεύγει', () => {
  it('Α1 ακριβώς δύο πεδία: η πηγή και η δήλωση', async () => {
    await publishListingTerrain(OFFICE, prepared());
    expect([...sentBody().keys()].sort()).toStrictEqual([TERRAIN_UPLOAD_FIELDS.declaration, TERRAIN_UPLOAD_FIELDS.source].sort());
  });

  it('Α2 τα bytes της πηγής είναι το `encoded` της προεπισκόπησης, με τον τύπο που δέχεται η πόρτα', async () => {
    const publication = prepared();
    await publishListingTerrain(OFFICE, publication);

    const source = sentBody().get(TERRAIN_UPLOAD_FIELDS.source);
    expect(source).toBeInstanceOf(Blob);
    expect((source as Blob).type).toBe(TERRAIN_SOURCE_CONTENT_TYPE);
    expect(await (source as Blob).text()).toBe(publication.encodedSource);
  });

  it('Α3 η δήλωση με τον ΕΝΑ κωδικοποιητή του συμβολαίου', async () => {
    await publishListingTerrain(OFFICE, prepared());
    expect(sentBody().get(TERRAIN_UPLOAD_FIELDS.declaration)).toBe(encodeTerrainSurveyDeclaration(DECLARATION));
  });

  it('Α4 ίδια προετοιμασία ⇒ ίδιο κλειδί σε κάθε αποστολή · νέα προετοιμασία ⇒ νέο κλειδί', async () => {
    const publication = prepared();
    await publishListingTerrain(OFFICE, publication);
    await publishListingTerrain(OFFICE, publication);
    const keys = post.mock.calls.map((call) => (call[2] as { headers: Record<string, string> }).headers[IDEMPOTENCY_KEY_HEADER]);

    expect(keys[0]).toBe(publication.idempotencyKey);
    expect(keys[1]).toBe(publication.idempotencyKey);
    expect(prepared().idempotencyKey).not.toBe(publication.idempotencyKey);
  });

  it('Α5 `listing` όπως το είπε η πόρτα · άγνωστη τιμή ⇒ `unknown` · χωρίς `fileId` ⇒ `rejected`', async () => {
    expect(await publishListingTerrain(OFFICE, prepared())).toStrictEqual({ ok: true, fileId: 'file_new', listing: 'published' });

    post.mockResolvedValue({ fileId: 'file_new', archived: [], listing: 'teleported' });
    expect(await publishListingTerrain(OFFICE, prepared())).toStrictEqual({ ok: true, fileId: 'file_new', listing: 'unknown' });

    post.mockResolvedValue({ archived: [], listing: 'published' });
    expect(await publishListingTerrain(OFFICE, prepared())).toStrictEqual({ ok: false, refusal: 'rejected' });

    post.mockResolvedValue(null);
    expect(await publishListingTerrain(OFFICE, prepared())).toStrictEqual({ ok: false, refusal: 'rejected' });
  });

  it('Α6 `FILE_SUPERSEDED` μόνο για όσους αρχειοθέτησε η πόρτα, όχι για όσους απλώς ταυτοποίησε', async () => {
    post.mockResolvedValue({ fileId: 'file_new', supersedes: ['file_a', 'file_b'], archived: ['file_a'], listing: 'published' });
    await publishListingTerrain(OFFICE, prepared());

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('FILE_SUPERSEDED', expect.objectContaining({ fileId: 'file_a', supersededByFileId: 'file_new' }));
  });
});

describe('Ρ — αρνήσεις με όνομα', () => {
  it('Ρ1 κωδικός της πόρτας ⇒ ο ίδιος · άλλη άρνηση ⇒ `rejected` · καμία απάντηση ⇒ `network`', async () => {
    post.mockRejectedValue(new ApiClientError('Conflict', 409, 'TERRAIN_NO_DOSSIER'));
    expect(await publishListingTerrain(OWNER, prepared())).toStrictEqual({ ok: false, refusal: 'TERRAIN_NO_DOSSIER' });

    post.mockRejectedValue(new ApiClientError('TERRAIN_NOT_LAND', 422));
    expect(await publishListingTerrain(OFFICE, prepared())).toStrictEqual({ ok: false, refusal: 'TERRAIN_NOT_LAND' });

    post.mockRejectedValue(new ApiClientError('Forbidden', 403, 'ACCESS_DENIED'));
    expect(await publishListingTerrain(OFFICE, prepared())).toStrictEqual({ ok: false, refusal: 'rejected' });

    post.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await publishListingTerrain(OFFICE, prepared())).toStrictEqual({ ok: false, refusal: 'network' });
  });
});
