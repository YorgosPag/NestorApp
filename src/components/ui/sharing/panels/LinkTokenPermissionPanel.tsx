/**
 * =============================================================================
 * 🏢 ENTERPRISE: LinkTokenPermissionPanel — HMAC-Style Share Adapter
 * =============================================================================
 *
 * PermissionPanel adapter for the link-token permission model (ADR-147).
 * Delegates form vs result rendering to sub-components based on the flow
 * state. Pure view layer — no service calls, no state ownership.
 *
 * @module components/ui/sharing/panels/LinkTokenPermissionPanel
 * @see ADR-147 Unified Share Surface
 */

'use client';

import React from 'react';
import type { PermissionPanelProps } from '@/types/sharing';
import { LinkTokenForm } from './link-token/LinkTokenForm';
import { LinkTokenResult } from './link-token/LinkTokenResult';
import type { LinkTokenDraft, LinkTokenResultData } from './link-token/types';

export type LinkTokenPermissionPanelProps = PermissionPanelProps<
  LinkTokenDraft,
  LinkTokenResultData
>;

export function LinkTokenPermissionPanel({
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
  state,
}: LinkTokenPermissionPanelProps): React.ReactElement {
  if (state.status === 'success' && state.result) {
    return <LinkTokenResult result={state.result} onClose={onCancel} />;
  }

  return (
    <LinkTokenForm
      draft={draft}
      onDraftChange={onDraftChange}
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitting={state.status === 'submitting'}
    />
  );
}
