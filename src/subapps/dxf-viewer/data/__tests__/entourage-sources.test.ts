/**
 * ADR-654 M6 / ADR-655 — τα entourage URLs είναι σύγχρονα, same-origin, versioned (φορητά dev↔prod).
 *
 * Κλειδώνει το σχήμα του proxy URL ανά pack + variant, ώστε ένα αποθηκευμένο `ImageEntity.url` να
 * μη σπάσει σιωπηλά αν αλλάξει ο resolver.
 */

import {
  PEOPLE_PLAN_PACK_ID,
  VEHICLES_PLAN_PACK_ID,
  resolvePeoplePlanUrl,
  resolveVehiclesPlanUrl,
} from '../entourage-plan-sources';
import { resolveEntourageUrl } from '../entourage-source';

describe('entourage source resolvers — proxy URL shape', () => {
  it('άνθρωπος: full → /api/asset-packs/people-plan-2d/v1/<id>.webp', () => {
    expect(resolvePeoplePlanUrl('ppl-obj-001-1')).toBe(
      '/api/asset-packs/people-plan-2d/v1/ppl-obj-001-1.webp',
    );
  });

  it('άνθρωπος: thumb → …/<id>.thumb.webp', () => {
    expect(resolvePeoplePlanUrl('ppl-obj-001-1', 'thumb')).toBe(
      '/api/asset-packs/people-plan-2d/v1/ppl-obj-001-1.thumb.webp',
    );
  });

  it('όχημα: full/thumb με το δικό του pack id', () => {
    expect(resolveVehiclesPlanUrl('veh-obj-010-1')).toBe(
      '/api/asset-packs/vehicles-plan-2d/v1/veh-obj-010-1.webp',
    );
    expect(resolveVehiclesPlanUrl('veh-obj-010-1', 'thumb')).toBe(
      '/api/asset-packs/vehicles-plan-2d/v1/veh-obj-010-1.thumb.webp',
    );
  });

  it('τα per-pack ids ταιριάζουν με το registry', () => {
    expect(PEOPLE_PLAN_PACK_ID).toBe('people-plan-2d');
    expect(VEHICLES_PLAN_PACK_ID).toBe('vehicles-plan-2d');
  });

  it('άγνωστο pack id → hard error (ποτέ σιωπηλό κενό URL)', () => {
    // @ts-expect-error δοκιμή runtime guard με μη-έγκυρο pack id
    expect(() => resolveEntourageUrl('nope', 'x')).toThrow(/unknown asset pack/);
  });
});
