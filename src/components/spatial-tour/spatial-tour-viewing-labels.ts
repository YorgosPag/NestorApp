/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΘΕΑΣΗΣ ΣΤΗΝ ΠΛΕΥΡΑ ΤΟΥ ΥΠΕΥΘΥΝΟΥ** — ρυθμίσεις · αιτήματα · σύνδεσμοι (ADR-884 Κ3β).
 * @related ADR-744 (γιατί ΟΛΟΓΡΑΦΑ) · `tour-access-labels.ts` (η δημόσια πλευρά) · `spatial-tour-labels.ts` (ροή λήψης)
 * @module components/spatial-tour/spatial-tour-viewing-labels
 *
 * ⛔ Κάθε κλειδί ολόκληρο με το `spatial-tour:`. 🔑 `Record<λεξιλόγιο, …>`: νέα ορατότητα/κατάσταση **δεν
 * μεταγλωττίζεται** χωρίς λέξεις.
 */

import type { SpatialTourLifecycle, SpatialTourVisibility } from '@/constants/spatial-tour-vocabulary';

export const VISIBILITY_KEY: Readonly<Record<SpatialTourVisibility, string>> = {
  public: 'spatial-tour:visibility.public',
  'on-request': 'spatial-tour:visibility.onRequest',
  'link-only': 'spatial-tour:visibility.linkOnly',
};

export const VISIBILITY_HINT_KEY: Readonly<Record<SpatialTourVisibility, string>> = {
  public: 'spatial-tour:visibilityHint.public',
  'on-request': 'spatial-tour:visibilityHint.onRequest',
  'link-only': 'spatial-tour:visibilityHint.linkOnly',
};

export const LIFECYCLE_KEY: Readonly<Record<SpatialTourLifecycle, string>> = {
  draft: 'spatial-tour:lifecycle.draft',
  published: 'spatial-tour:lifecycle.published',
  withdrawn: 'spatial-tour:lifecycle.withdrawn',
};

export const VIEWING_KEYS = {
  settingsTitle: 'spatial-tour:viewing.settingsTitle',
  visibility: 'spatial-tour:viewing.visibility',
  lifecycle: 'spatial-tour:viewing.lifecycle',
  publish: 'spatial-tour:viewing.publish',
  withdraw: 'spatial-tour:viewing.withdraw',
  saved: 'spatial-tour:viewing.saved',
  explicitGrantsNote: 'spatial-tour:viewing.explicitGrantsNote',
  linksTitle: 'spatial-tour:viewing.linksTitle',
  linksDescription: 'spatial-tour:viewing.linksDescription',
  linksManage: 'spatial-tour:viewing.linksManage',
  requestsTitle: 'spatial-tour:viewing.requestsTitle',
  tabPending: 'spatial-tour:viewing.tabPending',
  tabApproved: 'spatial-tour:viewing.tabApproved',
  noPending: 'spatial-tour:viewing.noPending',
  noApproved: 'spatial-tour:viewing.noApproved',
  selectAll: 'spatial-tour:viewing.selectAll',
  selectRequest: 'spatial-tour:viewing.selectRequest',
  approveUntil: 'spatial-tour:viewing.approveUntil',
  approveSelected: 'spatial-tour:viewing.approveSelected',
  declineSelected: 'spatial-tour:viewing.declineSelected',
  requestedAt: 'spatial-tour:viewing.requestedAt',
  requestedTimes: 'spatial-tour:viewing.requestedTimes',
  verifiedEmail: 'spatial-tour:viewing.verifiedEmail',
  unverifiedEmail: 'spatial-tour:viewing.unverifiedEmail',
  unknownAccount: 'spatial-tour:viewing.unknownAccount',
  viewTrace: 'spatial-tour:viewing.viewTrace',
  lastViewed: 'spatial-tour:viewing.lastViewed',
  accessUntil: 'spatial-tour:viewing.accessUntil',
  inCrm: 'spatial-tour:viewing.inCrm',
  revokeAccess: 'spatial-tour:viewing.revokeAccess',
  decidedApproved: 'spatial-tour:viewing.decidedApproved',
  decidedDeclined: 'spatial-tour:viewing.decidedDeclined',
  decidedSkipped: 'spatial-tour:viewing.decidedSkipped',
  contactUnavailable: 'spatial-tour:viewing.contactUnavailable',
} as const;
