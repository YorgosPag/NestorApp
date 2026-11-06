'use client';

/**
 * @fileoverview **Το πεδίο «Κάτοχος» της φόρμας ευκαιρίας** (ADR-930 §3.8 · Τι 5).
 * @module components/crm/owner/OpportunityOwnerField
 *
 * - **Φαίνεται πάντα** (ποιος την έχει), **ενεργό** μόνο όταν ο ΙΔΙΟΣ κριτής του server δίνει `transfer`
 *   (`useOpportunityAccess` — καμία δεύτερη εκδοχή). Κλειδωμένο ⇒ λέει **γιατί** και **ποιος** μπορεί.
 * - Υποψήφιοι = η λίστα της πόρτας (`GET …/owner`), δηλαδή ακριβώς όσοι θα δεχτεί το POST.
 * - ➕ Σημείωμα παράδοσης μόλις αλλάξει ο κάτοχος — φτάνει στον νέο κάτοχο και μένει στο ιστορικό.
 */

import { useMemo } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getInitials } from '@/types/contacts/helpers';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { opportunityOwnerOf } from '@/services/crm/opportunity-access';
import type { OwnerCandidate } from '@/services/crm/opportunity-owner-schema';
import { OWNER_TRANSFER_NOTE_MAX } from '@/services/crm/opportunity-owner-transfer';
import type { Opportunity } from '@/types/crm';
import { accessDenialKey, useOpportunityAccess } from '../stage-move/useOpportunityAccess';
import { useOpportunityOwnerCandidates } from './useOpportunityOwnerCandidates';
import type { OwnerDraft } from './useOwnerTransferCommand';

interface OpportunityOwnerFieldProps {
  readonly opportunity: Opportunity;
  readonly draft: OwnerDraft;
  readonly onChange: (draft: OwnerDraft) => void;
  readonly disabled: boolean;
}

function CandidateLabel({ person, unnamed, current }: { readonly person: OwnerCandidate; readonly unnamed: string; readonly current: string | null }) {
  const name = person.name ?? unnamed;
  return (
    <span className="flex items-center gap-2">
      <Avatar className="h-5 w-5">
        {person.photoUrl !== null && <AvatarImage src={person.photoUrl} alt="" />}
        <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
      {current && <span className="text-xs text-muted-foreground">· {current}</span>}
    </span>
  );
}

/** ➕ Το σημείωμα παράδοσης — εμφανίζεται μόνο όταν αλλάζει ο κάτοχος. */
function HandoffNote({ note, onChange }: { readonly note: string; readonly onChange: (note: string) => void }) {
  const { t } = useTranslation('crm');
  return (
    <>
      <Label htmlFor="opportunity-owner-note">{t('opportunities.editModal.labels.ownerNote')}</Label>
      <Textarea
        id="opportunity-owner-note"
        value={note}
        maxLength={OWNER_TRANSFER_NOTE_MAX}
        placeholder={t('opportunities.editModal.labels.ownerNotePlaceholder')}
        aria-describedby="opportunity-owner-note-hint"
        onChange={(event) => onChange(event.target.value)}
      />
      <p id="opportunity-owner-note-hint" className="text-xs text-muted-foreground">{t('opportunities.editModal.labels.ownerNoteHint')}</p>
    </>
  );
}

/** Ο τρέχων κάτοχος πρώτος· οι υπόλοιποι αλφαβητικά. Ο κάτοχος μπαίνει πάντα, ακόμη κι αν η λίστα δεν φόρτωσε. */
function orderedCandidates(candidates: readonly OwnerCandidate[], ownerUid: string | null, ownerName: string): OwnerCandidate[] {
  const others = candidates.filter((person) => person.uid !== ownerUid && person.uid !== '');
  others.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  if (ownerUid === null) return others;
  const owner = candidates.find((person) => person.uid === ownerUid) ?? { uid: ownerUid, name: ownerName || null, photoUrl: null };
  return [owner, ...others];
}

/** Ό,τι χρειάζεται να ξέρει το πεδίο: ποιος την έχει, αν επιτρέπεται να δοθεί, από ποιους, και γιατί όχι. */
function useOwnerFieldModel(opportunity: Opportunity) {
  const access = useOpportunityAccess();
  const ownerUid = opportunityOwnerOf(opportunity);
  const canTransfer = access.allows(opportunity, 'transfer');
  const candidatesState = useOpportunityOwnerCandidates(opportunity.id, canTransfer);
  const ownerNames = useUserDisplayNames(ownerUid ? [ownerUid] : []);
  const ownerName = ownerUid ? ownerNames.get(ownerUid) ?? '' : '';
  const candidates = useMemo(
    () => orderedCandidates(candidatesState.status === 'ready' ? candidatesState.candidates : [], ownerUid, ownerName),
    [candidatesState, ownerUid, ownerName],
  );
  const lockKey = accessDenialKey(access.decide(opportunity, 'transfer'), ownerName !== '');
  return { ownerUid, ownerName, canTransfer, status: candidatesState.status, candidates, lockKey };
}

export function OpportunityOwnerField({ opportunity, draft, onChange, disabled }: OpportunityOwnerFieldProps) {
  const { t } = useTranslation('crm');
  const { ownerUid, ownerName, canTransfer, status, candidates, lockKey } = useOwnerFieldModel(opportunity);
  const unnamed = t('opportunities.editModal.labels.ownerUnnamed');
  const currentTag = t('opportunities.editModal.labels.ownerCurrent');
  const changed = draft.ownerUid !== null && draft.ownerUid !== ownerUid;

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <Label htmlFor="opportunity-owner">{t('opportunities.editModal.labels.owner')}</Label>
      <Select
        value={draft.ownerUid ?? undefined}
        onValueChange={(uid) => onChange({ ownerUid: uid, note: uid === ownerUid ? '' : draft.note })}
        disabled={disabled || !canTransfer || status === 'loading'}
      >
        <SelectTrigger id="opportunity-owner" aria-describedby={lockKey ? 'opportunity-owner-lock' : undefined}>
          <SelectValue placeholder={t(status === 'loading' ? 'opportunities.editModal.labels.ownerLoading' : 'opportunities.editModal.labels.ownerPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((person) => (
            <SelectItem key={person.uid} value={person.uid}>
              <CandidateLabel person={person} unnamed={unnamed} current={person.uid === ownerUid ? currentTag : null} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {lockKey && <p id="opportunity-owner-lock" className="text-sm text-muted-foreground">{t(lockKey, { owner: ownerName })}</p>}
      {status === 'failed' && <p role="alert" className="text-sm text-destructive">{t('opportunities.editModal.messages.ownerCandidatesFailed')}</p>}
      {changed && <HandoffNote note={draft.note} onChange={(note) => onChange({ ...draft, note })} />}
    </fieldset>
  );
}
