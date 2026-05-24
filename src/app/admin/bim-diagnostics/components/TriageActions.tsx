'use client';

/**
 * TriageActions — ADR-366 §C.7.Q2
 *
 * FSM-aware status controls + assignee picker + internal notes editor.
 * Owns its own optimistic-update state and surfaces API errors inline.
 *
 * @module admin/bim-diagnostics/components/TriageActions
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { canTransition, nextStates } from '../lib/triage-fsm';
import { patchTriage, putInternalNote } from '../lib/admin-api';
import type { PerformanceDiagnostic, TriageStatus } from '@/types/performance-diagnostic';

interface TriageActionsProps {
  diagnostic: PerformanceDiagnostic;
}

export function TriageActions({ diagnostic }: TriageActionsProps) {
  const { t } = useTranslation('admin');

  const currentStatus: TriageStatus = diagnostic.status ?? 'new';
  const [targetStatus, setTargetStatus] = useState<TriageStatus | undefined>(undefined);
  const [transitionNote, setTransitionNote] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [assigneeInput, setAssigneeInput] = useState(diagnostic.assignedSuperAdminId ?? '');
  const [assigneeError, setAssigneeError] = useState<string | null>(null);
  const [assigneeBusy, setAssigneeBusy] = useState(false);

  const [notesInput, setNotesInput] = useState(diagnostic.internalNotes ?? '');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesBusy, setNotesBusy] = useState(false);

  const allowedNext = nextStates(currentStatus);

  async function handleStatusSubmit() {
    if (!targetStatus) return;
    if (!canTransition(currentStatus, targetStatus)) {
      setStatusError(t('bimDiagnostics.triage.transitionInvalid'));
      return;
    }
    setStatusBusy(true);
    setStatusError(null);
    try {
      await patchTriage(diagnostic.id, {
        status: targetStatus,
        ...(transitionNote ? { transitionNote } : {}),
      });
      setTargetStatus(undefined);
      setTransitionNote('');
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : t('bimDiagnostics.errors.transitionFailed'));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleAssigneeSubmit() {
    setAssigneeBusy(true);
    setAssigneeError(null);
    try {
      const trimmed = assigneeInput.trim();
      await patchTriage(diagnostic.id, {
        assignedSuperAdminId: trimmed.length === 0 ? null : trimmed,
      });
    } catch (err) {
      setAssigneeError(err instanceof Error ? err.message : t('bimDiagnostics.errors.assignFailed'));
    } finally {
      setAssigneeBusy(false);
    }
  }

  async function handleNotesSubmit() {
    setNotesBusy(true);
    setNotesError(null);
    try {
      await putInternalNote(diagnostic.id, notesInput);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : t('bimDiagnostics.errors.noteFailed'));
    } finally {
      setNotesBusy(false);
    }
  }

  return (
    <section className="space-y-6 border-t pt-4">
      <header className="text-sm font-semibold">{t('bimDiagnostics.triage.title')}</header>

      <article className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {t('bimDiagnostics.triage.currentStatus')}: <strong>{t(`bimDiagnostics.status.${currentStatus}`)}</strong>
        </p>
        <label className="text-xs font-medium">{t('bimDiagnostics.triage.changeStatus')}</label>
        <Select
          value={targetStatus ?? ''}
          onValueChange={(v) => setTargetStatus(v as TriageStatus)}
          disabled={allowedNext.length === 0 || statusBusy}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder={t('bimDiagnostics.triage.changeStatus')} />
          </SelectTrigger>
          <SelectContent>
            {allowedNext.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`bimDiagnostics.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder={t('bimDiagnostics.triage.changeStatusNote')}
          value={transitionNote}
          onChange={(e) => setTransitionNote(e.target.value)}
          rows={2}
        />
        {statusError && <p className="text-xs text-destructive">{statusError}</p>}
        <Button
          onClick={handleStatusSubmit}
          disabled={statusBusy || !targetStatus}
          size="sm"
        >
          {t('bimDiagnostics.triage.changeStatusSubmit')}
        </Button>
      </article>

      <article className="space-y-2">
        <label className="text-xs font-medium">
          {t('bimDiagnostics.triage.assignee')}
          {!diagnostic.assignedSuperAdminId && (
            <span className="ml-1 text-muted-foreground">
              ({t('bimDiagnostics.triage.assigneeUnassigned')})
            </span>
          )}
        </label>
        <Input
          value={assigneeInput}
          onChange={(e) => setAssigneeInput(e.target.value)}
          placeholder={t('bimDiagnostics.triage.assigneeChange')}
        />
        {assigneeError && <p className="text-xs text-destructive">{assigneeError}</p>}
        <Button
          onClick={handleAssigneeSubmit}
          disabled={assigneeBusy}
          size="sm"
          variant="secondary"
        >
          {t('bimDiagnostics.triage.assigneeSubmit')}
        </Button>
      </article>

      <article className="space-y-2">
        <label className="text-xs font-medium">{t('bimDiagnostics.triage.internalNotes')}</label>
        <Textarea
          placeholder={t('bimDiagnostics.triage.internalNotesPlaceholder')}
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          rows={4}
        />
        {notesError && <p className="text-xs text-destructive">{notesError}</p>}
        <Button
          onClick={handleNotesSubmit}
          disabled={notesBusy}
          size="sm"
          variant="secondary"
        >
          {t('bimDiagnostics.triage.internalNotesSubmit')}
        </Button>
      </article>

      <article>
        <h4 className="text-xs font-medium mb-2">{t('bimDiagnostics.triage.historyTitle')}</h4>
        {diagnostic.triageHistory && diagnostic.triageHistory.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {diagnostic.triageHistory.map((entry, idx) => (
              <li key={`${entry.at}-${idx}`} className="text-muted-foreground">
                {t('bimDiagnostics.triage.historyEntry', {
                  from: entry.from ? t(`bimDiagnostics.status.${entry.from}`) : '∅',
                  to: t(`bimDiagnostics.status.${entry.to}`),
                  by: entry.by,
                  at: entry.at.slice(0, 19).replace('T', ' '),
                })}
                {entry.note && <span className="block pl-3 italic">— {entry.note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t('bimDiagnostics.triage.historyEmpty')}</p>
        )}
      </article>
    </section>
  );
}
