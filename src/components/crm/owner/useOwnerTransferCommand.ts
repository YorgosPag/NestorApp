'use client';

/**
 * @fileoverview **Η εντολή «δώσ' την σε άλλον» από τη φόρμα** (ADR-930 §3.8).
 * @module components/crm/owner/useOwnerTransferCommand
 *
 * Κατέχει το πρόχειρο (νέος κάτοχος + σημείωμα) και την κλήση της πόρτας. `expectedOwnerUid` = ο κάτοχος **που είδε** ο
 * άνθρωπος όταν άνοιξε τη φόρμα — όχι όποιος είναι τώρα: αυτό ακριβώς κάνει το 409 να σημαίνει κάτι.
 * 🔑 Κάθε άρνηση ειδοποιεί **και** απορρίπτει, ώστε η φόρμα να μείνει ανοιχτή (σύμβαση του `onSave`).
 */

import { useCallback, useState } from 'react';

import { resolveUserDisplayName } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { opportunityOwnerOf } from '@/services/crm/opportunity-access';
import type { Opportunity } from '@/types/crm';
import { postOwnerTransfer, type OwnerTransferResult } from './owner-transfer-api';

export interface OwnerDraft {
  readonly ownerUid: string | null;
  readonly note: string;
}

export interface OwnerTransferCommand {
  readonly draft: OwnerDraft;
  readonly setDraft: (draft: OwnerDraft) => void;
  /** Ξαναξεκινά το πρόχειρο από τον κάτοχο της ευκαιρίας (άνοιγμα φόρμας / φρεσκάρισμα). */
  readonly reset: (opportunity: Opportunity | null) => void;
  /** `true` όταν το πρόχειρο ζητά άλλο κάτοχο από αυτόν που είδε ο άνθρωπος. */
  readonly isDirty: (opportunity: Opportunity) => boolean;
  /** Εκτελεί τη μεταβίβαση αν ζητήθηκε. Απορρίπτει (αφού ειδοποιήσει) σε κάθε άρνηση. */
  readonly commit: (opportunity: Opportunity) => Promise<void>;
}

const EMPTY_DRAFT: OwnerDraft = { ownerUid: null, note: '' };

type Refusal = Exclude<OwnerTransferResult['kind'], 'ok'>;

const REFUSAL_KEY: Readonly<Record<Refusal, string>> = {
  conflict: 'opportunities.editModal.messages.ownerConflict',
  refused: 'opportunities.editModal.messages.ownerRefused',
  invalid: 'opportunities.editModal.messages.ownerFailed',
  failed: 'opportunities.editModal.messages.ownerFailed',
};

function refusalKey(result: Exclude<OwnerTransferResult, { kind: 'ok' }>): string {
  return result.kind === 'invalid' && result.reason === 'owner_not_member'
    ? 'opportunities.editModal.messages.ownerNotMember'
    : REFUSAL_KEY[result.kind];
}

export function useOwnerTransferCommand(): OwnerTransferCommand {
  const { t } = useTranslation('crm');
  const notifications = useNotifications();
  const [draft, setDraft] = useState<OwnerDraft>(EMPTY_DRAFT);

  const reset = useCallback((opportunity: Opportunity | null) => {
    setDraft(opportunity ? { ownerUid: opportunityOwnerOf(opportunity), note: '' } : EMPTY_DRAFT);
  }, []);

  const isDirty = useCallback(
    (opportunity: Opportunity) => draft.ownerUid !== null && draft.ownerUid !== opportunityOwnerOf(opportunity),
    [draft.ownerUid],
  );

  const commit = useCallback(async (opportunity: Opportunity) => {
    if (!opportunity.id || !isDirty(opportunity) || draft.ownerUid === null) return;
    const result = await postOwnerTransfer(opportunity.id, {
      expectedOwnerUid: opportunityOwnerOf(opportunity),
      newOwnerUid: draft.ownerUid,
      note: draft.note.trim() || undefined,
    });
    if (result.kind !== 'ok') {
      notifications.error(t(refusalKey(result)));
      throw new Error(`Owner transfer refused: ${result.kind}`);
    }
    if (result.response.outcome === 'applied') {
      const name = await resolveUserDisplayName(result.response.ownerUid);
      const owner = name || t('opportunities.editModal.labels.ownerUnnamed');
      notifications.success(t('opportunities.editModal.messages.ownerTransferred', { owner }));
    }
  }, [draft, isDirty, notifications, t]);

  return { draft, setDraft, reset, isDirty, commit };
}
