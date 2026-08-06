/**
 * @related ADR-759 Φ2 — lifecycle owner for a project's survey records
 *
 * Owns loading, the local draft, saving, confirmation, and the reconciliation
 * ledger. One hook is the explicit owner (N.7.2 Q7) rather than several components
 * each writing a piece of the same document.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  requireAuthContext,
  resolveEffectiveCompanyId,
} from '@/services/firestore/auth-context';
import {
  createSurveyRecord,
  listSurveyRecords,
  updateSurveyRecord,
} from '@/services/survey-record.service';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import { recordDecision } from '@/lib/survey-record/survey-reconciliation';
import type {
  FieldReconciliation,
  ReconcilableField,
  ReconciliationAction,
  SurveyRecord,
} from '@/types/project-survey-record';

const logger = createModuleLogger('useSurveyRecords');

export interface UseSurveyRecordsResult {
  readonly records: readonly SurveyRecord[];
  /** The record currently on screen — the project's active one, or the newest. */
  readonly current: SurveyRecord | null;
  /** Local, unsaved edits. Equals `current` when nothing is pending. */
  readonly draft: SurveyRecord | null;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isDirty: boolean;
  /** A confirmed record is frozen — the rules refuse content writes (ADR-759 Q1). */
  readonly isFrozen: boolean;
  setDraft(next: SurveyRecord): void;
  discardDraft(): void;
  save(): Promise<boolean>;
  createBlank(): Promise<boolean>;
  setConfirmed(confirmed: boolean): Promise<boolean>;
  decide(field: ReconcilableField, action: ReconciliationAction, surveyValue: number | null): Promise<boolean>;
  select(recordId: string): void;
  /**
   * Δηλώνει **ποιο** τοπογραφικό ισχύει για το έργο (`project.activeSurveyRecordId`).
   *
   * 🔴 **Ο δείκτης υπήρχε από τη Φ2 και ΚΑΝΕΙΣ δεν τον έγραφε ποτέ** (μετρημένο 06/08:
   * 6 αναφορές στο `src`, **όλες αναγνώσεις**). Δηλαδή το «ποιο ισχύει» ήταν μονίμως `null`
   * και η καρτέλα έπεφτε πάντα στο εφεδρικό «η νεότερη» — ακριβώς η αναδυόμενη συμπεριφορά
   * που το ADR-759 Q1 απαγορεύει γραπτά. Ίδιο σχήμα με το `no-primary-address`: δηλωμένο,
   * χωρίς παραγωγό.
   *
   * Γίνεται απαραίτητο στη Φ3γ, όπου ο δείκτης καθορίζει **πού γράφει η πινακίδα**.
   */
  setActive(recordId: string): Promise<boolean>;
}

export function useSurveyRecords(
  projectId: string | null,
  activeSurveyRecordId: string | null | undefined
): UseSurveyRecordsResult {
  const { t } = useTranslation('surveyRecord');
  const [records, setRecords] = useState<readonly SurveyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<SurveyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async (): Promise<readonly SurveyRecord[]> => {
    if (!projectId) return [];
    setIsLoading(true);
    try {
      const loaded = await listSurveyRecords(projectId);
      setRecords(loaded);
      return loaded;
    } catch (error) {
      logger.warn('Failed to load survey records', { projectId, error });
      setRecords([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Which record the card shows.
   *
   * 🔑 The project's explicit pointer wins. Falling back to "the newest" only when
   * no pointer exists keeps the emergent-ordering bug out of the common path:
   * uploading an older survey must never change what is authoritative by itself.
   */
  const current = useMemo<SurveyRecord | null>(() => {
    if (records.length === 0) return null;
    const wanted = selectedId ?? activeSurveyRecordId ?? null;
    return records.find((r) => r.id === wanted) ?? records[0];
  }, [records, selectedId, activeSurveyRecordId]);

  // Reset the draft whenever the shown record changes identity.
  useEffect(() => {
    setDraftState(current);
  }, [current]);

  const isDirty = useMemo(
    () => draft !== null && current !== null && draft !== current,
    [draft, current]
  );
  const isFrozen = current?.confirmedBy != null;

  const setDraft = useCallback((next: SurveyRecord) => setDraftState(next), []);
  const discardDraft = useCallback(() => setDraftState(current), [current]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft) return false;
    setIsSaving(true);
    try {
      const ok = await updateSurveyRecord(draft.id, {
        ...draft,
        updatedAt: nowISO(),
      });
      if (!ok) {
        toast.error(t('toast.saveError'));
        return false;
      }
      await reload();
      toast.success(t('toast.saveSuccess'));
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [draft, reload, t]);

  const createBlank = useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    setIsSaving(true);
    try {
      const ctx = await requireAuthContext();
      const companyId = resolveEffectiveCompanyId(ctx);
      if (!companyId) {
        toast.error(t('toast.createError'));
        return false;
      }
      const record = createEmptySurveyRecord({
        companyId,
        projectId,
        createdBy: ctx.uid,
        now: nowISO(),
      });
      const ok = await createSurveyRecord(record);
      if (!ok) {
        toast.error(t('toast.createError'));
        return false;
      }
      await reload();
      setSelectedId(record.id);
      toast.success(t('toast.createSuccess'));
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [projectId, reload, t]);

  const setConfirmed = useCallback(
    async (confirmed: boolean): Promise<boolean> => {
      if (!current) return false;
      const ctx = await requireAuthContext();
      const ok = await updateSurveyRecord(current.id, {
        confirmedBy: confirmed ? ctx.uid : null,
        confirmedAt: confirmed ? nowISO() : null,
        updatedAt: nowISO(),
      });
      if (!ok) {
        toast.error(t('toast.saveError'));
        return false;
      }
      await reload();
      toast.success(confirmed ? t('toast.confirmSuccess') : t('toast.unconfirmSuccess'));
      return true;
    },
    [current, reload, t]
  );

  /**
   * Record a per-field decision against the Building Terms.
   *
   * Writes only `reconciliations` + `updatedAt` — the two keys the rules allow to
   * move on a confirmed record. Adopting the value INTO `buildingCode` is a separate,
   * caller-owned step: this hook owns the survey record, not the project document.
   */
  const decide = useCallback(
    async (
      field: ReconcilableField,
      action: ReconciliationAction,
      surveyValue: number | null
    ): Promise<boolean> => {
      if (!current) return false;
      const ctx = await requireAuthContext();
      const decision: FieldReconciliation = {
        field,
        action,
        surveyValueAtDecision: surveyValue,
        decidedBy: ctx.uid,
        decidedAt: nowISO(),
      };
      const ok = await updateSurveyRecord(current.id, {
        reconciliations: recordDecision(current.reconciliations, decision),
        updatedAt: nowISO(),
      });
      if (!ok) {
        toast.error(t('toast.adoptError'));
        return false;
      }
      await reload();
      return true;
    },
    [current, reload, t]
  );

  const select = useCallback((recordId: string) => setSelectedId(recordId), []);

  /**
   * Γράφει τον δείκτη στο **έργο**, όχι στην εγγραφή.
   *
   * ⚠️ Περνά από το `updateProjectWithPolicy` (ADR-742) όπως κάθε άλλη μεταβολή έργου —
   * δεύτερη διαδρομή θα ήταν δεύτερο μοντέλο ασφαλείας για την ίδια ερώτηση. Το τοπικό
   * `selectedId` ενημερώνεται μαζί, ώστε η οθόνη να μη δείχνει άλλη εγγραφή από αυτήν που
   * μόλις δηλώθηκε ενεργή.
   */
  const setActive = useCallback(
    async (recordId: string): Promise<boolean> => {
      if (!projectId) return false;
      const result = await updateProjectWithPolicy({
        projectId,
        updates: { activeSurveyRecordId: recordId },
      });
      if (!result.success) {
        toast.error(t('toast.saveError'));
        return false;
      }
      setSelectedId(recordId);
      // Το κλειδί υπήρχε από τη Φ2 **χωρίς κανέναν καταναλωτή** — μαζί με τα `card.setActive`,
      // `card.activeBadge`, `header.surveyDate`, `provenance.survey`. Η Φ3γ τα ενεργοποιεί
      // αντί να γράψει δεύτερα, που θα ήταν διπλότυπο με μεταφρασμένο νεκρό δίδυμο δίπλα.
      toast.success(t('toast.activeSuccess'));
      return true;
    },
    [projectId, t]
  );

  return {
    records,
    current,
    draft,
    isLoading,
    isSaving,
    isDirty,
    isFrozen,
    setDraft,
    discardDraft,
    save,
    createBlank,
    setConfirmed,
    decide,
    select,
    setActive,
  };
}
