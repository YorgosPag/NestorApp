'use client';

/**
 * =============================================================================
 * Ο κατάλογος της υπόθεσης για τον επαγγελματία — ανάγνωση + transmittal (ADR-901 Φ2 §5.4 · Φ4.2 · Φ4.4)
 * =============================================================================
 *
 * **Ίδια** components καταλόγου με τον οικοδεσπότη (`ConveyanceChecklistSection` · `ConveyanceChecklistRow`), με
 * `canEdit=false`: ο επαγγελματίας **δεν** ελέγχει γραμμές. Ό,τι **προσθέτει** είναι:
 * - άνοιγμα/λήψη τεκμηρίων (Φ4.2)
 * - «Αποστολή εγγράφου» στις γραμμές που ο **ρόλος** του συμπληρώνει **τώρα** — ο ίδιος καθαρός κριτής με τον server
 *   (`contributableItemIds`), ώστε να μην εμφανίζεται κουμπί που θα αρνηθεί ο server
 * - «Απόσυρση» του δικού του σταλμένου, με επιβεβαίωση (Radix), αισιόδοξα
 * - «Στείλε τη νέα έκδοση» (Φ4.5) — ένα πάτημα, ίδιοι παραλήπτες, όταν η στοίβα του έχει νεότερη
 * - «Νέα έκδοση» (Φ4.5 §14.6) — ο δρόμος που **γεννά** τη v2: ανέβασμα στη στοίβα του σταλμένου + αποστολή στους ίδιους
 * - «Ζήτησε έγγραφο» (Φ4.5) — ο ίδιος καθαρός κριτής με τον server δείχνει παραλήπτη ή γιατί όχι
 *
 * @module components/conveyance/my-cases/EngagedCaseChecklist
 */

import React, { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ConveyanceChecklistSection } from '@/components/sales/conveyance/ConveyanceChecklistSection';
import type { RevisionTarget, RowTransmittal } from '@/components/sales/conveyance/ConveyanceRowTransmittal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CHECKLIST_SECTIONS } from '@/config/conveyance-checklist/types';
import { useCaseContributions, type ContributionActionOutcome } from '@/hooks/useCaseContributions';
import { useDocumentRequests } from '@/hooks/useDocumentRequests';
import { ConveyanceRequestAllBar } from '@/components/sales/conveyance/ConveyanceRequestAllBar';
import { contributableItemIds } from '@/lib/conveyance/contribution-policy';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/providers/NotificationProvider';
import type { ContributionRequest } from '@/services/conveyance/conveyance-engagement-gateway';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ChecklistRow, EngagedCaseView, EvidenceFile } from '@/types/conveyance-case';
import { useCaseFileOpening } from '@/components/conveyance/shared/CaseFileOpening';

/** Ο διάλογος αποστολής φορτώνεται **μόνο** στο κλικ — φέρνει τη ροή ανεβάσματος (όριο κλειστότητας, ADR-744). */
const TransmitDocumentDialog = dynamic(() => import('./TransmitDocumentDialog'), { ssr: false });
/** Ο διάλογος νέας έκδοσης — ίδιο όριο: φέρνει τη ροή ανεβάσματος μόνο στο κλικ. */
const ReviseTransmittalDialog = dynamic(() => import('./ReviseTransmittalDialog'), { ssr: false });

/** Ο κατάλογος είναι μόνο για ανάγνωση — οι χειριστές ελέγχου δεν καλούνται ποτέ (`canEdit=false`). */
const READ_ONLY = (): void => undefined;

/** Αποστολή/απόσυρση + τα μηνύματά τους — ό,τι χρειάζονται οι γραμμές και οι διάλογοι. */
function useTransmittalUi(view: EngagedCaseView, onChanged: () => void) {
  const { t } = useTranslation(['conveyance']);
  const { success, error } = useNotifications();
  const contributions = useCaseContributions(view.engagementId, onChanged);
  const [transmitRow, setTransmitRow] = useState<ChecklistRow | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<EvidenceFile | null>(null);
  const [reviseTarget, setReviseTarget] = useState<RevisionTarget | null>(null);
  const contributable = useMemo(
    () => new Set(contributableItemIds(view.role, view.state, view.checklist.rows.map((row) => row.item))),
    [view.checklist.rows, view.role, view.state],
  );
  /** Το μήνυμα επιτυχίας έρχεται ήδη μεταφρασμένο — κυριολεκτικά κλειδιά στον καλούντα (στατική επίλυση, CHECK 3.34). */
  const report = useCallback((outcome: ContributionActionOutcome, okMessage: string) => {
    if (outcome.ok) success(okMessage);
    else error(t(`transmittal.errors.${outcome.reason}`));
  }, [error, success, t]);
  const reissue = (contributionId: string) => contributions.reissue(contributionId).then((outcome) => report(outcome, t('transmittal.reissued')));
  const transmittal: RowTransmittal = {
    canTransmit: (row) => contributable.has(row.itemId),
    sendingItemId: contributions.sendingItemId,
    withdrawingIds: contributions.withdrawingIds,
    onTransmit: setTransmitRow,
    onWithdraw: setWithdrawFile,
    reissuingIds: contributions.reissuingIds,
    onReissue: (file) => {
      if (file.source.kind === 'transmittal') void reissue(file.source.contributionId);
    },
    onRevise: (file, row) => setReviseTarget({ file, row }),
  };
  const send = (request: ContributionRequest) => {
    void contributions.transmit(request).then((outcome) => { report(outcome, t('transmittal.sent')); if (outcome.ok) setTransmitRow(null); });
  };
  const confirmWithdraw = () => {
    const file = withdrawFile;
    setWithdrawFile(null);
    if (file?.source.kind === 'transmittal') void contributions.withdraw(file.source.contributionId).then((outcome) => report(outcome, t('transmittal.withdrawn')));
  };
  return { transmittal, transmitRow, setTransmitRow, withdrawFile, setWithdrawFile, reviseTarget, setReviseTarget, reissue, send, confirmWithdraw, sending: contributions.sendingItemId !== null };
}

export function EngagedCaseChecklist({ view, onChanged }: { readonly view: EngagedCaseView; readonly onChanged: () => void }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const target = useMemo(() => ({ kind: 'engagement' as const, engagementId: view.engagementId }), [view.engagementId]);
  const { openFile, previewDialog } = useCaseFileOpening(target);
  const ui = useTransmittalUi(view, onChanged);
  const requests = useDocumentRequests(target, view.documentRequests, view.checklist.rows, onChanged);
  return (
    <section className="space-y-3">
      <p className={cn('m-0 text-xs', colors.text.muted)}>{t('engagement.case.readOnly')}</p>
      <ConveyanceRequestAllBar requestable={requests.requestable} targets={view.documentRequests.targets} onConfirm={requests.requestAll} />
      {CHECKLIST_SECTIONS.map((section) => {
        const rows = view.checklist.rows.filter((row) => row.section === section);
        if (rows.length === 0) return null;
        return <ConveyanceChecklistSection key={section} section={section} rows={rows} canEdit={false} onOpenDialog={READ_ONLY} onClear={READ_ONLY} onOpenFile={openFile} transmittal={ui.transmittal} request={requests.rowRequest} />;
      })}
      {previewDialog}
      <TransmitDocumentDialog row={ui.transmitRow} caseId={view.caseId} role={view.role} sending={ui.sending} onCancel={() => ui.setTransmitRow(null)} onSend={ui.send} />
      <ReviseTransmittalDialog target={ui.reviseTarget} caseId={view.caseId} role={view.role} onCancel={() => ui.setReviseTarget(null)} onRevised={ui.reissue} />
      <ConfirmDialog
        open={ui.withdrawFile !== null}
        onOpenChange={(open) => { if (!open) ui.setWithdrawFile(null); }}
        title={t('transmittal.withdrawConfirm.title')}
        description={t('transmittal.withdrawConfirm.description', { name: ui.withdrawFile?.displayName ?? '' })}
        confirmText={t('transmittal.withdrawConfirm.confirm')}
        cancelText={t('transmittal.withdrawConfirm.cancel')}
        variant="destructive"
        onConfirm={ui.confirmWithdraw}
      />
    </section>
  );
}
