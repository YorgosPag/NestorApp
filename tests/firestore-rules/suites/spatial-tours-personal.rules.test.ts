/**
 * Firestore Rules — `spatial_tours_personal` (ADR-884 Φ0.9 · προσωπικό διαμέρισμα)
 *
 * Σχήμα κανόνα: read/list = `resource.data.userId == request.auth.uid` · κάθε εγγραφή `if false`.
 * Ίδιο σύνορο με τον φάκελο ακινήτου — δες `_harness/author-owned-server-written-suite.ts`. Ο ιδιώτης **δεν**
 * έχει companyId (`CustodyScope`), άρα ούτε ο super admin ούτε κανένα γραφείο διαβάζει την περιήγησή του.
 *
 * @since 2026-09-25 (ADR-884 Κ2α)
 */

import {
  defineAuthorOwnedAnchors,
  defineAuthorOwnedCell,
  useAuthorOwnedEmulator,
  type AuthorOwnedPayload,
} from '../_harness/author-owned-server-written-suite';
import { defineSpatialTourSubcollectionAnchors } from '../_harness/spatial-tour-subcollections';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'spatial_tours_personal')!;

const payload: AuthorOwnedPayload = (userId) => ({
  userId,
  subject: { kind: 'owner-property', id: 'ownp-seed' },
  visibility: 'public',
  lifecycle: 'draft',
  levels: [],
  nodes: [],
  revision: 0,
  createdBy: userId,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedBy: userId,
  updatedAt: '2026-09-25T10:00:00.000Z',
});

describe('spatial_tours_personal.rules — διαβάζει ΜΟΝΟ ο κάτοχος, γράφει ΜΟΝΟ ο διακομιστής', () => {
  const env = useAuthorOwnedEmulator();
  for (const cell of COVERAGE.matrix) {
    defineAuthorOwnedCell(env, cell, COVERAGE.collection, payload, 'userId');
  }
  defineAuthorOwnedAnchors(env, COVERAGE.collection, payload, 'userId');

  defineSpatialTourSubcollectionAnchors(env, {
    collection: 'spatial_tours_personal',
    tourDoc: payload(PERSONA_CLAIMS.same_tenant_user.uid),
    reader: 'same_tenant_user',
    outsiders: ['super_admin', 'same_tenant_admin', 'cross_tenant_user', 'anonymous'],
  });
});
