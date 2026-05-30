/**
 * ADR-399 — cross-floor link guard unit tests.
 *
 * Locks the level↔scene isolation invariant: a level only loads a scene file that
 * belongs to its own floor. Regression guard for the "every floor renders the same
 * scene" bug (a floor's level was linked to another floor's `sceneFileId`).
 */

import { isCrossFloorSceneLink } from '../cross-floor-link';

describe('isCrossFloorSceneLink', () => {
  it('flags a floor-scoped file that belongs to a DIFFERENT floor', () => {
    expect(
      isCrossFloorSceneLink({ entityType: 'floor', entityId: 'flr_A' }, 'flr_B'),
    ).toBe(true);
  });

  it('allows a floor-scoped file that belongs to the SAME floor', () => {
    expect(
      isCrossFloorSceneLink({ entityType: 'floor', entityId: 'flr_A' }, 'flr_A'),
    ).toBe(false);
  });

  it('allows when the level has no floorId (legacy / file-less level)', () => {
    expect(isCrossFloorSceneLink({ entityType: 'floor', entityId: 'flr_A' }, null)).toBe(false);
    expect(isCrossFloorSceneLink({ entityType: 'floor', entityId: 'flr_A' }, undefined)).toBe(false);
    expect(isCrossFloorSceneLink({ entityType: 'floor', entityId: 'flr_A' }, '')).toBe(false);
  });

  it('allows project / building-scoped scenes (not floor-scoped)', () => {
    expect(isCrossFloorSceneLink({ entityType: 'project', entityId: 'proj_A' }, 'flr_B')).toBe(false);
    expect(isCrossFloorSceneLink({ entityType: 'building', entityId: 'bldg_A' }, 'flr_B')).toBe(false);
    expect(isCrossFloorSceneLink({ entityType: 'property', entityId: 'prop_A' }, 'flr_B')).toBe(false);
  });

  it('allows when the file carries no entityId', () => {
    expect(isCrossFloorSceneLink({ entityType: 'floor' }, 'flr_B')).toBe(false);
    expect(isCrossFloorSceneLink({ entityType: 'floor', entityId: '' }, 'flr_B')).toBe(false);
  });

  it('is null/undefined safe on the fileRecord', () => {
    expect(isCrossFloorSceneLink(null, 'flr_B')).toBe(false);
    expect(isCrossFloorSceneLink(undefined, 'flr_B')).toBe(false);
  });
});
