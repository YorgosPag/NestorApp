/**
 * ADR-931 §6 Β1 — «ρόλος → κλειδί σύνδεσης» ζει σε ΕΝΑΝ πίνακα (`ROLE_REQUIRES_LINK`)· τα helpers και το zod
 * παράγονται από αυτόν. Νέος ρόλος/κλειδί που ξεχνά έναν καθρέφτη κοκκινίζει εδώ.
 */

import {
  OVERLAY_LINK_KEYS,
  OVERLAY_ROLES,
  ROLE_ALLOWED_GEOMETRY,
  ROLE_REQUIRES_LINK,
  findMissingLink,
  linkedEntityIdOf,
  linkedEntityIdsOf,
  linkedPayloadFor,
  roleForLinkKey,
} from '@/types/floorplan-overlays';
import { CreateFloorplanOverlaySchema, OverlayRoleSchema } from '@/app/api/floorplan-overlays/floorplan-overlays.schemas';

const POLYGON = { type: 'polygon' as const, vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 0, y: 1000 }] };

describe('ROLE_REQUIRES_LINK — η ΜΙΑ αυθεντία', () => {
  it('common_space δένει με commonSpaceId και επιτρέπει μόνο πολύγωνο', () => {
    expect(ROLE_REQUIRES_LINK.common_space).toBe('commonSpaceId');
    expect(ROLE_ALLOWED_GEOMETRY.common_space).toEqual(['polygon']);
  });

  it('τα κλειδιά σύνδεσης είναι ΑΚΡΙΒΩΣ οι τιμές του πίνακα, και ο πίνακας είναι 1:1', () => {
    const values = Object.values(ROLE_REQUIRES_LINK);
    expect([...OVERLAY_LINK_KEYS].sort()).toEqual([...new Set(values)].sort());
    expect(new Set(values).size).toBe(values.length);
    for (const key of OVERLAY_LINK_KEYS) expect(ROLE_REQUIRES_LINK[roleForLinkKey(key)!]).toBe(key);
  });
});

describe('helpers σύνδεσης', () => {
  it('linkedEntityIdOf διαβάζει ΜΟΝΟ το κλειδί του ρόλου', () => {
    const linked = { propertyId: 'p1', commonSpaceId: 'c1' };
    expect(linkedEntityIdOf('common_space', linked)).toBe('c1');
    expect(linkedEntityIdOf('property', linked)).toBe('p1');
    expect(linkedEntityIdOf('footprint', linked)).toBeUndefined();
    expect(linkedEntityIdOf('common_space', { commonSpaceId: '' })).toBeUndefined();
  });

  it('linkedPayloadFor ⇄ linkedEntityIdOf για κάθε ρόλο με σύνδεση', () => {
    for (const role of OVERLAY_ROLES) {
      const payload = linkedPayloadFor(role, 'x1');
      if (ROLE_REQUIRES_LINK[role] === undefined) expect(payload).toBeUndefined();
      else expect(linkedEntityIdOf(role, payload)).toBe('x1');
    }
  });

  it('linkedEntityIdsOf βλέπει ΚΑΘΕ κλειδί — και το νέο', () => {
    expect(linkedEntityIdsOf({ storageId: 's1', commonSpaceId: 'c1' }).sort()).toEqual(['c1', 's1']);
    expect(linkedEntityIdsOf(undefined)).toEqual([]);
  });

  it('findMissingLink: common_space με linked χωρίς commonSpaceId ⇒ λείπει', () => {
    expect(findMissingLink('common_space', { propertyId: 'p1' })).toBe('commonSpaceId');
    expect(findMissingLink('common_space', undefined)).toBeNull();
  });
});

describe('zod — παράγεται από το SSoT, όχι χειρόγραφο', () => {
  it('δέχεται κάθε ρόλο του OVERLAY_ROLES', () => {
    for (const role of OVERLAY_ROLES) expect(OverlayRoleSchema.safeParse(role).success).toBe(true);
  });

  it('δέχεται linked.commonSpaceId και αρνείται άγνωστο κλειδί (.strict)', () => {
    const base = { floorId: 'f1', geometry: POLYGON, role: 'common_space' };
    expect(CreateFloorplanOverlaySchema.safeParse({ ...base, linked: { commonSpaceId: 'c1' } }).success).toBe(true);
    expect(CreateFloorplanOverlaySchema.safeParse({ ...base, linked: { roomId: 'r1' } }).success).toBe(false);
  });
});
