'use client';

/**
 * ADR-892 Φ2 / Φ2β — **προεπισκόπηση + πράξη** για τον διάλογο εξόδου του διαχειριστή: **αφαίρεση** ή **παύση
 * πρόσβασης**, και η **επαναφορά** (χωρίς προεπισκόπηση — δεν αφαιρεί τίποτα).
 *
 * 🔑 Λεπτό περιτύλιγμα: ο κινητήρας (προεπισκόπηση με φρουρό αγώνα · κλειστή μετάφραση της πράξης) ζει στο
 * `workspace-membership/exit-action` και τον μοιράζεται η αποχώρηση του ίδιου (Φ3). Εδώ μένουν **μόνο** οι
 * διευθύνσεις και οι πράξεις ανά δρόμο.
 *
 * @module components/admin/role-management/useMemberExit
 */

import { useCallback, useMemo } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  settleMemberAction,
  useExitPreview,
  type ExitPreviewState,
  type SettledAction,
} from '@/components/workspace-membership/exit-action';
// ⚠️ TYPE-ONLY πέρα από το σύνορο του διακομιστή — σβήνεται στη μεταγλώττιση (ίδιο ιδίωμα με το
//    `invite-labels.ts`). Αντίγραφο του σχήματος εδώ θα ήταν δεύτερο λεξιλόγιο (N.0.2).
import type { MemberExitPreview } from '@/server/workspace/member-exit';

import { MEMBER_EXIT_REFUSALS, type MemberExitMode, type MemberExitRefusal } from './member-exit-labels';

export type MemberExitPreviewState = ExitPreviewState<MemberExitPreview>;

interface PreviewResponse {
  readonly preview: MemberExitPreview;
}

export type MemberActionResult = SettledAction<MemberExitRefusal>;

/** Επιλογές της πράξης — η μεταβίβαση ευθύνης αφορά **μόνο** την παύση (στην αφαίρεση γίνεται πάντα). */
export interface MemberActionInput {
  readonly reason: string;
  readonly transferActTeams: boolean;
}

function withReason(reason: string): { reason?: string } {
  const trimmed = reason.trim();
  return trimmed === '' ? {} : { reason: trimmed };
}

function previewUrl(targetUid: string, mode: MemberExitMode): string {
  const base = API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_MEMBERSHIP(targetUid);
  return mode === 'pause' ? `${base}?intent=pause` : base;
}

/** Η πράξη ανά δρόμο — **ένας** χάρτης (όχι `if` στον διάλογο). */
const ACT_BY_MODE: Readonly<Record<MemberExitMode, (targetUid: string, input: MemberActionInput) => Promise<unknown>>> = {
  removal: (targetUid, input) =>
    apiClient.post(API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_MEMBERSHIP(targetUid), withReason(input.reason)),
  pause: (targetUid, input) =>
    apiClient.patch(API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_MEMBERSHIP(targetUid), {
      action: 'pause', ...withReason(input.reason), transferActTeams: input.transferActTeams,
    }),
};

/** **Επαναφορά πρόσβασης** — καμία προεπισκόπηση: δεν αφαιρεί τίποτα, και ο κριτής ξανακρίνει. */
export function restoreMemberAccess(targetUid: string, reason: string): Promise<MemberActionResult> {
  return settleMemberAction(() => apiClient.patch(API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_MEMBERSHIP(targetUid), {
    action: 'restore', ...withReason(reason),
  }), MEMBER_EXIT_REFUSALS);
}

export interface MemberExit {
  readonly previewState: MemberExitPreviewState;
  readonly reloadPreview: () => void;
  readonly act: (input: MemberActionInput) => Promise<MemberActionResult>;
}

/** Η απάντηση της διαδρομής (`{ preview }`) → η προεπισκόπηση που διαβάζει ο διάλογος. */
function unwrap(state: ExitPreviewState<PreviewResponse>): MemberExitPreviewState {
  return state.kind === 'ready' ? { kind: 'ready', preview: state.preview.preview } : state;
}

export function useMemberExit(targetUid: string, mode: MemberExitMode): MemberExit {
  const { previewState: raw, reloadPreview } = useExitPreview<PreviewResponse>(previewUrl(targetUid, mode));
  const previewState = useMemo(() => unwrap(raw), [raw]);
  const act = useCallback(
    (input: MemberActionInput) => settleMemberAction(() => ACT_BY_MODE[mode](targetUid, input), MEMBER_EXIT_REFUSALS),
    [targetUid, mode],
  );
  return { previewState, reloadPreview, act };
}
