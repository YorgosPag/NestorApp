'use client';

/**
 * **Αφαίρεση από το γραφείο** (ADR-892 Φ2) και **Παύση πρόσβασης** (Φ2β) — ο **ίδιος** διάλογος προεπισκόπησης.
 *
 * - Αφαίρεση: η ιδιότητα μέλους τελειώνει, ο λογαριασμός **μένει**.
 * - Παύση: ο άνθρωπος **μένει μέλος** (ρόλος, ομάδες, ιστορικό) αλλά δεν ανοίγει το γραφείο μέχρι την
 *   «Επαναφορά πρόσβασης» (Atlassian «Suspend access»). Η μεταβίβαση ευθύνης είναι **επιλογή** (Google Workspace).
 *
 * Ο διάλογος δείχνει **πρώτα τι θα γίνει** και μόνο μετά δίνει το κουμπί (§3.6). Αν ο κριτής λέει «όχι»,
 * λέει **γιατί** — και το κουμπί δεν εμφανίζεται. ⛔ Καμία σχέση με την «Αναστολή λογαριασμού» (πλατφόρμας).
 *
 * @module components/admin/role-management/components/MemberExitDialog
 * @see docs/centralized-systems/reference/adrs/ADR-892-workspace-member-removal.md §11 · §12
 */

import { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { MemberExitPreview } from '@/server/workspace/member-exit';

import type { CompanyUser } from '../types';
import {
  MEMBER_EXIT_KEYS,
  MEMBER_EXIT_MODE_KEYS,
  MEMBER_EXIT_NS,
  MEMBER_PAUSE_KEYS,
  type MemberExitMode,
  type MemberExitRefusal,
} from '../member-exit-labels';
import { useMemberExit, type MemberActionInput, type MemberExitPreviewState } from '../useMemberExit';
import { DialogConfirmFooter } from './DialogConfirmFooter';
import { MemberCard, PreviewFailed, ReasonField, RefusalNotice, useMemberActionSubmit } from './member-dialog-parts';

interface MemberExitDialogProps {
  readonly mode: MemberExitMode;
  readonly user: CompanyUser;
  /** Τα μέλη του γραφείου — για να ονομαστεί ο κληρονόμος (ο διακομιστής δίνει μόνο `uid`). */
  readonly members: readonly CompanyUser[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

/** Όνομα μέλους για την οθόνη — ίδια προτεραιότητα με τον πίνακα (όνομα → email). */
function memberLabel(members: readonly CompanyUser[], uid: string, unnamed: string): string {
  const member = members.find((m) => m.uid === uid);
  return member === undefined ? unnamed : (member.displayName ?? member.email);
}

/** Η άρνηση που ισχύει: της **πράξης** νικά της προεπισκόπησης (ο κόσμος άλλαξε στο μεταξύ). */
function refusalOfState(state: MemberExitPreviewState, late: MemberExitRefusal | null): MemberExitRefusal | null {
  if (late !== null) return late;
  if (state.kind !== 'ready' || state.preview.verdict.kind === 'allowed') return null;
  return state.preview.verdict.kind;
}

interface ConsequencesProps {
  readonly mode: MemberExitMode;
  readonly preview: MemberExitPreview;
  readonly heirName: string | null;
}

/** «Τι θα γίνει» — η αφαίρεση **μεταβιβάζει**· η παύση **κρατά** (και το λέει ρητά για τις ομάδες). */
function Consequences({ mode, preview, heirName }: ConsequencesProps) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <section className="space-y-1 rounded-lg border p-3" aria-labelledby="member-exit-consequences">
      <h3 id="member-exit-consequences" className="text-sm font-medium">{t(MEMBER_EXIT_KEYS.consequencesHeading)}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {mode === 'removal' ? (
          <>
            <li>{heirName === null ? t(MEMBER_EXIT_KEYS.noHeir) : t(MEMBER_EXIT_KEYS.heir, { name: heirName })}</li>
            <li>{t(MEMBER_EXIT_KEYS.actTeams, { count: preview.actTeams })}</li>
          </>
        ) : (
          <>
            <li>{t(MEMBER_PAUSE_KEYS.staysMember)}</li>
            <li>{t(MEMBER_PAUSE_KEYS.actTeamsKept, { count: preview.actTeams })}</li>
          </>
        )}
        <li>{preview.isHomeWorkspace ? t(MEMBER_EXIT_KEYS.signsOut) : t(MEMBER_EXIT_KEYS.staysSignedIn)}</li>
        <li>{t(MEMBER_EXIT_MODE_KEYS[mode].notified)}</li>
      </ul>
    </section>
  );
}

/** Προαιρετική μεταβίβαση — **μόνο** στην παύση, μόνο αν υπάρχουν ομάδες **και** κληρονόμος. */
function TransferChoice({ heirName, checked, onChange }: { heirName: string; checked: boolean; onChange: (next: boolean) => void }) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <p className="flex items-center gap-2">
      <Checkbox id="member-pause-transfer" checked={checked} onCheckedChange={(state) => onChange(state === true)} />
      <label htmlFor="member-pause-transfer" className="cursor-pointer text-sm">
        {t(MEMBER_PAUSE_KEYS.transferLabel, { name: heirName })}
      </label>
    </p>
  );
}

interface ExitFormProps extends ConsequencesProps {
  readonly isSubmitting: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (input: MemberActionInput) => void;
}

/** Συνέπειες + (παύση) επιλογή μεταβίβασης + προαιρετικός λόγος + κουμπί — **μόνο** όταν ο κριτής είπε `allowed`. */
function ExitForm({ mode, preview, heirName, isSubmitting, onCancel, onConfirm }: ExitFormProps) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  const [reason, setReason] = useState('');
  const [transferActTeams, setTransferActTeams] = useState(false);
  const offersTransfer = mode === 'pause' && preview.actTeams > 0 && heirName !== null;
  return (
    <>
      <Consequences mode={mode} preview={preview} heirName={heirName} />
      {offersTransfer && <TransferChoice heirName={heirName} checked={transferActTeams} onChange={setTransferActTeams} />}
      <ReasonField value={reason} onChange={setReason} />
      <DialogConfirmFooter
        onCancel={onCancel}
        onConfirm={() => onConfirm({ reason, transferActTeams: offersTransfer && transferActTeams })}
        confirmKey={MEMBER_EXIT_MODE_KEYS[mode].confirm}
        isSubmitting={isSubmitting}
        confirmVariant="destructive"
      />
    </>
  );
}

export function MemberExitDialog({ mode, user, members, open, onClose, onSuccess }: MemberExitDialogProps) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  const colors = useSemanticColors();
  const { previewState, reloadPreview, act } = useMemberExit(user.uid, mode);
  const { submit, isSubmitting, lateRefusal } = useMemberActionSubmit(MEMBER_EXIT_MODE_KEYS[mode], act, onSuccess);
  const refusal = refusalOfState(previewState, lateRefusal);
  const heirUid = previewState.kind === 'ready' ? previewState.preview.heirUid : null;
  const heirName = heirUid === null ? null : memberLabel(members, heirUid, t('roleManagement.unnamed'));

  return (
    // Όσο τρέχει η πράξη ο διάλογος δεν κλείνει — ποτέ μισοτελειωμένη πράξη χωρίς απάντηση.
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(MEMBER_EXIT_MODE_KEYS[mode].title)}</DialogTitle>
          <DialogDescription>{t(MEMBER_EXIT_MODE_KEYS[mode].description)}</DialogDescription>
        </DialogHeader>
        <MemberCard user={user} />
        {previewState.kind === 'loading' && (
          <p className={cn('animate-pulse text-sm', colors.text.muted)}>{t(MEMBER_EXIT_KEYS.loadingPreview)}</p>
        )}
        {previewState.kind === 'failed' && <PreviewFailed onRetry={reloadPreview} onClose={onClose} />}
        {refusal !== null && <RefusalNotice refusal={refusal} onClose={onClose} />}
        {previewState.kind === 'ready' && refusal === null && (
          <ExitForm
            mode={mode}
            preview={previewState.preview}
            heirName={heirName}
            isSubmitting={isSubmitting}
            onCancel={onClose}
            onConfirm={submit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
