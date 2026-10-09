/**
 * ADR-909 Β2.4 — ΑΓΚΥΡΕΣ του **πελάτη** της δημοσίευσης κάτοψης.
 *
 *   Ε1  η εικόνα φτιάχνεται από το ΕΝΕΡΓΟ επίπεδο — και μόνο από αυτό
 *   Ε2  χωρίς ενεργό επίπεδο με σχέδιο ⇒ `no-level`, χωρίς λήψη · άρνηση λήψης ⇒ με το όνομά της
 *   Ε3  νέα εικόνα ⇒ νέο κλειδί ιδεμποτίας
 *   Α1  🏆 το multipart έχει ΑΚΡΙΒΩΣ τρία πεδία — κανένα από τα 13 πεδία δημοσίευσης
 *   Α2  🏆 τα bytes της αποστολής ΕΙΝΑΙ τα bytes της προετοιμασμένης εικόνας
 *   Α3  το αίτημα φέρει το `Idempotency-Key` της εικόνας· δεύτερη αποστολή της ΙΔΙΑΣ ⇒ ίδιο κλειδί
 *   Α4  επιτυχία: `declared` / `listing` όπως τα είπε ο διακομιστής· άγνωστη τιμή ⇒ `unknown`, ποτέ εικασία
 *   Α5  ο διακομιστής ανακοίνωσε αρχειοθετημένους ⇒ `FILE_SUPERSEDED` για καθέναν
 *   Ρ1  άρνηση της πόρτας ⇒ ο κωδικός της· άλλη άρνηση ⇒ `rejected`· καμία απάντηση ⇒ `network`
 */

import { ApiClientError } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { PUBLIC_FLOORPLAN_PROFILE, type FloorplanRenderRecipe } from '@/lib/listings/floorplan-render-recipe';
import { RealtimeService } from '@/services/realtime';

import type { ExportDeps } from '../../../export/types';
import type { SceneModel } from '../../../types/entities';
import { capturePublicFloorplan } from '../../../print/public-floorplan/capture-public-floorplan';
import {
  DEFAULT_PUBLIC_FLOORPLAN_CHOICE as LISTING,
  type PublicFloorplanChoice,
} from '../../../print/public-floorplan/public-floorplan-presets';
import {
  prepareFloorplanPublication,
  publishFloorplanToProperty,
  type PreparedFloorplan,
} from '../publish-floorplan-to-property';

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { post: jest.fn() } }));
jest.mock('../../../print/public-floorplan/capture-public-floorplan', () => ({ capturePublicFloorplan: jest.fn() }));

const post = apiClient.post as jest.Mock;
const capture = capturePublicFloorplan as jest.Mock;

const RECIPE: FloorplanRenderRecipe = {
  profileId: PUBLIC_FLOORPLAN_PROFILE.id,
  profileVersion: PUBLIC_FLOORPLAN_PROFILE.version,
  frame: { minX: 0, minY: 0, maxX: 15, maxY: 9 },
  widthPx: 4096,
  heightPx: 2458,
  plotStyle: 'monochrome',
  groups: ['texts', 'hatches', 'orientation'],
};
const FURNISHED: PublicFloorplanChoice = { groups: ['furniture', 'texts', 'hatches', 'orientation'], plotStyle: 'grayscale' };
const COUNTS = { furniture: 0, electrical: 0, heating: 0, plumbing: 0, texts: 0, hatches: 0, orientation: 0 };
const PNG = new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' });

const sceneA = { entities: [{ id: 'a' }] } as unknown as SceneModel;
const sceneB = { entities: [{ id: 'b' }] } as unknown as SceneModel;

function depsOf(activeLevelId: string | null): ExportDeps {
  return {
    levelScenes: [
      { level: { id: 'lvl_a' }, scene: sceneA },
      { level: { id: 'lvl_b' }, scene: sceneB },
    ],
    activeLevelId,
    projectName: 'p',
    dateStr: '2026-10-08',
  } as unknown as ExportDeps;
}

const prepared = (key = 'idk_1'): PreparedFloorplan =>
  ({ blob: PNG, recipe: RECIPE, levelId: 'lvl_b', idempotencyKey: key, unruledTypes: [], fidelity: [], groupCounts: COUNTS });

beforeEach(() => {
  jest.clearAllMocks();
  capture.mockResolvedValue({ ok: true, blob: PNG, recipe: RECIPE, unruledTypes: ['hologram'], fidelity: [], groupCounts: COUNTS });
  post.mockResolvedValue({ fileId: 'file_new', archived: [], declared: 'declared', listing: 'published' });
});

describe('Ε — η προετοιμασία της εικόνας', () => {
  it('Ε1 από το ΕΝΕΡΓΟ επίπεδο, και μόνο από αυτό', async () => {
    const result = await prepareFloorplanPublication(depsOf('lvl_b'), FURNISHED);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith({ scene: sceneB, choice: FURNISHED });
    if (!result.ok) throw new Error('expected a prepared image');
    expect(result.prepared).toMatchObject({ levelId: 'lvl_b', recipe: RECIPE, unruledTypes: ['hologram'] });
    expect(result.prepared.blob).toBe(PNG);
  });

  it('Ε2 χωρίς ενεργό επίπεδο με σχέδιο ⇒ `no-level` · άρνηση λήψης ⇒ με το όνομά της', async () => {
    expect(await prepareFloorplanPublication(depsOf(null), LISTING)).toStrictEqual({ ok: false, refusal: 'no-level' });
    expect(await prepareFloorplanPublication(depsOf('lvl_unloaded'), LISTING)).toStrictEqual({ ok: false, refusal: 'no-level' });
    expect(capture).not.toHaveBeenCalled();

    capture.mockResolvedValue({ ok: false, why: 'no-geometry' });
    expect(await prepareFloorplanPublication(depsOf('lvl_a'), LISTING)).toStrictEqual({ ok: false, refusal: 'no-geometry' });
  });

  it('Ε3 νέα εικόνα ⇒ νέο κλειδί ιδεμποτίας', async () => {
    const first = await prepareFloorplanPublication(depsOf('lvl_a'), LISTING);
    const second = await prepareFloorplanPublication(depsOf('lvl_a'), LISTING);

    if (!first.ok || !second.ok) throw new Error('expected prepared images');
    expect(first.prepared.idempotencyKey).not.toBe('');
    expect(second.prepared.idempotencyKey).not.toBe(first.prepared.idempotencyKey);
  });
});

describe('Α — η αποστολή', () => {
  const sentBody = (call = 0): FormData => post.mock.calls[call][1] as FormData;
  const sentHeaders = (call = 0): Record<string, string> => (post.mock.calls[call][2] as { headers: Record<string, string> }).headers;

  it('Α1 🏆 ΑΚΡΙΒΩΣ τρία πεδία, στη σωστή διεύθυνση', async () => {
    await publishFloorplanToProperty('prop_1', prepared());

    expect(post.mock.calls[0][0]).toBe('/api/properties/prop_1/floorplan');
    expect([...sentBody().keys()].sort()).toStrictEqual(['file', 'levelId', 'recipe']);
    expect(sentBody().get('levelId')).toBe('lvl_b');
    expect(JSON.parse(String(sentBody().get('recipe')))).toStrictEqual(RECIPE);
  });

  it('Α2 🏆 τα bytes της αποστολής ΕΙΝΑΙ τα bytes της προετοιμασμένης εικόνας', async () => {
    await publishFloorplanToProperty('prop_1', prepared());

    const file = sentBody().get('file') as File;
    expect(file.type).toBe('image/png');
    expect(new Uint8Array(await file.arrayBuffer())).toStrictEqual(new Uint8Array(await PNG.arrayBuffer()));
  });

  it('Α3 το αίτημα φέρει το κλειδί της εικόνας· δεύτερη αποστολή της ΙΔΙΑΣ ⇒ ίδιο κλειδί', async () => {
    const image = prepared('idk_same');
    await publishFloorplanToProperty('prop_1', image);
    await publishFloorplanToProperty('prop_1', image);

    expect(sentHeaders(0)).toStrictEqual({ 'Idempotency-Key': 'idk_same' });
    expect(sentHeaders(1)).toStrictEqual({ 'Idempotency-Key': 'idk_same' });
  });

  it('Α4 επιτυχία όπως την είπε ο διακομιστής· άγνωστη τιμή ⇒ `unknown`', async () => {
    expect(await publishFloorplanToProperty('prop_1', prepared()))
      .toStrictEqual({ ok: true, fileId: 'file_new', declared: 'declared', listing: 'published' });

    post.mockResolvedValue({ fileId: 'file_new', declared: 'maybe', listing: 42 });
    expect(await publishFloorplanToProperty('prop_1', prepared()))
      .toStrictEqual({ ok: true, fileId: 'file_new', declared: 'unknown', listing: 'unknown' });

    post.mockResolvedValue({ declared: 'declared' });
    expect(await publishFloorplanToProperty('prop_1', prepared())).toStrictEqual({ ok: false, refusal: 'rejected' });
  });

  it('Α5 αρχειοθετημένοι προκάτοχοι ⇒ `FILE_SUPERSEDED` για καθέναν', async () => {
    const seen: unknown[] = [];
    const unsubscribe = RealtimeService.subscribe('FILE_SUPERSEDED', (payload) => { seen.push(payload); });
    post.mockResolvedValue({ fileId: 'file_new', archived: ['file_old', 7, ''], declared: 'already', listing: 'published' });

    await publishFloorplanToProperty('prop_1', prepared());
    unsubscribe();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ fileId: 'file_old', supersededByFileId: 'file_new' });
  });
});

describe('Ρ — οι αρνήσεις', () => {
  it('Ρ1 κωδικός της πόρτας ⇒ ο ίδιος · άλλη άρνηση ⇒ `rejected` · καμία απάντηση ⇒ `network`', async () => {
    post.mockRejectedValue(new ApiClientError('FLOORPLAN_SHELF_FULL', 409));
    expect(await publishFloorplanToProperty('prop_1', prepared())).toStrictEqual({ ok: false, refusal: 'FLOORPLAN_SHELF_FULL' });

    post.mockRejectedValue(new ApiClientError('Conflict', 409, 'FLOORPLAN_LEVEL_UNPLACED'));
    expect(await publishFloorplanToProperty('prop_1', prepared())).toStrictEqual({ ok: false, refusal: 'FLOORPLAN_LEVEL_UNPLACED' });

    post.mockRejectedValue(new ApiClientError('Forbidden', 403, 'ACCESS_DENIED'));
    expect(await publishFloorplanToProperty('prop_1', prepared())).toStrictEqual({ ok: false, refusal: 'rejected' });

    post.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await publishFloorplanToProperty('prop_1', prepared())).toStrictEqual({ ok: false, refusal: 'network' });
  });
});
