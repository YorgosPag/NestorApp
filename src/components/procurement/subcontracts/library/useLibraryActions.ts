'use client';

/**
 * **Οι πράξεις της βιβλιοθήκης από την οθόνη** — ένα σημείο για ειδοποίηση επιτυχίας/αποτυχίας (ADR-928 Φ3γ-0).
 *
 * 🔑 CAS με ό,τι βλέπει ο άνθρωπος: `expectedRevision` = η αναθεώρηση της έκδοσης/ρήτρας/προτύπου στην οθόνη. Αν άλλος
 *    άλλαξε κάτι στο μεταξύ, ο γραφέας απαντά 409 και η ζωντανή ανάγνωση φέρνει ήδη τη νέα κατάσταση ⇒ προειδοποίηση
 *    (`useSubcontractFailureNotice`), ποτέ απόφαση στα τυφλά.
 * 🔑 Καμία αισιόδοξη αλλαγή κατάστασης: η διακυβέρνηση είναι απόφαση του γραφέα (διάκριση καθηκόντων, μία πρόταση ανά
 *    ρήτρα)· η ζωντανή ανάγνωση φέρνει το αποτέλεσμα σε ένα στιγμιότυπο. Το `Idempotency-Key` του `apiClient` καλύπτει
 *    την επανάληψη δικτύου.
 * 🔑 Κάθε πράξη επιστρέφει `true`/`false`: ο διάλογος κλείνει μόνο όταν έγινε (`ReasonDialog`).
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  approveClauseTranslation,
  approveClauseVersion,
  createClause,
  markClauseVersionReviewed,
  proposeClauseTranslation,
  proposeClauseVersion,
  rejectClauseVersion,
  seedSubcontractLibrary,
  setClauseArchived,
  setTradeTemplateArchived,
  withdrawClauseVersion,
  type CreateClauseInput,
  type ProposeClauseVersionInput,
} from '@/services/procurement/subcontracts/subcontract-library-api.client';
import type { DraftOutcome } from '@/hooks/drafts/useRevisionedDraft';
import { subcontractFailureOf, type SubcontractFailureKind } from '@/services/procurement/subcontracts/subcontract-failure';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { seedReportHasChanges } from '@/subapps/procurement/subcontracts/library/default-library-update';
import type { CalendarDay } from '@/constants/platform-operator';
import type { ClauseBody, SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { DefaultLibrarySeedReport } from '@/subapps/procurement/subcontracts/types/library-seed';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';
import { useSubcontractFailureNotice } from '../subcontract-messages';

type VersionRef = Pick<SubcontractClauseVersion, 'clauseId' | 'version' | 'revision'>;

/**
 * Μία πράξη: αίτημα → επιτυχία (λέξη) ή αποτυχία (η μία ειδοποίηση), με το αποτέλεσμα ως `DraftOutcome`.
 * 🔑 Οι πράξεις **συγγραφής** (ADR-928 §5.22) δίνουν το αποτέλεσμα στο πρόχειρο: τα ευρήματα του γραφέα φαίνονται δίπλα
 *    στα πεδία, και το 409 γίνεται λωρίδα σύγκρουσης — ποτέ χαμένη δουλειά. Γι' αυτό η σύγκρουση εκεί δεν γίνεται
 *    ειδοποίηση (`quiet`): τη λέει η λωρίδα.
 */
function useAttempt() {
  const { t } = useTranslation('procurement');
  const { success } = useNotifications();
  const notifyFailure = useSubcontractFailureNotice();
  return useCallback(
    async <T>(request: () => Promise<T>, doneKey: string | ((result: T) => string), quiet: SubcontractFailureKind | null = null): Promise<DraftOutcome<T, SubcontractIssue>> => {
      try {
        const record = await request();
        success(t(`subcontracts.library.done.${typeof doneKey === 'string' ? doneKey : doneKey(record)}`));
        return { ok: true, record };
      } catch (cause) {
        const failure = subcontractFailureOf(cause);
        if (failure.kind !== quiet) notifyFailure(failure);
        return { ok: false, failure };
      }
    },
    [notifyFailure, success, t],
  );
}

/** Πράξη διακυβέρνησης: μόνο «έγινε;» — η ζωντανή ανάγνωση φέρνει το αποτέλεσμα. */
function useRunner() {
  const attempt = useAttempt();
  return useCallback(
    async <T>(request: () => Promise<T>, doneKey: string | ((result: T) => string)): Promise<T | null> => {
      const outcome = await attempt(request, doneKey);
      return outcome.ok ? outcome.record : null;
    },
    [attempt],
  );
}

const ref = (version: VersionRef) => ({ clauseId: version.clauseId, version: version.version });

export interface LibraryActions {
  readonly seed: () => Promise<DefaultLibrarySeedReport | null>;
  readonly approve: (version: VersionRef, effectiveFrom: CalendarDay | null, reason: string | null) => Promise<boolean>;
  readonly reject: (version: VersionRef, reason: string | null) => Promise<boolean>;
  readonly withdraw: (version: VersionRef, reason: string | null) => Promise<boolean>;
  readonly markReviewed: (version: VersionRef) => Promise<boolean>;
  readonly proposeTranslation: (version: VersionRef, language: string, body: ClauseBody) => Promise<boolean>;
  readonly approveTranslation: (version: VersionRef, language: string) => Promise<boolean>;
  readonly setClauseArchived: (clause: Pick<SubcontractClause, 'id' | 'revision'>, archived: boolean) => Promise<boolean>;
  readonly setTemplateArchived: (template: Pick<SubcontractTradeTemplate, 'id' | 'revision'>, archived: boolean) => Promise<boolean>;
  readonly createClause: (input: CreateClauseInput) => Promise<DraftOutcome<SubcontractClause, SubcontractIssue>>;
  readonly proposeClauseVersion: (clauseId: string, input: ProposeClauseVersionInput) => Promise<DraftOutcome<SubcontractClauseVersion, SubcontractIssue>>;
}

export function useLibraryActions(): LibraryActions {
  const run = useRunner();
  const attempt = useAttempt();
  return useMemo(() => {
    const done = async <T>(request: () => Promise<T>, key: string) => (await run(request, key)) !== null;
    return {
      seed: () => run(() => seedSubcontractLibrary(), (report) => (seedReportHasChanges(report) ? 'seed' : 'seedUpToDate')),
      approve: (version, effectiveFrom, reason) =>
        done(() => approveClauseVersion(ref(version), { expectedRevision: version.revision, effectiveFrom, reason }), 'approve'),
      reject: (version, reason) => done(() => rejectClauseVersion(ref(version), { expectedRevision: version.revision, reason }), 'reject'),
      withdraw: (version, reason) => done(() => withdrawClauseVersion(ref(version), { expectedRevision: version.revision, reason }), 'withdraw'),
      markReviewed: (version) => done(() => markClauseVersionReviewed(ref(version), { expectedRevision: version.revision }), 'markReviewed'),
      proposeTranslation: (version, language, body) =>
        done(() => proposeClauseTranslation(ref(version), { expectedRevision: version.revision, language, body, origin: 'human' }), 'proposeTranslation'),
      approveTranslation: (version, language) =>
        done(() => approveClauseTranslation(ref(version), language, { expectedRevision: version.revision }), 'approveTranslation'),
      setClauseArchived: (clause, archived) =>
        done(() => setClauseArchived(clause.id, { expectedRevision: clause.revision, archived }), archived ? 'archive' : 'restore'),
      setTemplateArchived: (template, archived) =>
        done(() => setTradeTemplateArchived(template.id, { expectedRevision: template.revision, archived }), archived ? 'archive' : 'restore'),
      createClause: (input) => attempt(() => createClause(input), 'clauseCreated', 'revisionMismatch'),
      proposeClauseVersion: (clauseId, input) => attempt(() => proposeClauseVersion(clauseId, input), 'clauseProposed', 'revisionMismatch'),
    };
  }, [run, attempt]);
}
